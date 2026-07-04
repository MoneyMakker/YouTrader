import { upstashGet, upstashSetEx } from "./upstashRedis.ts";

export type AiCacheFeature =
  | "trade_analysis"
  | "performance_insights"
  | "coach_summary"
  | "radar_summary";

const TTL_SECONDS: Record<AiCacheFeature, number> = {
  trade_analysis: 7 * 24 * 60 * 60,
  performance_insights: 7 * 24 * 60 * 60,
  coach_summary: 7 * 24 * 60 * 60,
  radar_summary: 6 * 60 * 60,
};

export function buildAiCacheKey(input: {
  userId: string;
  feature: AiCacheFeature;
  contentHash: string;
  appVersion?: string;
}) {
  const version = input.appVersion?.trim() || "unknown";
  return `yt:ai:${input.feature}:${input.userId}:${version}:${input.contentHash}`;
}

export async function getCachedAiResponse(key: string): Promise<string | null> {
  return upstashGet(key);
}

export async function setCachedAiResponse(
  key: string,
  value: string,
  feature: AiCacheFeature,
): Promise<void> {
  await upstashSetEx(key, TTL_SECONDS[feature], value);
}

/** Simple sliding-window rate limit per user/feature. Returns true if allowed. */
export async function checkAiRateLimit(input: {
  userId: string;
  feature: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; count: number | null }> {
  const key = `yt:rl:${input.feature}:${input.userId}`;
  const { upstashIncrWithExpire } = await import("./upstashRedis.ts");
  const count = await upstashIncrWithExpire(key, input.windowSeconds);
  if (count === null) return { allowed: true, count: null };
  return { allowed: count <= input.limit, count };
}

export function hashPayload(payload: unknown): string {
  const raw = JSON.stringify(payload ?? {});
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
