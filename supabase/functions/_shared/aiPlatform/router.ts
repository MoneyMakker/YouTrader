import type { RouterRequest, RouterResponse } from "./types.ts";
import { loadPlatformConfig } from "./config.ts";
import { cacheGet, cacheSet, hashCacheKey } from "./cache.ts";
import {
  buildFallbackSequence,
  estimateCostUsd,
  estimateTokens,
  resolveModelRef,
  selectProfileName,
} from "./modelSelection.ts";
import { invokeProvider, providerAvailable } from "./providers.ts";
import { logRouterEvent, traceRouterToLangfuse } from "./observability.ts";
import { resolvePromptVersion } from "./prompts/registry.ts";

export async function routeAIRequest(input: RouterRequest): Promise<RouterResponse> {
  const config = loadPlatformConfig();
  const startedAt = Date.now();
  const inputText = input.messages.map((m) => m.content).join("\n");
  const inputTokenEstimate = input.inputTokenEstimate ?? estimateTokens(inputText);
  const profileName = selectProfileName(config, input.endpoint, inputTokenEstimate);
  const profile = config.profiles[profileName] || config.profiles.fast;
  const promptVersion = input.promptVersion || resolvePromptVersion(input.endpoint).version;

  const cacheKeyRaw = input.cacheKey || `${input.endpoint}:${promptVersion}:${inputText}`;
  const cacheKey = await hashCacheKey(cacheKeyRaw);
  const cached = cacheGet(cacheKey, config.cache);
  if (cached) {
    const response: RouterResponse = {
      content: cached.content,
      provider: cached.provider as RouterResponse["provider"],
      modelId: cached.modelRef,
      modelRef: cached.modelRef,
      profile: profileName,
      promptVersion,
      requestId: input.requestId,
      latencyMs: Date.now() - startedAt,
      usedFallback: false,
      attempts: [],
      cacheHit: true,
      estimatedInputTokens: inputTokenEstimate,
      estimatedOutputTokens: estimateTokens(cached.content),
      estimatedCostUsd: 0,
    };
    await logRouterEvent({ input, response, success: true });
    return response;
  }

  const sequence = buildFallbackSequence(config, profileName, profile.modelRef);
  const attempts: RouterResponse["attempts"] = [];
  let lastError = "no_provider_available";

  for (let i = 0; i < sequence.length; i++) {
    const modelRef = sequence[i];
    const resolved = resolveModelRef(config, modelRef, profile, i > 0);
    if (!resolved || !providerAvailable(resolved.providerConfig)) {
      attempts.push({
        modelRef,
        provider: resolved?.providerName || "local",
        modelId: resolved?.modelId || modelRef,
        success: false,
        latencyMs: 0,
        error: "provider_unavailable",
      });
      continue;
    }

    const attemptStarted = Date.now();
    try {
      const result = await invokeProvider({
        providerName: resolved.providerName,
        providerConfig: resolved.providerConfig,
        modelId: resolved.modelId,
        messages: input.messages,
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        timeoutMs: profile.timeoutMs,
        jsonMode: input.jsonMode ?? true,
      });

      const outputTokens = result.rawUsage?.completionTokens ?? estimateTokens(result.content);
      const response: RouterResponse = {
        content: result.content,
        provider: resolved.providerName,
        modelId: resolved.modelId,
        modelRef,
        profile: profileName,
        promptVersion,
        requestId: input.requestId,
        latencyMs: Date.now() - startedAt,
        usedFallback: i > 0,
        fallbackReason: i > 0 ? lastError : undefined,
        attempts: [
          ...attempts,
          {
            modelRef,
            provider: resolved.providerName,
            modelId: resolved.modelId,
            success: true,
            latencyMs: Date.now() - attemptStarted,
          },
        ],
        cacheHit: false,
        estimatedInputTokens: result.rawUsage?.promptTokens ?? inputTokenEstimate,
        estimatedOutputTokens: outputTokens,
        estimatedCostUsd: estimateCostUsd(config, modelRef, inputTokenEstimate, outputTokens),
      };

      cacheSet(cacheKey, {
        content: result.content,
        modelRef,
        provider: resolved.providerName,
      }, config.cache);

      await logRouterEvent({ input, response, success: true });
      await traceRouterToLangfuse({ input, response, success: true });
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown";
      attempts.push({
        modelRef,
        provider: resolved.providerName,
        modelId: resolved.modelId,
        success: false,
        latencyMs: Date.now() - attemptStarted,
        error: lastError,
      });
    }
  }

  const failure: RouterResponse = {
    content: "",
    provider: "local",
    modelId: "unavailable",
    modelRef: profile.modelRef,
    profile: profileName,
    promptVersion,
    requestId: input.requestId,
    latencyMs: Date.now() - startedAt,
    usedFallback: true,
    fallbackReason: lastError,
    attempts,
    cacheHit: false,
    estimatedInputTokens: inputTokenEstimate,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
  };
  await logRouterEvent({ input, response: failure, success: false });
  await traceRouterToLangfuse({ input, response: failure, success: false });
  throw new Error(`ai_router_exhausted:${lastError}`);
}

export function createRequestId() {
  return crypto.randomUUID();
}
