import {
  normalizeAIOutput,
  safeParseJsonObject,
  schemaInstruction,
  type AICoachAction,
} from "./aiSchemas.ts";
import { traceAIEvent } from "./langfuse.ts";
import { retrieveKnowledgeContext, type RetrievalContext } from "./retrievalService.ts";
import {
  buildAnalyticsMetadata,
  buildSystemPrompt,
  createRequestId,
  isRouterEnabled,
  routeAIRequest,
} from "./aiPlatform/index.ts";

type GenerateInput = {
  action: AICoachAction;
  period: string;
  payload: Record<string, unknown>;
};

type ProviderName = "openrouter" | "gemini" | "anthropic" | "nvidia" | "local";
type ModelTier = "fast" | "deep";

type ProviderResult = {
  data: Record<string, unknown>;
  provider: ProviderName;
  usedFallback: boolean;
  message?: string;
  retrieval?: RetrievalContext;
  platformMetadata?: Record<string, unknown>;
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-70b-instruct";
const DEFAULT_FAST_MODEL = "google/gemini-2.5-flash";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_DEEP_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const TIMEOUT_MS = 18_000;
const MAX_TRADE_VISION_IMAGE_CHARS = 2_600_000;

function timeoutSignal() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { controller, done: () => clearTimeout(id) };
}

function compactPayload(payload: Record<string, unknown>) {
  const safe = { ...payload };
  delete safe.imageBase64;
  delete safe.imageUri;
  delete safe.photoUri;
  delete safe.voiceUri;
  delete safe.voiceName;
  delete safe.screenshots;
  delete safe.images;
  return safe;
}

function withKnowledgeContext(input: GenerateInput, retrieval: RetrievalContext | null): GenerateInput {
  if (!retrieval) return input;
  return {
    ...input,
    payload: {
      ...input.payload,
      knowledge_context: {
        confidence: retrieval.confidence,
        lowConfidence: retrieval.lowConfidence,
        sources: retrieval.sources,
        context: retrieval.contextText,
      },
    },
  };
}

function modelTier(action: AICoachAction): ModelTier {
  if (["weekly_coach", "journal_summary", "risk_predictor"].includes(action)) return "deep";
  return "fast";
}

function configuredProvider() {
  const provider = (Deno.env.get("AI_PROVIDER") || "auto").trim().toLowerCase();
  if (["openrouter", "gemini", "anthropic", "nvidia"].includes(provider)) return provider as Exclude<ProviderName, "local">;
  return "auto";
}

function modelFor(provider: Exclude<ProviderName, "local">, tier: ModelTier) {
  const fast = Deno.env.get("AI_MODEL_FAST")?.trim();
  const deep = Deno.env.get("AI_MODEL_DEEP")?.trim();
  if (provider === "gemini") return (tier === "deep" ? deep : fast) || DEFAULT_GEMINI_MODEL;
  if (provider === "anthropic") return (tier === "deep" ? deep : fast) || DEFAULT_ANTHROPIC_MODEL;
  if (provider === "nvidia") return Deno.env.get("NVIDIA_MODEL")?.trim() || DEFAULT_NVIDIA_MODEL;
  return (tier === "deep" ? deep : fast) || (tier === "deep" ? DEFAULT_DEEP_MODEL : DEFAULT_FAST_MODEL);
}

function traceModelFor(provider: ProviderName, tier: ModelTier) {
  if (provider === "local") return "local_fallback";
  return modelFor(provider, tier);
}

function userContent(input: GenerateInput) {
  return JSON.stringify({
    action: input.action,
    period: input.period,
    payload: compactPayload(input.payload),
  });
}

function legacySystemPrompt(action: AICoachAction) {
  return buildSystemPrompt(action, schemaInstruction(action));
}

function mapRouterProvider(provider: string): Exclude<ProviderName, "local"> {
  if (provider === "openai") return "openrouter";
  if (provider === "openrouter" || provider === "gemini" || provider === "anthropic" || provider === "nvidia") {
    return provider;
  }
  return "openrouter";
}

