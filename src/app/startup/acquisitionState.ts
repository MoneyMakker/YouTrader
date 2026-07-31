/**
 * Deterministic acquisition / startup phase for YouTrader.
 * Fresh install: onboarding → paywall → auth → main.
 * Returning authenticated / entitled users skip completed steps.
 */

export type AcquisitionPhase =
  | "loading"
  | "onboarding"
  | "paywall"
  | "auth"
  | "main";

export type AcquisitionInput = {
  hydrated: boolean;
  /** Device completed first-launch product onboarding. */
  onboardingCompleted: boolean;
  /**
   * Paywall step completed for this install path
   * (anonymous pre-auth and/or per-user post-auth).
   */
  paywallCompleted: boolean;
  authRequired: boolean;
  hasSession: boolean;
  isPremium: boolean;
  revenueCatReady: boolean;
};

/**
 * Pure resolver — unit-testable, no I/O.
 *
 * Rules:
 * - Not hydrated → loading
 * - No session + auth required:
 *   - onboarding incomplete → onboarding
 *   - paywall incomplete (and not already premium via anonymous RC) → paywall
 *   - else → auth
 * - Session present:
 *   - grandfather incomplete onboarding (caller should persist)
 *   - paywall incomplete and not premium and RC ready → paywall
 *   - else → main
 * - Auth not required (misconfig) → still respect onboarding then main
 */
export function resolveAcquisitionPhase(input: AcquisitionInput): AcquisitionPhase {
  if (!input.hydrated) return "loading";

  if (!input.hasSession) {
    if (!input.onboardingCompleted) return "onboarding";
    if (input.authRequired) {
      if (!input.paywallCompleted && !input.isPremium) {
        // Wait for RC before forcing paywall so entitlements do not flash wrong.
        if (!input.revenueCatReady) return "loading";
        return "paywall";
      }
      return "auth";
    }
    return "main";
  }

  // Authenticated
  if (!input.onboardingCompleted) {
    // Existing accounts must not be forced through marketing onboarding.
    // Caller persists onboardingCompleted=true when entering this branch.
    if (!input.paywallCompleted && !input.isPremium) {
      if (!input.revenueCatReady) return "loading";
      return "paywall";
    }
    return "main";
  }

  if (!input.paywallCompleted && !input.isPremium) {
    if (!input.revenueCatReady) return "loading";
    return "paywall";
  }

  return "main";
}

export const ACQUISITION_ONBOARDING_KEY = "yt-acquisition-onboarding-v1";
export const ACQUISITION_PAYWALL_DEVICE_KEY = "yt-acquisition-paywall-device-v1";

export function acquisitionPaywallUserKey(userId: string): string {
  return `yt-acquisition-paywall-user-v1:${userId}`;
}

/**
 * UI flags after a successful staging QA auth reset.
 * Storage has already been cleared; apply signed-out acquisition state immediately.
 *
 * Critical: keep `acquisitionHydrated=true`. Flipping it to false while
 * `session.user.id` is already null does not re-trigger the hydrate effect,
 * leaving the shell stuck on "Loading your journal...".
 * Staging-only callers invoke this after gated QA reset — production never reaches it.
 */
export type StagingQaResetAcquisitionUi = {
  session: null;
  onboardingCompleted: false;
  paywallCompleted: false;
  acquisitionHydrated: true;
};

export function stagingQaResetAcquisitionUi(): StagingQaResetAcquisitionUi {
  return {
    session: null,
    onboardingCompleted: false,
    paywallCompleted: false,
    acquisitionHydrated: true,
  };
}

/**
 * Reproduce the infinite-loading bug class for tests:
 * signed-out + acquisition flags cleared + hydrated=false → loading forever.
 */
export function isStuckAcquisitionLoading(input: AcquisitionInput): boolean {
  return resolveAcquisitionPhase(input) === "loading" && !input.hydrated;
}
