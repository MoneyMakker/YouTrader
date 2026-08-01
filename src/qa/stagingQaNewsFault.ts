/**
 * Staging-only news load fault injection for Maestro offline/Retry matrix.
 * Production always returns "none".
 */

export type StagingNewsFaultMode = "none" | "offline" | "timeout" | "empty" | "malformed" | "unavailable";

const FAULT_KEY = "yt-qa-news-fault-v1";

export function parseStagingNewsFaultUrl(url: string): StagingNewsFaultMode | null {
  const raw = (url || "").trim().toLowerCase();
  if (!raw.startsWith("youtrader://qa/news-fault")) return null;
  try {
    const mode = new URL(raw).searchParams.get("mode") || "none";
    if (
      mode === "none" ||
      mode === "offline" ||
      mode === "timeout" ||
      mode === "empty" ||
      mode === "malformed" ||
      mode === "unavailable"
    ) {
      return mode;
    }
  } catch {
    // fall through
  }
  return null;
}

export function isStagingNewsFaultAllowed(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): boolean {
  const appEnv = (env.EXPO_PUBLIC_APP_ENV || env.APP_ENV || "").toLowerCase();
  return appEnv === "staging" || appEnv === "development";
}

/** Pure decision helper — Node-testable. */
export function resolveNewsLoadPlan(fault: StagingNewsFaultMode): {
  useNetwork: boolean;
  forceEmpty: boolean;
  forceMalformed: boolean;
  forceTimeout: boolean;
  errorCode: string | null;
} {
  switch (fault) {
    case "offline":
      return { useNetwork: false, forceEmpty: false, forceMalformed: false, forceTimeout: false, errorCode: "offline" };
    case "unavailable":
      return { useNetwork: false, forceEmpty: false, forceMalformed: false, forceTimeout: false, errorCode: "unavailable" };
    case "timeout":
      return { useNetwork: false, forceEmpty: false, forceMalformed: false, forceTimeout: true, errorCode: "timeout" };
    case "empty":
      return { useNetwork: false, forceEmpty: true, forceMalformed: false, forceTimeout: false, errorCode: null };
    case "malformed":
      return { useNetwork: false, forceEmpty: false, forceMalformed: true, forceTimeout: false, errorCode: "malformed" };
    case "none":
    default:
      return { useNetwork: true, forceEmpty: false, forceMalformed: false, forceTimeout: false, errorCode: null };
  }
}

export const STAGING_NEWS_FAULT_STORAGE_KEY = FAULT_KEY;
