/**
 * Pure staging QA reset gates — no React Native imports (Node-testable).
 */

import { GENERATED_APP_ENV } from "../config/buildFingerprint.generated";
import { isStagingQaResetDeepLink } from "./stagingQaResetModes";

const STAGING_ENVS = new Set(["staging", "development", "local", "dev"]);

export function resolveAppEnvironment(
  env: Record<string, string | undefined>,
  devFallback = false,
): string {
  return (
    env.EXPO_PUBLIC_APP_ENV ||
    env.APP_ENV ||
    (GENERATED_APP_ENV || "").trim() ||
    (devFallback ? "development" : "production")
  )
    .trim()
    .toLowerCase();
}

/** Hard gate: production builds cannot enable QA reset. */
export function isStagingQaResetAllowed(
  env: Record<string, string | undefined>,
  options?: { devFallback?: boolean },
): boolean {
  const appEnv = resolveAppEnvironment(env, options?.devFallback === true);
  if (appEnv === "production" || appEnv === "prod") return false;
  return STAGING_ENVS.has(appEnv);
}

export function shouldRunStagingQaReset(input: {
  env: Record<string, string | undefined>;
  deepLinkUrl?: string | null;
  processArgs?: string[];
  devFallback?: boolean;
}): boolean {
  if (!isStagingQaResetAllowed(input.env, { devFallback: input.devFallback })) {
    return false;
  }

  // EXPO_PUBLIC_QA_RESET_AUTH=1 enables the staging QA surface but does not
  // auto-wipe on every cold start (that races returning-user email login).
  // Actual reset requires deep link or launch argument.

  const argv = input.processArgs || [];
  if (argv.some((a) => a === "-YTQAResetAuth" || a === "--YTQAResetAuth")) return true;

  const url = (input.deepLinkUrl || "").trim().toLowerCase();
  if (isStagingQaResetDeepLink(url)) return true;

  return false;
}
