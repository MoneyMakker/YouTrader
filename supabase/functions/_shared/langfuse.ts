import type { AICoachAction } from "./aiSchemas.ts";

type LangfuseProvider = "openrouter" | "gemini" | "anthropic" | "nvidia" | "local";

type TraceInput = {
  action: AICoachAction;
  period: string;
  provider: LangfuseProvider;
  model: string;
  tier: "free" | "pro";
  latencyMs: number;
  success: boolean;
  usedFallback: boolean;
  errorMessage?: string;
  responseSize?: number;
};

const LANGFUSE_TIMEOUT_MS = 1_500;

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function isLangfuseConfigured() {
  return !!env("LANGFUSE_PUBLIC_KEY") && !!env("LANGFUSE_SECRET_KEY");
}

function langfuseHost() {
  return env("LANGFUSE_HOST") || "https://cloud.langfuse.com";
}

function authHeader() {
  return `Basic ${btoa(`${env("LANGFUSE_PUBLIC_KEY")}:${env("LANGFUSE_SECRET_KEY")}`)}`;
}

function tokenEstimate(input: TraceInput) {
  const responseTokens = input.responseSize ? Math.ceil(input.responseSize / 4) : 0;
  return {
    input: 0,
    output: responseTokens,
    total: responseTokens,
  };
}

function costEstimateUsd(input: TraceInput) {
  if (input.provider === "local") return 0;
  return undefined;
}

export async function traceAIEvent(input: TraceInput) {
  if (!isLangfuseConfigured()) return;

  const traceId = crypto.randomUUID();
  const generationId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const usage = tokenEstimate(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LANGFUSE_TIMEOUT_MS);

  try {
    await fetch(`${langfuseHost().replace(/\/$/, "")}/api/public/ingestion`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch: [
          {
            id: crypto.randomUUID(),
            type: "trace-create",
            timestamp,
            body: {
              id: traceId,
              name: "ai-coach",
              tags: ["youtrader", input.action, input.tier],
              metadata: {
                feature: input.action,
                period: input.period,
                provider: input.provider,
                model: input.model,
                tier: input.tier,
                latencyMs: input.latencyMs,
                success: input.success,
                usedFallback: input.usedFallback,
              },
            },
          },
          {
            id: crypto.randomUUID(),
            type: "generation-create",
            timestamp,
            body: {
              id: generationId,
              traceId,
              name: input.action,
              model: input.model,
              modelParameters: {
                temperature: 0.2,
                maxTokens: 900,
              },
              usage,
              metadata: {
                provider: input.provider,
                tier: input.tier,
                latencyMs: input.latencyMs,
                estimatedCostUsd: costEstimateUsd(input),
              },
              level: input.success ? "DEFAULT" : "ERROR",
              statusMessage: input.errorMessage?.slice(0, 160),
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.warn("langfuse_trace_failed", {
      feature: input.action,
      provider: input.provider,
      message: error instanceof Error ? error.message : "unknown",
    });
  } finally {
    clearTimeout(timeout);
  }
}

