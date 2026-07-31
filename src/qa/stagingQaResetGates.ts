/**
 * Pure staging QA reset gates — no React Native imports (Node-testable).
 */

const STAGING_ENVS = new Set(["staging", "development", "local", "dev"]);

export function resolveAppEnvironment(
  env: Record<string, string | undefined>,
  devFallback = false,
): string {
  return (
    env.EXPO_PUBLIC_APP_ENV ||
    env.APP_ENV ||
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

  if ((input.env.EXPO_PUBLIC_QA_RESET_AUTH || "").trim() === "1") return true;

  const argv = input.processArgs || [];
  if (argv.some((a) => a === "-YTQAResetAuth" || a === "--YTQAResetAuth")) return true;

  const url = (input.deepLinkUrl || "").trim().toLowerCase();
  if (url.startsWith("youtrader://qa/reset-auth")) return true;

  return false;
}
