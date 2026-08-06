/**
 * Acquisition funnel resolver — unit-testable, no I/O.
 *
 * New user: Promise → Assessment → Result → Prop Pass preview → Paywall →
 * anonymous purchase → post-purchase identity linking → Main.
 * Existing user: Auth → RevenueCat UUID identity → Journal | Paywall.
 * Explicit logout → AUTH_REQUIRED (Auth), never Paywall.
 */

export type AcquisitionPhase =
  | "loading"
  | "startup_loading"
  | "onboarding"
  | "onboarding_slides"
  | "onboarding_personalization"
  | "assessment_intro"
  | "assessment_questions"
  | "assessment_analyzing"
  | "assessment_result"
  | "prop_pass_preview"
  | "purchase_paywall"
  | "purchasing"
  | "linking_identity"
  | "configuring_prop_pass"
  | "existing_user_auth"
  | "recoverable_error"
  | "paywall"
  | "auth"
  | "post_purchase_auth"
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
  /** Anonymous purchase completed with active entitlement — route to post-purchase auth. */
  anonymousEntitlementActive?: boolean;
  /** Post-purchase linking marker is active — keep coordinator mounted until complete. */
  linkingMarkerActive?: boolean;
  /** New unauthenticated assessment funnel phase. */
  funnelPhase?: AcquisitionPhase;
};

/**
 * Pure resolver for the anonymous assessment funnel and existing-user path.
 *
 * Rules:
 * - Not hydrated → loading
 * - Explicit logout in flight → loading (never paywall)
 * - Linking marker active → post_purchase_auth (survives session creation)
 * - No session + anonymous entitlement active → post_purchase_auth
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

  // Active linking marker survives session creation — keeps coordinator mounted.
  if (input.linkingMarkerActive) return "post_purchase_auth";

  if (!input.hasSession) {
    if (input.anonymousEntitlementActive) return "post_purchase_auth";
    if (input.funnelPhase) return input.funnelPhase;
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
  if (phase === "existing_user_auth" || phase === "assessment_intro" || phase === "assessment_questions") {
    return "UNAUTHENTICATED";
  }
  if (phase === "assessment_analyzing" || phase === "assessment_result" || phase === "prop_pass_preview") {
    return "STARTUP_LOADING";
  }
  if (phase === "purchase_paywall") return "AUTHENTICATED_NOT_ENTITLED";
  if (phase === "purchasing" || phase === "linking_identity" || phase === "configuring_prop_pass") {
    return "ENTITLEMENT_CHECKING";
  }
  if (phase === "recoverable_error") return "RECOVERABLE_ERROR";
  if (phase === "auth") {
    if (input.explicitAuthRequired) return "AUTH_REQUIRED";
    if (input.authBusy) return "AUTHENTICATING";
    return "UNAUTHENTICATED";
  }
  if (phase === "paywall") return "AUTHENTICATED_NOT_ENTITLED";
  if (phase === "post_purchase_auth") return "AUTHENTICATING";
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
