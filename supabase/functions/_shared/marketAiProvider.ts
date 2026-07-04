import {
  fallbackMarketOutput,
  normalizeMarketOutput,
  safeParseJsonObject,
  schemaInstruction,
  type MarketIntelligenceAction,
} from "./marketAiSchemas.ts";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";
const TIMEOUT_MS = 20_000;

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function timeoutSignal() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { controller, done: () => clearTimeout(id) };
}

async function callNvidiaJson(action: MarketIntelligenceAction, articles: string, payload: Record<string, unknown>) {
  const apiKey = env("NVIDIA_API_KEY") || env("OPENAI_API_KEY");
  if (!apiKey) throw new Error("AI provider key missing");

  const baseUrl = env("NVIDIA_API_KEY") ? NVIDIA_BASE_URL : "https://api.openai.com/v1";
  const model = env("NVIDIA_MODEL")?.trim() || env("AI_MODEL_FAST")?.trim() || DEFAULT_MODEL;
  const endpoint = env("NVIDIA_API_KEY") ? `${NVIDIA_BASE_URL}/chat/completions` : "https://api.openai.com/v1/chat/completions";

  const system = [
    "You are YouTrader market intelligence for a trading journal app.",
    "Summarize recent headlines for educational context only.",
    "Never provide buy/sell/hold signals.",
    "Return strict JSON only.",
    `Schema: ${schemaInstruction(action)}`,
  ].join("\n");

  const user = JSON.stringify({ action, payload, headlines: articles });

  const { controller, done } = timeoutSignal();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) throw new Error(`AI status ${response.status}`);
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Missing AI content");
    const parsed = safeParseJsonObject(content) as Record<string, unknown>;
    return normalizeMarketOutput(action, parsed);
  } finally {
    done();
  }
}

export async function generateMarketIntelligence(
  action: MarketIntelligenceAction,
  payload: Record<string, unknown>,
  articlesText: string,
) {
  const logTag =
    action === "market_sentiment"
      ? "[YouTrader:market-sentiment]"
      : action === "pre_market_brief"
        ? "[YouTrader:market-brief]"
        : action === "watchlist_risk"
          ? "[YouTrader:watchlist-risk]"
          : action === "opportunity_scanner"
            ? "[YouTrader:opportunity-scanner]"
            : "[YouTrader:brave-news]";

  try {
    const data = await callNvidiaJson(action, articlesText, payload);
    console.log(`${logTag} generated`, { action, usedFallback: false });
    return { data, provider: "nvidia", usedFallback: false };
  } catch (error) {
    console.error(`${logTag} fallback`, { action, message: error instanceof Error ? error.message : "unknown" });
    return {
      data: fallbackMarketOutput(action, payload),
      provider: "local",
      usedFallback: true,
      message: "Market AI used safe local analysis because cloud AI was unavailable.",
    };
  }
}
