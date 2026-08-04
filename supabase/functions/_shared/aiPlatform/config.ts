import type { PlatformConfig } from "./types.ts";
import defaultConfig from "./config.default.json" with { type: "json" };

let cached: PlatformConfig | null = null;

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

const DANGEROUS_MERGE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Iterative deep merge — skips prototype-polluting keys; no recursive assign. */
function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const root = { ...base } as Record<string, unknown>;
  const stack: Array<{
    target: Record<string, unknown>;
    source: Record<string, unknown>;
  }> = [{ target: root, source: override as Record<string, unknown> }];

  while (stack.length) {
    const frame = stack.pop();
    if (!frame) break;
    for (const key of Object.keys(frame.source)) {
      if (DANGEROUS_MERGE_KEYS.has(key)) continue;
      const nextValue = frame.source[key];
      const currentValue = frame.target[key];
      if (isPlainObject(nextValue) && isPlainObject(currentValue)) {
        const nested = { ...currentValue };
        frame.target[key] = nested;
        stack.push({ target: nested, source: nextValue });
      } else if (nextValue !== undefined) {
        frame.target[key] = nextValue;
      }
    }
  }

  return root as T;
}

export function loadPlatformConfig(): PlatformConfig {
  if (cached) return cached;

  let config = defaultConfig as PlatformConfig;
  const raw = env("AI_PLATFORM_CONFIG_JSON");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PlatformConfig>;
      config = deepMerge(config, parsed);
    } catch (error) {
      console.error("ai_platform_config_parse_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  if (env("AI_PLATFORM_CACHE_ENABLED") === "false") {
    config = { ...config, cache: { ...config.cache, enabled: false } };
  }
  if (env("AI_PLATFORM_CACHE_TTL_SECONDS")) {
    const ttl = Number(env("AI_PLATFORM_CACHE_TTL_SECONDS"));
    if (Number.isFinite(ttl) && ttl > 0) {
      config = { ...config, cache: { ...config.cache, ttlSeconds: ttl } };
    }
  }

  cached = config;
  return config;
}

export function resetPlatformConfigCache() {
  cached = null;
}

export function isRouterEnabled(): boolean {
  const flag = env("AI_PLATFORM_V2_ENABLED");
  if (flag === "false") return false;
  return true;
}
