export type PromptVersionMeta = {
  version: string;
  date: string;
  description: string;
  author: string;
  expectedOutcome: string;
  systemTemplate: string;
};

const REGISTRY: Record<string, PromptVersionMeta[]> = {
  coach: [
    {
      version: "coach_v1",
      date: "2026-07-02",
      description: "Baseline strict JSON coach prompt with RAG grounding rules",
      author: "YouTrader",
      expectedOutcome: "Valid JSON, non-advisory coaching copy",
      systemTemplate: [
        "You are YouTrader AI Coach for a fintech trading journal.",
        "Return only strict JSON. No markdown. No prose outside JSON.",
        "Use only the user's journal/stat/news payload and knowledge_context when present.",
        "If knowledge_context.lowConfidence is true or context is empty, say the source confidence is too low inside the relevant JSON field and do not invent prop firm rules.",
        "When discussing prop firm, exchange, economic calendar, risk-management, or journaling rules, ground the answer in knowledge_context only.",
        "Do not provide financial advice. Do not provide buy/sell/hold signals.",
        "Focus on discipline, risk, consistency, journaling behavior, and execution process.",
        "{{SCHEMA}}",
      ].join("\n"),
    },
  ],
  market: [
    {
      version: "market_v1",
      date: "2026-07-02",
      description: "Baseline market intelligence JSON summarizer",
      author: "YouTrader",
      expectedOutcome: "Strict JSON market summaries, no signals",
      systemTemplate: [
        "You are YouTrader market intelligence for a trading journal app.",
        "Summarize recent headlines for educational context only.",
        "Never provide buy/sell/hold signals.",
        "Return strict JSON only.",
        "{{SCHEMA}}",
      ].join("\n"),
    },
  ],
};

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function familyForEndpoint(endpoint: string) {
  if (endpoint.startsWith("market_") || ["market_sentiment", "pre_market_brief", "watchlist_risk", "volatility_radar", "noise_filter", "opportunity_scanner", "why_market_moving", "market_narrative"].includes(endpoint)) {
    return "market";
  }
  return "coach";
}

export function resolvePromptVersion(endpoint: string): PromptVersionMeta {
  const family = familyForEndpoint(endpoint);
  const override = env(`AI_PROMPT_VERSION_${endpoint.toUpperCase()}`) || env(`AI_PROMPT_VERSION_${family.toUpperCase()}`);
  const versions = REGISTRY[family] || REGISTRY.coach;
  if (override) {
    const found = versions.find((v) => v.version === override);
    if (found) return found;
  }
  return versions[versions.length - 1];
}

export function buildSystemPrompt(endpoint: string, schemaInstruction: string) {
  const meta = resolvePromptVersion(endpoint);
  return meta.systemTemplate.replace("{{SCHEMA}}", `JSON schema: ${schemaInstruction}`);
}

export function listPromptVersions(family: "coach" | "market" = "coach") {
  return REGISTRY[family] || [];
}
