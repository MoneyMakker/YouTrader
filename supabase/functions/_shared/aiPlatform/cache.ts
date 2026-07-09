import type { CacheConfig } from "./types.ts";

type CacheEntry = { expiresAt: number; content: string; modelRef: string; provider: string };

const store = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

function prune(config: CacheConfig) {
  if (store.size <= config.maxEntries) return;
  const overflow = store.size - config.maxEntries;
  const keys = store.keys();
  for (let i = 0; i < overflow; i++) {
    const next = keys.next();
    if (next.done) break;
    store.delete(next.value);
  }
}

export function cacheGet(key: string, config: CacheConfig): CacheEntry | null {
  if (!config.enabled) return null;
  const entry = store.get(key);
  if (!entry) {
    misses += 1;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    misses += 1;
    return null;
  }
  hits += 1;
  return entry;
}

export function cacheSet(key: string, value: Omit<CacheEntry, "expiresAt">, config: CacheConfig) {
  if (!config.enabled) return;
  store.set(key, { ...value, expiresAt: Date.now() + config.ttlSeconds * 1000 });
  prune(config);
}

export function cacheStats() {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRate: total ? Number((hits / total).toFixed(4)) : 0,
    size: store.size,
  };
}

export async function hashCacheKey(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
