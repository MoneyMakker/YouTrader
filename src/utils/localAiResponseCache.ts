import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const CACHE_PREFIX = "ai-local-cache-v1";

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(",")}}`;
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

export function localAiCacheKey(feature: string, userId: string | null, inputHash: string) {
  const scope = userId ? hashLocalAiInput({ userId }) : "local";
  return `${CACHE_PREFIX}:${feature}:${scope}:${inputHash}`;
}

export async function readLocalAiResponse<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export async function writeLocalAiResponse<T>(key: string, value: T, ttlMs: number): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs } satisfies CacheEntry<T>));
}
