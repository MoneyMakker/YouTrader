import type { PlatformConfig } from "./types.ts";
import defaultConfig from "./config.default.json" with { type: "json" };

let cached: PlatformConfig | null = null;

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof base[key] === "object") {
      out[key as keyof T] = deepMerge(base[key] as Record<string, unknown>, value as Record<string, unknown>) as T[keyof T];
    } else if (value !== undefined) {
      out[key as keyof T] = value as T[keyof T];
    }
  }
  return out;
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
