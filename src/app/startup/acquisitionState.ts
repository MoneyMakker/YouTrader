/**
 * Acquisition / startup phase resolver — unit-testable, no I/O.
 *
 * Fresh: onboarding → paywall → auth|guest → main
 * Returning authenticated / entitled / guest users skip completed steps.
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
  paywallCompleted: boolean;
  /** Local-first guest chose Continue without account after paywall. */
  guestContinued: boolean;
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
 * - No session:
 *   - onboarding incomplete → onboarding
 *   - paywall incomplete and not premium → paywall (wait RC ready)
 *   - premium purchase still shows account/guest choice (unless guest)
 *   - guest continued → main
 *   - auth required → auth (Apple / Google / Email / Continue without account)
 *   - else → main
 * - Session present:
 *   - existing accounts skip marketing onboarding (caller persists)
 *   - paywall incomplete and not premium → paywall
 *   - else → main
 */
export function resolveAcquisitionPhase(input: AcquisitionInput): AcquisitionPhase {
  if (!input.hydrated) return "loading";

  if (!input.hasSession) {
    if (!input.onboardingCompleted) return "onboarding";
    if (!input.paywallCompleted && !input.isPremium) {
      if (!input.revenueCatReady) return "loading";
      return "paywall";
    }
    // Entitled users still get post-purchase account choice unless guest.
    if (input.guestContinued) return "main";
    if (input.authRequired) return "auth";
    return "main";
  }

  // Authenticated — never force marketing onboarding.
  if (!input.paywallCompleted && !input.isPremium) {
    if (!input.revenueCatReady) return "loading";
    return "paywall";
  }

  return "main";
}

export const ACQUISITION_ONBOARDING_KEY = "yt-acquisition-onboarding-v1";
export const ACQUISITION_PAYWALL_DEVICE_KEY = "yt-acquisition-paywall-device-v1";
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
