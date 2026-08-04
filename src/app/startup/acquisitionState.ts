/**
 * Acquisition / startup phase resolver — unit-testable, no I/O.
 *
 * Paid funnel:
 * onboarding → paywall (purchase/restore) → auth → main
 *
 * Explicit logout:
 * LOGGING_OUT (suppress paywall) → AUTH_REQUIRED (auth chooser) → login → CustomerInfo → main/paywall
 *
 * Anonymous users never enter the tab shell.
 * Authenticated + entitled → five-tab main.
 * Authenticated + not entitled → five-tab main (Prop Pass shows locked preview).
 * Paywall remains reachable from Settings / Prop Pass CTAs / More subscription.
 */

export type AcquisitionPhase =
  | "loading"
  | "onboarding"
  | "paywall"
  | "auth"
  | "main";

/** Explicit release gate states mapped from acquisition + billing readiness. */
export type ReleaseGateState =
  | "STARTUP_LOADING"
  | "LOGGING_OUT"
  | "AUTH_REQUIRED"
  | "BILLING_UNAVAILABLE"
  | "ANONYMOUS_NOT_ENTITLED"
  | "ANONYMOUS_ENTITLED_REQUIRES_AUTH"
  | "AUTHENTICATING"
  | "AUTHENTICATED_ENTITLED"
  | "AUTHENTICATED_NOT_ENTITLED"
  | "RECOVERABLE_ERROR";

export type AcquisitionInput = {
  hydrated: boolean;
  onboardingCompleted: boolean;
  /** @deprecated Kept for migration/tests; entitlement (isPremium) gates Main App for anonymous. */
  paywallCompleted: boolean;
  authRequired: boolean;
  hasSession: boolean;
  isPremium: boolean;
  revenueCatReady: boolean;
  /** Optional: auth exchange in progress after purchase. */
  authBusy?: boolean;
  /** Optional: RevenueCat configure/catalog hard failure. */
  billingUnavailable?: boolean;
  /** Optional: identity sync failed after auth (retryable). */
  identitySyncFailed?: boolean;
  /** Central in-flight explicit logout — suppresses paywall flash. */
  loggingOut?: boolean;
  /**
   * Sticky AUTH_REQUIRED after explicit logout (persisted).
   * Forces the production auth chooser; never routes to acquisition paywall
   * until the next successful login clears it.
   */
  explicitAuthRequired?: boolean;
};

/**
 * Pure resolver.
 *
 * Rules:
 * - Not hydrated → loading
 * - Explicit logout in flight → loading (never paywall)
 * - Onboarding incomplete (anonymous) → onboarding
 * - Explicit AUTH_REQUIRED (post-logout) → auth
 * - Anonymous + no entitlement → paywall (wait RevenueCat ready)
 * - Anonymous + entitlement → auth (mandatory post-purchase/restore)
 * - Authenticated → main (tab count depends on isPremium; never permanent paywall gate)
 */
export function resolveAcquisitionPhase(input: AcquisitionInput): AcquisitionPhase {
  if (!input.hydrated) return "loading";
  if (input.loggingOut) return "loading";

  if (!input.hasSession) {
    if (!input.onboardingCompleted) return "onboarding";
    // Explicit logout root — auth chooser, never acquisition paywall.
    if (input.explicitAuthRequired) return "auth";
    if (!input.isPremium) {
      if (!input.revenueCatReady) return "loading";
      return "paywall";
    }
    // Entitled anonymous — force auth before tabs.
    return "auth";
  }

  // Authenticated — never force marketing onboarding; never trap on paywall.
  return "main";
}

export function resolveReleaseGateState(input: AcquisitionInput): ReleaseGateState {
  if (input.loggingOut) return "LOGGING_OUT";
  if (input.billingUnavailable && !input.hasSession) return "BILLING_UNAVAILABLE";
  if (input.identitySyncFailed && input.hasSession) return "RECOVERABLE_ERROR";

  const phase = resolveAcquisitionPhase(input);
  if (phase === "loading") return "STARTUP_LOADING";
  if (phase === "auth") {
    if (input.explicitAuthRequired) return "AUTH_REQUIRED";
    if (input.authBusy) return "AUTHENTICATING";
    return "ANONYMOUS_ENTITLED_REQUIRES_AUTH";
  }
  if (phase === "paywall" || phase === "onboarding") return "ANONYMOUS_NOT_ENTITLED";
  if (phase === "main") {
    if (input.hasSession && input.isPremium) return "AUTHENTICATED_ENTITLED";
    if (input.hasSession && !input.isPremium) return "AUTHENTICATED_NOT_ENTITLED";
  }
  if (!input.hasSession && input.isPremium) return "ANONYMOUS_ENTITLED_REQUIRES_AUTH";
  if (!input.hasSession && !input.isPremium) return "ANONYMOUS_NOT_ENTITLED";
  return "STARTUP_LOADING";
}

export const ACQUISITION_ONBOARDING_KEY = "yt-acquisition-onboarding-v1";
export const ACQUISITION_PAYWALL_DEVICE_KEY = "yt-acquisition-paywall-device-v1";
/** Sticky AUTH_REQUIRED after explicit logout — survives app restart. */
export const ACQUISITION_AUTH_REQUIRED_KEY = "yt-acquisition-auth-required-v1";
/** @deprecated Guest access removed — key ignored; kept to clear legacy installs. */
export const ACQUISITION_GUEST_KEY = "yt-acquisition-guest-v1";

/**
 * Merge storage + in-memory AUTH_REQUIRED during acquisition hydrate.
 * Prevents a logout race where session→null rehydrates before AsyncStorage.setItem
 * flushes and would otherwise clear the sticky flag (paywall flash).
 */
export function mergeExplicitAuthRequiredFlag(input: {
  hasSession: boolean;
  storageSticky: boolean;
  previous: boolean;
}): boolean {
  if (input.hasSession) return false;
  return input.storageSticky || input.previous;
}

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
