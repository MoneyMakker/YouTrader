import {
  normalizeAIOutput,
  safeParseJsonObject,
  schemaInstruction,
  type AICoachAction,
} from "./aiSchemas.ts";

type GenerateInput = {
  action: AICoachAction;
  period: string;
  payload: Record<string, unknown>;
};

type ProviderResult = {
  data: Record<string, unknown>;
  provider: "nvidia" | "local";
  usedFallback: boolean;
  message?: string;
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";
const TIMEOUT_MS = 18_000;

function timeoutSignal() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { controller, done: () => clearTimeout(id) };
}

function compactPayload(payload: Record<string, unknown>) {
  const safe = { ...payload };
  delete safe.photoUri;
  delete safe.voiceUri;
  delete safe.voiceName;
  delete safe.screenshots;
  delete safe.images;
  return safe;
}

function systemPrompt(action: AICoachAction) {
  return [
    "You are YouTrader AI Coach for a fintech trading journal.",
    "Return only strict JSON. No markdown. No prose outside JSON.",
    "Use only the user's journal/stat/news payload.",
    "Do not provide financial advice. Do not provide buy/sell/hold signals.",
    "Focus on discipline, risk, consistency, journaling behavior, and execution process.",
    `JSON schema: ${schemaInstruction(action)}`,
  ].join("\n");
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
  };
  return normalizeAIOutput(action, fallbacks[action]);
}

async function callNvidia(input: GenerateInput, attempt = 0): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("NVIDIA_API_KEY")?.trim();
  if (!apiKey) throw new Error("NVIDIA_API_KEY missing");
  const model = Deno.env.get("NVIDIA_MODEL")?.trim() || DEFAULT_MODEL;
  const { controller, done } = timeoutSignal();

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemPrompt(input.action) },
          {
            role: "user",
            content: JSON.stringify({
              action: input.action,
              period: input.period,
              payload: compactPayload(input.payload),
            }),
          },
        ],
      }),
    });

    if ([401, 403, 429].includes(response.status)) {
      throw new Error(`NVIDIA non-retryable status ${response.status}`);
    }
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callNvidia(input, attempt + 1);
      throw new Error(`NVIDIA status ${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Empty NVIDIA response");
    return normalizeAIOutput(input.action, safeParseJsonObject(content));
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callNvidia(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

export async function generateAI(input: GenerateInput, allowNvidia: boolean): Promise<ProviderResult> {
  if (!allowNvidia) {
    return {
      data: fallbackBase(input.action, input.payload),
      provider: "local",
      usedFallback: true,
      message: "AI preview uses local analysis for free users.",
    };
  }

  try {
    return {
      data: await callNvidia(input),
      provider: "nvidia",
      usedFallback: false,
    };
  } catch (error) {
    console.error("nvidia_ai_fallback", {
      action: input.action,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      data: fallbackBase(input.action, input.payload),
      provider: "local",
      usedFallback: true,
      message: "Cloud AI is unavailable right now, so YouTrader used safe local analysis.",
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
