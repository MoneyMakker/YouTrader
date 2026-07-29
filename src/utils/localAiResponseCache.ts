import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export const LOCAL_AI_CACHE_PREFIX = "ai-local-cache-v1";

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
    .join(",")}}`;
}

export function hashLocalAiInput(value: unknown): string {
  const input = stableValue(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Feature segment must not contain `:`; userId is always the third colon segment. */
export function localAiCacheKey(feature: string, userId: string | null, inputHash: string) {
  const safeFeature = feature.replace(/:/g, "_");
  return `${LOCAL_AI_CACHE_PREFIX}:${safeFeature}:${userId || "local"}:${inputHash}`;
}

export function isLocalAiCacheKeyForUser(key: string, userId: string): boolean {
  if (!key.startsWith(`${LOCAL_AI_CACHE_PREFIX}:`)) return false;
  const parts = key.split(":");
  return parts.length >= 4 && parts[2] === userId;
}

export function parseLocalAiCacheEntry<T>(
  raw: string,
  now = Date.now(),
): { ok: true; value: T } | { ok: false; reason: "invalid" | "expired" } {
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry !== "object" || typeof entry.expiresAt !== "number" || !("value" in entry)) {
      return { ok: false, reason: "invalid" };
    }
    if (entry.expiresAt <= now) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, value: entry.value };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export async function readLocalAiResponse<T>(key: string, now = Date.now()): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseLocalAiCacheEntry<T>(raw, now);
    if (!parsed.ok) {
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export async function writeLocalAiResponse<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Fail open: cache I/O must never break AI flows.
  }
}