function fallbackBase(action: AICoachAction, payload: Record<string, unknown>) {
  const stats = (payload.stats || payload.periodStats || {}) as Record<string, unknown>;
  const totalTrades = Number(stats.totalTrades ?? payload.totalTrades ?? 0);
  const winRate = Number(stats.wr ?? stats.winRate ?? payload.winRate ?? 0);
  const profitFactor = Number(stats.pf ?? stats.profitFactor ?? payload.profitFactor ?? 0);
  const bestSession = String(payload.bestSession || stats.bestSession || "") || null;
  const worstSession = String(payload.worstSession || stats.worstSession || "") || null;
  const headline = String((payload.news as Record<string, unknown> | undefined)?.title || payload.headline || "Market news");

  const fallbacks: Record<AICoachAction, Record<string, unknown>> = {
    weekly_coach: {
      title: "Weekly Trading Coach",
      summary: `This week has ${totalTrades} logged trades. Win rate is near ${Math.round(winRate)}% and profit factor is ${profitFactor.toFixed(2)}.`,
      topStrengths: ["You are building journal data", "Your stats are available for review"],
      mainLeaks: ["Watch weak sessions and emotional trades", "Keep trade count controlled"],
      bestSession,
      worstSession,
      riskNotes: ["Do not increase size after losses", "Respect daily stop rules"],
      nextWeekFocus: ["Journal every trade", "Trade only planned setups", "Review weakest session before trading"],
      coachMessage: "Use this as educational process feedback, not financial advice.",
    },
    risk_predictor: {
      riskLevel: totalTrades > 3 && winRate < 45 ? "high" : winRate < 50 ? "medium" : "low",
      riskScore: Math.max(20, Math.min(85, Math.round(60 - winRate / 2 + totalTrades * 2))),
      reasons: ["Recent journal stats suggest checking discipline before trading"],
      warningSigns: ["Overtrading", "Increasing size after a loss", "Taking trades without written invalidation"],
      recommendedRules: ["Stop after 2 losses", "No revenge trades", "Predefine max risk before first trade"],
      maxRiskSuggestion: "Use reduced fixed risk until discipline is clean.",
      coachMessage: "The goal is to protect process quality, not predict market direction.",
    },
    journal_summary: {
      period: String(payload.period || "selected period"),
      summary: `Journal review: ${totalTrades} trades, ${Math.round(winRate)}% win rate, ${profitFactor.toFixed(2)} profit factor.`,
      patternsDetected: ["Review best and worst sessions", "Compare wins vs losses by context"],
      strengths: ["Trade tracking is active"],
      mistakes: ["Avoid trading weak contexts without a written rule"],
      behaviorNotes: ["Keep notes specific: setup, reason, emotion, rule followed"],
      improvementPlan: ["Pick one leak", "Write one rule", "Review it before the next session"],
    },
    daily_plan: {
      dailyFocus: "Trade only planned setups and protect discipline.",
      riskBudget: "Use fixed risk and stop if rules are broken.",
      avoidToday: ["Revenge trades", "Oversized trades", "News impulse entries"],
      tradeRules: ["Define invalidation before entry", "No size increase after losses", "Journal every trade"],
      sessionFocus: bestSession,
      newsAwareness: ["Major news can increase volatility; treat it as risk context only."],
      coachMessage: "A good trading day can also mean not trading when your rules are not present.",
    },
    news_explainer: {
      headline,
      plainEnglish: "This headline may affect trader expectations and short-term volatility.",
      whyItMatters: "News can change liquidity, spreads, and emotional pressure around market opens.",
      marketsPotentiallyAffected: ["Indexes", "Rates", "Commodities"],
      riskReminder: "This is not a buy or sell signal. Wait for your own plan and manage risk.",
      notFinancialAdvice: true,
    },
    daily_challenge: {
      challengeTitle: "No Revenge Trade Challenge",
      challengeDescription: "Today, every trade must come from your plan, not from frustration.",
      rules: ["Stop after 2 losses", "Journal before and after each trade", "No size increases after red trades"],
      successCriteria: ["No impulse trades", "Every trade has a written reason", "Risk stayed inside your plan"],
      difficulty: "medium",
      whyThisHelps: "Removing revenge trades protects your account and makes your data cleaner.",
    },
    trade_vision_review: {
      verdict: "Cloud vision analysis is unavailable right now.",
      entryQuality: "Entry quality cannot be reviewed without a live vision model response.",
      mistakeDetected: "No visual mistake can be confirmed from local fallback.",
      stopPlacementFeedback: "Stop placement cannot be judged without image analysis.",
      riskRewardFeedback: "Risk/reward is unclear without a successful image review.",
      bestAlternativeAction: "Try again when AI Trade Analysis is available, and keep entry, stop, and target visible in the screenshot.",
      coachNote: "No AI vision review was completed. This is not a trade signal.",
      confidence: "Low",
      evidenceFromImage: ["No image evidence was analyzed because cloud vision was unavailable."],
      journalBehaviorConnection: "No journal behavior connection was made.",
      educationalDisclaimer: "Educational trade review only. Not financial advice.",
    },
  };
  return normalizeAIOutput(action, fallbacks[action]);
}

