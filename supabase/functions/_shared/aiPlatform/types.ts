export type ProviderKind = "openai_compatible" | "gemini" | "anthropic";

export type ProviderName = "openrouter" | "gemini" | "anthropic" | "nvidia" | "openai" | "local";

export type ModelTier = "fast" | "deep" | "cheap" | "long_context" | "legacy";

export type PlatformConfig = {
  version: string;
  providers: Record<string, ProviderConfig>;
  models: Record<string, ModelConfig>;
  profiles: Record<string, ProfileConfig>;
  endpointProfiles: Record<string, string>;
  longContextTokenThreshold: number;
  fallbackChains: Record<string, string[]>;
  cache: CacheConfig;
  embedding: EmbeddingConfig;
  observability: { langfuseEnabled: boolean; structuredLogs: boolean };
};

export type ProviderConfig = {
  enabled: boolean;
  kind: ProviderKind;
  baseUrl: string;
  secretEnv: string;
  headers?: Record<string, string>;
};

export type ModelConfig = {
  provider: string;
  modelIdEnv?: string;
  modelIdDefault: string;
  directProvider?: string;
  directModelIdDefault?: string;
  tier: ModelTier;
  contextWindow: number;
  costPer1MInputUsd?: number;
  costPer1MOutputUsd?: number;
};

export type ProfileConfig = {
  modelRef: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
};

export type CacheConfig = {
  enabled: boolean;
  ttlSeconds: number;
  maxEntries: number;
};

export type EmbeddingConfig = {
  provider: string;
  modelEnv: string;
  modelDefault: string;
};

export type RouterMessage = { role: "system" | "user" | "assistant"; content: string };

export type RouterRequest = {
  requestId: string;
  endpoint: string;
  userId?: string;
  userTier?: "free" | "pro";
  messages: RouterMessage[];
  jsonMode?: boolean;
  promptVersion?: string;
  cacheKey?: string;
  inputTokenEstimate?: number;
};

export type RouterAttempt = {
  modelRef: string;
  provider: ProviderName;
  modelId: string;
  success: boolean;
  latencyMs: number;
  error?: string;
};

export type RouterResponse = {
  content: string;
  provider: ProviderName;
  modelId: string;
  modelRef: string;
  profile: string;
  promptVersion: string;
  requestId: string;
  latencyMs: number;
  usedFallback: boolean;
  fallbackReason?: string;
  attempts: RouterAttempt[];
  cacheHit: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
};

export type ResolvedModel = {
  modelRef: string;
  providerName: ProviderName;
  providerConfig: ProviderConfig;
  modelId: string;
  profile: ProfileConfig;
  profileName: string;
};
