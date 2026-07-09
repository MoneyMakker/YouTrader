import type { PlatformConfig, ProfileConfig, ResolvedModel } from "./types.ts";

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function selectProfileName(
  config: PlatformConfig,
  endpoint: string,
  inputTokenEstimate: number,
): string {
  const mapped = config.endpointProfiles[endpoint];
  if (mapped === "fast" && inputTokenEstimate >= config.longContextTokenThreshold) {
    return "long_context";
  }
  if (mapped === "deep" && inputTokenEstimate >= config.longContextTokenThreshold) {
    return "long_context";
  }
  return mapped || "fast";
}

export function resolveModelRef(
  config: PlatformConfig,
  modelRef: string,
  profile: ProfileConfig,
  preferDirect: boolean,
): Omit<ResolvedModel, "profileName"> | null {
  const model = config.models[modelRef];
  if (!model) return null;

  const tryDirect = preferDirect && model.directProvider && model.directModelIdDefault;
  const providerName = (tryDirect ? model.directProvider : model.provider) as ResolvedModel["providerName"];
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.enabled || !env(providerConfig.secretEnv)) return null;

  const modelIdFromEnv = model.modelIdEnv ? env(model.modelIdEnv) : "";
  const modelId = tryDirect
    ? (modelIdFromEnv || model.directModelIdDefault || model.modelIdDefault)
    : (modelIdFromEnv || model.modelIdDefault);

  return {
    modelRef,
    providerName,
    providerConfig,
    modelId,
    profile,
  };
}

export function buildFallbackSequence(
  config: PlatformConfig,
  profileName: string,
  primaryModelRef: string,
): string[] {
  const chain = config.fallbackChains[profileName] || config.fallbackChains.fast || [];
  return [primaryModelRef, ...chain.filter((ref) => ref !== primaryModelRef)];
}

export function estimateCostUsd(
  config: PlatformConfig,
  modelRef: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = config.models[modelRef];
  if (!model) return 0;
  const inRate = model.costPer1MInputUsd ?? 0;
  const outRate = model.costPer1MOutputUsd ?? 0;
  return Number(((inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate).toFixed(6));
}
