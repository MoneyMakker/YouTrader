/**
 * Staging-only non-sensitive build fingerprint for QA diagnostics.
 * Prefer generated constants (always embedded). Env vars are fallback only.
 */

import {
  GENERATED_APP_ENV,
  GENERATED_BUILD_FINGERPRINT,
} from "./buildFingerprint.generated";

export type BuildFingerprint = {
  gitSha: string;
  buildTimeUtc: string;
  version: string;
  buildNumber: string;
  xcodeConfiguration: string;
  embeddedBundleMarker: string;
};

const STAGING_LIKE = new Set(["staging", "development", "local", "dev"]);

function envTrim(key: string): string {
  return (process.env[key] || "").trim();
}

function pick(generated: string, envKey: string, fallback = ""): string {
  // Env wins when set (tests / Metro). Generated wins for Release-Staging device builds.
  const e = envTrim(envKey);
  if (e) return e;
  const g = (generated || "").trim();
  if (g) return g;
  return fallback;
}

export function resolveBuildFingerprint(): BuildFingerprint {
  const g = GENERATED_BUILD_FINGERPRINT;
  return {
    gitSha: pick(g.gitSha, "EXPO_PUBLIC_YT_GIT_SHA"),
    buildTimeUtc: pick(g.buildTimeUtc, "EXPO_PUBLIC_YT_BUILD_TIME"),
    version: pick(g.version, "EXPO_PUBLIC_YT_APP_VERSION", "1.6.1"),
    buildNumber: pick(g.buildNumber, "EXPO_PUBLIC_YT_BUILD_NUMBER", "113"),
    xcodeConfiguration: pick(g.xcodeConfiguration, "EXPO_PUBLIC_YT_XCODE_CONFIG"),
    embeddedBundleMarker: pick(g.embeddedBundleMarker, "EXPO_PUBLIC_YT_BUNDLE_MARKER"),
  };
}

/** Visible only in staging-like builds — never production product UI. */
export function isStagingBuildFingerprintVisible(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const appEnv = (
    env.EXPO_PUBLIC_APP_ENV ||
    env.APP_ENV ||
    (GENERATED_APP_ENV || "").trim() ||
    ""
  )
    .trim()
    .toLowerCase();
  if (appEnv === "production" || appEnv === "prod") return false;
  if (!STAGING_LIKE.has(appEnv)) return false;
  if ((env.EXPO_PUBLIC_YT_SHOW_BUILD_FP || "1").trim() === "0") return false;
  return true;
}

/**
 * Searchable token embedded in Release-Staging jsbundle for physical preflight.
 * Example: YT_BUILD_FP_v1:6d6bba2:113:Release-Staging
 */
export function buildFingerprintSearchToken(fp: BuildFingerprint = resolveBuildFingerprint()): string {
  const sha = fp.gitSha || "unknown";
  const build = fp.buildNumber || "unknown";
  const cfg = fp.xcodeConfiguration || "unknown";
  return `YT_BUILD_FP_v1:${sha}:${build}:${cfg}`;
}

export function buildFingerprintDiagnosticLines(
  fp: BuildFingerprint = resolveBuildFingerprint(),
): string[] {
  const token = buildFingerprintSearchToken(fp);
  return [
    `Git ${fp.gitSha || "—"}`,
    `Built ${fp.buildTimeUtc || "—"}`,
    `Version ${fp.version || "—"} (${fp.buildNumber || "—"})`,
    `Config ${fp.xcodeConfiguration || "—"}`,
    `Bundle ${fp.embeddedBundleMarker || "—"}`,
    token,
  ];
}
