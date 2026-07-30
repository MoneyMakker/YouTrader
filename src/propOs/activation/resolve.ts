import {
  DEFAULT_ACTIVATION_CONFIG,
  type PropOsActivationConfig,
  type PropOsActivationMode,
} from "./types";

const MODES = new Set<PropOsActivationMode>([
  "off",
  "shadow",
  "internal_read_only",
  "staging_preview",
]);

/**
 * Resolve activation mode. Unknown / missing / malformed → off.
 * Never enables a public production mode.
 */
export function parseActivationMode(raw: unknown): PropOsActivationMode {
  if (typeof raw !== "string") return "off";
  const normalized = raw.trim().toLowerCase();
  if (MODES.has(normalized as PropOsActivationMode)) {
    return normalized as PropOsActivationMode;
  }
  return "off";
}

export type ActivationEnvSource = {
  mode?: unknown;
  killSwitch?: unknown;
  allowlist?: unknown;
  maxSnapshotAgeMs?: unknown;
  schemaVersionRequired?: unknown;
};

/**
 * Environment resolver. Defaults every field to safe off configuration.
 */
export function resolveActivationConfig(
  source: ActivationEnvSource | null | undefined,
): { config: PropOsActivationConfig; sourceLabel: string; warnings: string[] } {
  const warnings: string[] = [];
  if (source == null) {
    return { config: { ...DEFAULT_ACTIVATION_CONFIG }, sourceLabel: "missing", warnings: ["config_missing"] };
  }

  const mode = parseActivationMode(source.mode);
  if (source.mode != null && mode === "off" && String(source.mode).trim().toLowerCase() !== "off") {
    warnings.push("invalid_mode_coerced_off");
  }

  let killSwitch = false;
  if (source.killSwitch === true || source.killSwitch === "true" || source.killSwitch === "1") {
    killSwitch = true;
  } else if (
    source.killSwitch != null &&
    source.killSwitch !== false &&
    source.killSwitch !== "false" &&
    source.killSwitch !== "0"
  ) {
    warnings.push("invalid_kill_switch_ignored");
  }

  let allowlistUserIds: string[] = [];
  if (typeof source.allowlist === "string") {
    allowlistUserIds = source.allowlist
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(source.allowlist)) {
    allowlistUserIds = source.allowlist.map(String).map((s) => s.trim()).filter(Boolean);
  } else if (source.allowlist != null) {
    warnings.push("invalid_allowlist_ignored");
  }

  let maxSnapshotAgeMs: number | null = null;
  if (source.maxSnapshotAgeMs == null || source.maxSnapshotAgeMs === "") {
    maxSnapshotAgeMs = null;
  } else {
    const n = Number(source.maxSnapshotAgeMs);
    if (Number.isFinite(n) && n > 0) maxSnapshotAgeMs = n;
    else warnings.push("invalid_max_age_ignored");
  }

  const schemaVersionRequired =
    typeof source.schemaVersionRequired === "string" && source.schemaVersionRequired.trim()
      ? source.schemaVersionRequired.trim()
      : DEFAULT_ACTIVATION_CONFIG.schemaVersionRequired;

  const config: PropOsActivationConfig = {
    ...DEFAULT_ACTIVATION_CONFIG,
    mode: killSwitch ? "off" : mode,
    killSwitch,
    allowlistUserIds,
    maxSnapshotAgeMs,
    schemaVersionRequired,
  };

  return {
    config,
    sourceLabel: warnings.includes("config_missing") ? "missing" : "env",
    warnings,
  };
}

/**
 * Read from process.env-shaped map (Expo public + private).
 * EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE defaults absent → off.
 */
export function resolveActivationConfigFromEnv(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): ReturnType<typeof resolveActivationConfig> {
  return resolveActivationConfig({
    mode: env.EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE ?? env.PROP_OS_ACTIVATION_MODE,
    killSwitch: env.EXPO_PUBLIC_PROP_OS_KILL_SWITCH ?? env.PROP_OS_KILL_SWITCH,
    allowlist: env.EXPO_PUBLIC_PROP_OS_ALLOWLIST ?? env.PROP_OS_ALLOWLIST,
    maxSnapshotAgeMs: env.EXPO_PUBLIC_PROP_OS_MAX_SNAPSHOT_AGE_MS ?? env.PROP_OS_MAX_SNAPSHOT_AGE_MS,
    schemaVersionRequired: env.PROP_OS_SCHEMA_VERSION_REQUIRED,
  });
}
