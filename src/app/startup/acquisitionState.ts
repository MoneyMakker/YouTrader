/**
 * Acquisition / startup phase resolver — unit-testable, no I/O.
 *
 * Paid-only funnel:
 * onboarding → paywall (purchase) → auth → main
 *
 * Main App requires BOTH active entitlement AND authenticated session.
 * There is no free plan and no guest application access.
 */

export type AcquisitionPhase =
  | "loading"
  | "onboarding"
  | "paywall"
  | "auth"
  | "main";

export type AcquisitionInput = {
  hydrated: boolean;
  onboardingCompleted: boolean;
  /** @deprecated Kept for migration/tests; entitlement (isPremium) gates Main App. */
  paywallCompleted: boolean;
  authRequired: boolean;
  hasSession: boolean;
  isPremium: boolean;
  revenueCatReady: boolean;
};

/**
 * Pure resolver.
 *
 * Rules:
 * - Not hydrated → loading
 * - Onboarding incomplete → onboarding (even if session exists for fresh marketing reset;
 *   authenticated callers persist onboardingCompleted to skip)
 * - No entitlement → paywall (wait RevenueCat ready; never Main App)
 * - Entitlement active, no session → auth (mandatory post-purchase)
 * - Entitlement active + session → main
 * - Authenticated without entitlement → paywall
 */
export function resolveAcquisitionPhase(input: AcquisitionInput): AcquisitionPhase {
  if (!input.hydrated) return "loading";

  if (!input.hasSession) {
    if (!input.onboardingCompleted) return "onboarding";
    if (!input.isPremium) {
      if (!input.revenueCatReady) return "loading";
      return "paywall";
    }
    if (input.authRequired) return "auth";
    // Auth not configured (unusual) — still block Main App without a session.
    return "auth";
  }

  // Authenticated — never force marketing onboarding (caller marks complete).
  if (!input.isPremium) {
    if (!input.revenueCatReady) return "loading";
    return "paywall";
  }

  return "main";
}

export const ACQUISITION_ONBOARDING_KEY = "yt-acquisition-onboarding-v1";
export const ACQUISITION_PAYWALL_DEVICE_KEY = "yt-acquisition-paywall-device-v1";
/** @deprecated Guest access removed — key ignored; kept to clear legacy installs. */
export const ACQUISITION_GUEST_KEY = "yt-acquisition-guest-v1";

export function acquisitionPaywallUserKey(userId: string): string {
  return `yt-acquisition-paywall-user-v1:${userId}`;
}

export type StagingQaResetAcquisitionUi = {
  session: null;
  onboardingCompleted: boolean;
  paywallCompleted: boolean;
  acquisitionHydrated: true;
};

/** Fresh-device QA reset baseline — signed out into Screen 1 onboarding. */
export function stagingQaResetAcquisitionUi(): StagingQaResetAcquisitionUi {
  return {
    session: null,
    onboardingCompleted: false,
    paywallCompleted: false,
    acquisitionHydrated: true,
  };
}

export function isStuckAcquisitionLoading(input: AcquisitionInput): boolean {
  return resolveAcquisitionPhase(input) === "loading" && !input.hydrated;
}