function tradeVisionSystemPrompt() {
  return [
    legacySystemPrompt("trade_vision_review"),
    "You are a futures trading coach reviewing one user-selected screenshot and one user question.",
    "Use only visible image evidence plus the compact journal context in the user payload.",
    "Analyze entry location, stop placement, risk/reward, exit/execution logic, trend context, visible liquidity/support/resistance, and setup quality when visible.",
    "Do not invent exact prices, levels, indicators, or orderflow details if they are not readable.",
    "Do not give buy/sell-now signals or financial advice. This is educational trade review only.",
    "If the screenshot is unclear or missing critical context, say so clearly and set confidence to Low.",
    "Connect to journal behavior only when compact journal context supports it.",
    "Return strict JSON only.",
  ].join("\n");
}

function tradeVisionText(input: GenerateInput) {
  return JSON.stringify({
    action: input.action,
    period: input.period,
    payload: compactPayload(input.payload),
  });
}

function tradeVisionImage(input: GenerateInput) {
  const imageBase64 = input.payload.imageBase64;
  const imageMimeType = input.payload.imageMimeType;
  if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
    throw new Error("Trade Vision image missing");
  }
  if (imageBase64.length > MAX_TRADE_VISION_IMAGE_CHARS) {
    throw new Error("Trade Vision image is too large");
  }
  const mime = typeof imageMimeType === "string" && /^image\/(jpeg|png|webp)$/i.test(imageMimeType)
    ? imageMimeType.toLowerCase()
    : "image/jpeg";
  return { imageBase64, mime };
}

async function callGeminiVision(input: GenerateInput, attempt = 0): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const model = Deno.env.get("AI_MODEL_VISION")?.trim() || modelFor("gemini", "fast");
  const image = tradeVisionImage(input);
  const { controller, done } = timeoutSignal();

  try {
    const response = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: tradeVisionSystemPrompt() }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: tradeVisionText(input) },
              { inlineData: { mimeType: image.mime, data: image.imageBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.15, maxOutputTokens: 900, responseMimeType: "application/json" },
      }),
    });
    if ([401, 403, 429].includes(response.status)) throw new Error(`Gemini vision non-retryable status ${response.status}`);
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callGeminiVision(input, attempt + 1);
      throw new Error(`Gemini vision status ${response.status}`);
    }
    const json = await response.json();
    const content = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n");
    if (typeof content !== "string" || !content.trim()) throw new Error("Empty Gemini vision response");
    return normalizeAIOutput(input.action, safeParseJsonObject(content));
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callGeminiVision(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

function sanitizedProviderLogValue(value: unknown, fallback = "unknown") {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : fallback;
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, "[redacted-image]")
    .replace(/[A-Za-z0-9+/=]{120,}/g, "[redacted-data]")
    .slice(0, 240);
}

function openRouterErrorDetails(value: unknown) {
  if (!value || typeof value !== "object") return { type: "provider_http", code: "unknown", message: "Provider returned an error response." };
  const root = value as Record<string, unknown>;
  const error = root.error && typeof root.error === "object" ? root.error as Record<string, unknown> : root;
  return {
    type: sanitizedProviderLogValue(error.type, "provider_http"),
    code: sanitizedProviderLogValue(error.code, "unknown"),
    message: sanitizedProviderLogValue(error.message, "Provider returned an error response."),
  };
}

function openRouterRequestId(response: Response) {
  return sanitizedProviderLogValue(
    response.headers.get("x-request-id")
      || response.headers.get("x-openrouter-request-id")
      || response.headers.get("request-id")
      || response.headers.get("cf-ray"),
    "unavailable",
  );
}

