/**
 * Account-first acquisition / startup phase resolver — unit-testable, no I/O.
 *
 * Contract:
 * Splash → Onboarding (once) → Auth → RevenueCat UUID identity → Journal | Paywall
 *
 * Never: Paywall before Auth.
 * Never: anonymous purchase / anonymous RevenueCat bootstrap.
 * Explicit logout → AUTH_REQUIRED (Auth), never Paywall.
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
  | "ONBOARDING_REQUIRED"
  | "UNAUTHENTICATED"
  | "AUTHENTICATING"
  | "REVENUECAT_IDENTITY_SYNC"
  | "ENTITLEMENT_CHECKING"
  | "AUTHENTICATED_ENTITLED"
  | "AUTHENTICATED_NOT_ENTITLED"
  | "RECOVERABLE_ERROR";

export type AcquisitionInput = {
  hydrated: boolean;
  onboardingCompleted: boolean;
  /** @deprecated Device flag only; must not grant Pro or unlock Main. */
  paywallCompleted: boolean;
  authRequired: boolean;
  hasSession: boolean;
  isPremium: boolean;
  revenueCatReady: boolean;
  /** Optional: auth exchange in progress. */
  authBusy?: boolean;
  /** Optional: RevenueCat configure/catalog hard failure. */
  billingUnavailable?: boolean;
  /** Identity sync / CustomerInfo in flight for the authenticated user. */
  identitySyncPending?: boolean;
  /** Optional: identity sync failed after auth (retryable — not false paywall). */
  identitySyncFailed?: boolean;
  /** Central in-flight explicit logout — suppresses paywall flash. */
  loggingOut?: boolean;
  /**
   * Sticky AUTH_REQUIRED after explicit logout (persisted).
   * Forces the production auth chooser; never routes to paywall
   * until the next successful login clears it.
   */
  explicitAuthRequired?: boolean;
};

/**
 * Pure resolver — account-first.
 *
 * Rules:
 * - Not hydrated → loading
 * - Explicit logout in flight → loading (never paywall)
 * - No session + onboarding incomplete → onboarding
 * - No session → auth (never paywall, never main)
 * - Session + identity sync pending/failed → loading (retryable; not false paywall)
 * - Session + RevenueCat not ready → loading
 * - Session + confirmed not entitled → paywall
 * - Session + entitled → main (Trading Journal)
 */
export function resolveAcquisitionPhase(input: AcquisitionInput): AcquisitionPhase {
  if (!input.hydrated) return "loading";
  if (input.loggingOut) return "loading";

  if (!input.hasSession) {
    if (!input.onboardingCompleted) return "onboarding";
    return "auth";
  }

  // Authenticated — wait for identity + CustomerInfo before Journal/Paywall.
  if (input.identitySyncPending || input.identitySyncFailed) return "loading";
  if (!input.revenueCatReady) return "loading";
  if (!input.isPremium) return "paywall";
  return "main";
}

export function resolveReleaseGateState(input: AcquisitionInput): ReleaseGateState {
  if (input.loggingOut) return "LOGGING_OUT";
  if (input.billingUnavailable && input.hasSession) return "BILLING_UNAVAILABLE";
  if (input.identitySyncFailed && input.hasSession) return "RECOVERABLE_ERROR";
  if (input.identitySyncPending && input.hasSession) return "REVENUECAT_IDENTITY_SYNC";

  const phase = resolveAcquisitionPhase(input);
  if (phase === "loading") {
    if (input.hasSession && !input.revenueCatReady) return "ENTITLEMENT_CHECKING";
    return "STARTUP_LOADING";
  }
  if (phase === "onboarding") return "ONBOARDING_REQUIRED";
  if (phase === "auth") {
    if (input.explicitAuthRequired) return "AUTH_REQUIRED";
    if (input.authBusy) return "AUTHENTICATING";
    return "UNAUTHENTICATED";
  }
  if (phase === "paywall") return "AUTHENTICATED_NOT_ENTITLED";
  if (phase === "main") {
    if (input.hasSession && input.isPremium) return "AUTHENTICATED_ENTITLED";
    if (input.hasSession && !input.isPremium) return "AUTHENTICATED_NOT_ENTITLED";
  }
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

/**
 * Clear sticky AUTH_REQUIRED only on a real login (signed-out → signed-in).
 * Must NOT clear when logout sets the sticky while a session is still present —
 * that bug routed Sign Out back to the acquisition paywall.
 */
export function shouldClearExplicitAuthRequiredOnSessionChange(input: {
  explicitAuthRequired: boolean;
  loggingOut: boolean;
  previousUserId: string | null;
  nextUserId: string | null;
}): boolean {
  if (!input.explicitAuthRequired) return false;
  if (input.loggingOut) return false;
  return !!input.nextUserId && !input.previousUserId;
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
