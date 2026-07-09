import type { RouterRequest, RouterResponse } from "./types.ts";
import { cacheStats } from "./cache.ts";
import { loadPlatformConfig } from "./config.ts";

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function langfuseConfigured() {
  return !!env("LANGFUSE_PUBLIC_KEY") && !!env("LANGFUSE_SECRET_KEY");
}

export async function logRouterEvent(input: {
  input: RouterRequest;
  response: RouterResponse;
  success: boolean;
}) {
  const config = loadPlatformConfig();
  if (!config.observability.structuredLogs) return;

  console.log("ai_platform_request", {
    requestId: input.input.requestId,
    endpoint: input.input.endpoint,
    userId: input.input.userId ? "[redacted]" : undefined,
    userTier: input.input.userTier,
    provider: input.response.provider,
    modelRef: input.response.modelRef,
    modelId: input.response.modelId,
    profile: input.response.profile,
    promptVersion: input.response.promptVersion,
    latencyMs: input.response.latencyMs,
    success: input.success,
    usedFallback: input.response.usedFallback,
    fallbackReason: input.response.fallbackReason,
    cacheHit: input.response.cacheHit,
    estimatedCostUsd: input.response.estimatedCostUsd,
    estimatedInputTokens: input.response.estimatedInputTokens,
    estimatedOutputTokens: input.response.estimatedOutputTokens,
    attempts: input.response.attempts.length,
    cache: cacheStats(),
  });
}

export async function traceRouterToLangfuse(input: {
  input: RouterRequest;
  response: RouterResponse;
  success: boolean;
}) {
  const config = loadPlatformConfig();
  if (!config.observability.langfuseEnabled || !langfuseConfigured()) return;
  if (input.response.provider === "local") return;

  const host = env("LANGFUSE_HOST") || "https://cloud.langfuse.com";
  const auth = `Basic ${btoa(`${env("LANGFUSE_PUBLIC_KEY")}:${env("LANGFUSE_SECRET_KEY")}`)}`;
  const traceId = input.input.requestId;
  const generationId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`${host.replace(/\/$/, "")}/api/public/ingestion`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        batch: [
          {
            id: crypto.randomUUID(),
            type: "trace-create",
            timestamp,
            body: {
              id: traceId,
              name: `ai-platform:${input.input.endpoint}`,
              userId: input.input.userId,
              tags: ["youtrader", "ai-platform-v2", input.input.endpoint, input.input.userTier || "unknown"],
              metadata: {
                requestId: input.input.requestId,
                endpoint: input.input.endpoint,
                promptVersion: input.response.promptVersion,
                profile: input.response.profile,
                cacheHit: input.response.cacheHit,
                usedFallback: input.response.usedFallback,
                fallbackReason: input.response.fallbackReason,
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
              name: input.input.endpoint,
              model: input.response.modelId,
              usage: {
                input: input.response.estimatedInputTokens,
                output: input.response.estimatedOutputTokens,
                total: input.response.estimatedInputTokens + input.response.estimatedOutputTokens,
              },
              metadata: {
                provider: input.response.provider,
                modelRef: input.response.modelRef,
                estimatedCostUsd: input.response.estimatedCostUsd,
                latencyMs: input.response.latencyMs,
              },
              level: input.success ? "DEFAULT" : "ERROR",
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.warn("ai_platform_langfuse_failed", {
      requestId: input.input.requestId,
      message: error instanceof Error ? error.message : "unknown",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function buildAnalyticsMetadata(response: RouterResponse) {
  return {
    platform: "v2",
    requestId: response.requestId,
    modelRef: response.modelRef,
    modelId: response.modelId,
    profile: response.profile,
    promptVersion: response.promptVersion,
    latencyMs: response.latencyMs,
    cacheHit: response.cacheHit,
    usedFallback: response.usedFallback,
    fallbackReason: response.fallbackReason,
    estimatedCostUsd: response.estimatedCostUsd,
    estimatedInputTokens: response.estimatedInputTokens,
    estimatedOutputTokens: response.estimatedOutputTokens,
    attempts: response.attempts,
  };
}