async function callOpenRouterVision(input: GenerateInput, attempt = 0): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY")?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
  const model = Deno.env.get("AI_MODEL_VISION")?.trim() || modelFor("openrouter", "fast");
  const image = tradeVisionImage(input);
  const { controller, done } = timeoutSignal();
  const startedAt = Date.now();
  const imageBytesApprox = Math.floor((image.imageBase64.length * 3) / 4);
  let httpStatus: number | null = null;
  let requestId = "unavailable";
  let responseContainedValidContent = false;
  let schemaNormalizationFailed = false;
  let failureLogged = false;
  let stage = "transport";

  const logDiagnostic = (diagnostic: {
    outcome: "success" | "failure";
    errorType?: unknown;
    errorCode?: unknown;
    errorMessage?: unknown;
  }) => {
    const metadata = {
      provider: "openrouter",
      model,
      action: input.action,
      outcome: diagnostic.outcome,
      stage,
      attempt: attempt + 1,
      http_status: httpStatus,
      provider_request_id: requestId,
      provider_error_type: diagnostic.errorType ? sanitizedProviderLogValue(diagnostic.errorType) : null,
      provider_error_code: diagnostic.errorCode ? sanitizedProviderLogValue(diagnostic.errorCode) : null,
      provider_error_message: diagnostic.errorMessage ? sanitizedProviderLogValue(diagnostic.errorMessage) : null,
      response_contained_valid_content: responseContainedValidContent,
      schema_normalization_failed: schemaNormalizationFailed,
      request_duration_ms: Date.now() - startedAt,
      image_mime_type: image.mime,
      image_payload_bytes_approx: imageBytesApprox,
    };
    if (diagnostic.outcome === "failure") console.error("trade_vision_provider_diagnostic", metadata);
    else console.log("trade_vision_provider_diagnostic", metadata);
  };

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://youtrader.app",
        "X-Title": "YouTrader",
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 900,
        messages: [
          { role: "system", content: tradeVisionSystemPrompt() },
          {
            role: "user",
            content: [
              { type: "text", text: tradeVisionText(input) },
              { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.imageBase64}` } },
            ],
          },
        ],
      }),
    });
    httpStatus = response.status;
    requestId = openRouterRequestId(response);

    if (!response.ok) {
      stage = "provider_http";
      const errorBody = await response.json().catch(() => null);
      const details = openRouterErrorDetails(errorBody);
      logDiagnostic({ outcome: "failure", errorType: details.type, errorCode: details.code, errorMessage: details.message });
      failureLogged = true;
      if ([401, 403, 429].includes(response.status)) throw new Error(`OpenRouter vision non-retryable status ${response.status}`);
      if (attempt < 1 && response.status >= 500) return callOpenRouterVision(input, attempt + 1);
      throw new Error(`OpenRouter vision status ${response.status}`);
    }

    stage = "response_parse";
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Empty OpenRouter vision response");
    responseContainedValidContent = true;
    stage = "schema_normalization";
    try {
      const normalized = normalizeAIOutput(input.action, safeParseJsonObject(content));
      logDiagnostic({ outcome: "success" });
      return normalized;
    } catch (error) {
      schemaNormalizationFailed = true;
      logDiagnostic({
        outcome: "failure",
        errorType: error instanceof Error ? error.name : "schema_error",
        errorCode: "schema_normalization_failed",
        errorMessage: error instanceof Error ? error.message : "Schema normalization failed",
      });
      failureLogged = true;
      throw error;
    }
  } catch (error) {
    if (!failureLogged) {
      logDiagnostic({
        outcome: "failure",
        errorType: error instanceof Error ? error.name : "unknown",
        errorCode: error instanceof DOMException && error.name === "AbortError" ? "timeout" : stage,
        errorMessage: error instanceof Error ? error.message : "Unknown provider error",
      });
    }
    if (attempt < 1 && error instanceof TypeError) return callOpenRouterVision(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

async function callTradeVisionProvider(input: GenerateInput): Promise<{ data: Record<string, unknown>; provider: Exclude<ProviderName, "local"> }> {
  const provider = configuredProvider();
  const candidates: Exclude<ProviderName, "local">[] =
    provider === "gemini" || provider === "openrouter"
      ? [provider]
      : ["gemini", "openrouter"];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      if (candidate === "gemini" && !Deno.env.get("GEMINI_API_KEY")?.trim()) continue;
      if (candidate === "openrouter" && !Deno.env.get("OPENROUTER_API_KEY")?.trim()) continue;
      if (candidate === "gemini") return { data: await callGeminiVision(input), provider: candidate };
      return { data: await callOpenRouterVision(input), provider: candidate };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No vision-capable AI provider configured");
}

async function callOpenAICompatible(input: GenerateInput, provider: "openrouter" | "nvidia", attempt = 0): Promise<Record<string, unknown>> {
  const isOpenRouter = provider === "openrouter";
  const apiKey = (isOpenRouter ? Deno.env.get("OPENROUTER_API_KEY") : Deno.env.get("NVIDIA_API_KEY"))?.trim();
  if (!apiKey) throw new Error(`${provider.toUpperCase()} API key missing`);
  const model = modelFor(provider, modelTier(input.action));
  const { controller, done } = timeoutSignal();

  try {
    const response = await fetch(`${isOpenRouter ? OPENROUTER_BASE_URL : NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(isOpenRouter ? { "HTTP-Referer": "https://youtrader.app", "X-Title": "YouTrader" } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: legacySystemPrompt(input.action) },
          { role: "user", content: userContent(input) },
        ],
      }),
    });

    if ([401, 403, 429].includes(response.status)) throw new Error(`${provider} non-retryable status ${response.status}`);
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callOpenAICompatible(input, provider, attempt + 1);
      throw new Error(`${provider} status ${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error(`Empty ${provider} response`);
    return normalizeAIOutput(input.action, safeParseJsonObject(content));
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callOpenAICompatible(input, provider, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

async function callGemini(input: GenerateInput, attempt = 0): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const model = modelFor("gemini", modelTier(input.action));
  const { controller, done } = timeoutSignal();

  try {
    const response = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: legacySystemPrompt(input.action) }] },
        contents: [{ role: "user", parts: [{ text: userContent(input) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
      }),
    });
    if ([401, 403, 429].includes(response.status)) throw new Error(`Gemini non-retryable status ${response.status}`);
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callGemini(input, attempt + 1);
      throw new Error(`Gemini status ${response.status}`);
    }
    const json = await response.json();
    const content = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n");
    if (typeof content !== "string" || !content.trim()) throw new Error("Empty Gemini response");
    return normalizeAIOutput(input.action, safeParseJsonObject(content));
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callGemini(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

async function callAnthropic(input: GenerateInput, attempt = 0): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const model = modelFor("anthropic", modelTier(input.action));
  const { controller, done } = timeoutSignal();

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.2,
        system: legacySystemPrompt(input.action),
        messages: [{ role: "user", content: userContent(input) }],
      }),
    });
    if ([401, 403, 429].includes(response.status)) throw new Error(`Anthropic non-retryable status ${response.status}`);
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callAnthropic(input, attempt + 1);
      throw new Error(`Anthropic status ${response.status}`);
    }
    const json = await response.json();
    const content = json?.content?.map((part: { text?: string }) => part.text || "").join("\n");
    if (typeof content !== "string" || !content.trim()) throw new Error("Empty Anthropic response");
    return normalizeAIOutput(input.action, safeParseJsonObject(content));
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callAnthropic(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

async function callLegacyConfiguredProvider(input: GenerateInput): Promise<{ data: Record<string, unknown>; provider: Exclude<ProviderName, "local"> }> {
  if (input.action === "trade_vision_review") return callTradeVisionProvider(input);

  const provider = configuredProvider();
  if (provider === "openrouter") return { data: await callOpenAICompatible(input, "openrouter"), provider };
  if (provider === "gemini") return { data: await callGemini(input), provider };
  if (provider === "anthropic") return { data: await callAnthropic(input), provider };
  if (provider === "nvidia") return { data: await callOpenAICompatible(input, "nvidia"), provider };

  const tier = modelTier(input.action);
  const candidates: Exclude<ProviderName, "local">[] = tier === "deep"
    ? ["openrouter", "anthropic", "gemini", "nvidia"]
    : ["openrouter", "gemini", "nvidia", "anthropic"];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      if (candidate === "openrouter" && !Deno.env.get("OPENROUTER_API_KEY")?.trim()) continue;
      if (candidate === "gemini" && !Deno.env.get("GEMINI_API_KEY")?.trim()) continue;
      if (candidate === "anthropic" && !Deno.env.get("ANTHROPIC_API_KEY")?.trim()) continue;
      if (candidate === "nvidia" && !Deno.env.get("NVIDIA_API_KEY")?.trim()) continue;
      if (candidate === "openrouter" || candidate === "nvidia") return { data: await callOpenAICompatible(input, candidate), provider: candidate };
      if (candidate === "gemini") return { data: await callGemini(input), provider: candidate };
      return { data: await callAnthropic(input), provider: candidate };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No AI provider configured");
}

async function callPlatformRouter(input: GenerateInput, userTier: "free" | "pro"): Promise<{
  data: Record<string, unknown>;
  provider: Exclude<ProviderName, "local">;
  platformMetadata: Record<string, unknown>;
}> {
  const userText = userContent(input);
  const routerResponse = await routeAIRequest({
    requestId: createRequestId(),
    endpoint: input.action,
    userTier,
    messages: [
      { role: "system", content: buildSystemPrompt(input.action, schemaInstruction(input.action)) },
      { role: "user", content: userText },
    ],
    jsonMode: true,
    cacheKey: `${input.action}:${input.period}:${userText}`,
  });

  return {
    data: normalizeAIOutput(input.action, safeParseJsonObject(routerResponse.content)),
    provider: mapRouterProvider(routerResponse.provider),
    platformMetadata: buildAnalyticsMetadata(routerResponse),
  };
}

export async function generateAI(input: GenerateInput, allowNvidia: boolean): Promise<ProviderResult> {
  const startedAt = Date.now();
  const tier = modelTier(input.action);
  const userTier = allowNvidia ? "pro" : "free";
  let retrieval: RetrievalContext | null = null;
  let groundedInput = input;
  try {
    if (input.action !== "trade_vision_review") {
      retrieval = await retrieveKnowledgeContext(input);
      groundedInput = withKnowledgeContext(input, retrieval);
    }
  } catch (error) {
    console.warn("rag_retrieval_unavailable", { message: error instanceof Error ? error.message : "unknown" });
  }
  if (!allowNvidia) {
    const data = fallbackBase(groundedInput.action, groundedInput.payload);
    await traceAIEvent({
      action: input.action,
      period: input.period,
      provider: "local",
      model: traceModelFor("local", tier),
      tier: userTier,
      latencyMs: Date.now() - startedAt,
      success: true,
      usedFallback: true,
      responseSize: JSON.stringify(data).length,
    });
    return {
      data,
      provider: "local",
      usedFallback: true,
      message: "AI preview uses local analysis for free users.",
      retrieval: retrieval || undefined,
    };
  }

  try {
    const result = isRouterEnabled() && groundedInput.action !== "trade_vision_review"
      ? await callPlatformRouter(groundedInput, userTier)
      : await callLegacyConfiguredProvider(groundedInput);

    await traceAIEvent({
      action: input.action,
      period: input.period,
      provider: result.provider,
      model: traceModelFor(result.provider, tier),
      tier: userTier,
      latencyMs: Date.now() - startedAt,
      success: true,
      usedFallback: false,
      responseSize: JSON.stringify(result.data).length,
    });
    return {
      data: result.data,
      provider: result.provider,
      usedFallback: false,
      message: retrieval?.lowConfidence ? "Knowledge source confidence is low. Verify current prop firm rules before acting." : undefined,
      retrieval: retrieval || undefined,
      platformMetadata: "platformMetadata" in result ? result.platformMetadata : undefined,
    };
  } catch (error) {
    console.error("cloud_ai_fallback", {
      action: input.action,
      message: error instanceof Error ? error.message : "unknown",
    });
    const data = fallbackBase(groundedInput.action, groundedInput.payload);
    await traceAIEvent({
      action: input.action,
      period: input.period,
      provider: "local",
      model: traceModelFor("local", tier),
      tier: userTier,
      latencyMs: Date.now() - startedAt,
      success: false,
      usedFallback: true,
      errorMessage: error instanceof Error ? error.message : "unknown",
      responseSize: JSON.stringify(data).length,
    });
    return {
      data,
      provider: "local",
      usedFallback: true,
      message: "Cloud AI is unavailable right now, so YouTrader used safe local analysis.",
      retrieval: retrieval || undefined,
    };
  }
}

export const generateAIWeeklyCoach = (payload: Record<string, unknown>, allowNvidia: boolean) =>
  generateAI({ action: "weekly_coach", period: "week", payload }, allowNvidia);
export const generateAIRiskPredictor = (payload: Record<string, unknown>, allowNvidia: boolean) =>
  generateAI({ action: "risk_predictor", period: "day", payload }, allowNvidia);
export const generateAIJournalSummary = (payload: Record<string, unknown>, allowNvidia: boolean) =>
  generateAI({ action: "journal_summary", period: String(payload.period || "month"), payload }, allowNvidia);
export const generateAIDailyPlan = (payload: Record<string, unknown>, allowNvidia: boolean) =>
  generateAI({ action: "daily_plan", period: "day", payload }, allowNvidia);
export const generateAINewsExplainer = (payload: Record<string, unknown>, allowNvidia: boolean) =>
  generateAI({ action: "news_explainer", period: "day", payload }, allowNvidia);
export const generateAIChallenges = (payload: Record<string, unknown>, allowNvidia: boolean) =>
  generateAI({ action: "daily_challenge", period: "day", payload }, allowNvidia);
