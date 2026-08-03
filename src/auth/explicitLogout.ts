/**
 * Explicit logout orchestration — pure helpers for routing + side-effect order.
 * Logout must never cancel StoreKit / App Store subscriptions.
 */

export type ExplicitLogoutPhase =
  | "idle"
  | "LOGGING_OUT"
  | "AUTH_REQUIRED";

export type ExplicitLogoutPlan = {
  /** Enter LOGGING_OUT before clearing session so paywall cannot flash. */
  setLoggingOut: true;
  /** Sticky AUTH_REQUIRED until next successful login. */
  setExplicitAuthRequired: true;
  clearPendingOAuth: true;
  signOutGoogleNative: true;
  signOutSupabase: true;
  clearLocalUserCache: true;
  resetAnalyticsUser: true;
  clearMonitoringUser: true;
  /** Call Purchases.logOut exactly once when configured and not already anonymous. */
  revenueCatLogOutOnce: true;
  clearInMemoryJournal: true;
  clearCloudSyncStatus: true;
  /** Preserve StoreKit receipt — do not touch App Store subscription APIs. */
  preserveStoreKitReceipt: true;
  navigationRoot: "AUTH_REQUIRED";
  suppressPaywall: true;
};

/** Deterministic side-effect plan for Settings → Log Out. */
export function planExplicitLogout(): ExplicitLogoutPlan {
  return {
    setLoggingOut: true,
    setExplicitAuthRequired: true,
    clearPendingOAuth: true,
    signOutGoogleNative: true,
    signOutSupabase: true,
    clearLocalUserCache: true,
    resetAnalyticsUser: true,
    clearMonitoringUser: true,
    revenueCatLogOutOnce: true,
    clearInMemoryJournal: true,
    clearCloudSyncStatus: true,
    preserveStoreKitReceipt: true,
    navigationRoot: "AUTH_REQUIRED",
    suppressPaywall: true,
  };
}

/**
 * Double-tap / concurrent logout guard.
 * Returns false when a logout is already in flight.
 */
export function beginExplicitLogoutGuard(inFlight: { current: boolean }): boolean {
  if (inFlight.current) return false;
  inFlight.current = true;
  return true;
}

export function endExplicitLogoutGuard(inFlight: { current: boolean }): void {
  inFlight.current = false;
}

/** Whether RevenueCat logOut should run (exactly once when not anonymous). */
export function shouldCallRevenueCatLogOut(input: {
  purchasesConfigured: boolean;
  isAnonymous: boolean | null;
}): boolean {
  if (!input.purchasesConfigured) return false;
  if (input.isAnonymous === true) return false;
  return true;
}

/**
 * Post-login entitlement UI decision after Purchases.logIn + CustomerInfo.
 * Never emit a false paywall while loading or on recoverable network error.
 */
export function decidePostLoginNavigation(input: {
  customerInfoReady: boolean;
  networkError: boolean;
  entitlementActive: boolean | null;
}): "loading" | "retry" | "main" | "paywall" {
  if (input.networkError) return "retry";
  if (!input.customerInfoReady || input.entitlementActive === null) return "loading";
  if (input.entitlementActive) return "main";
  return "paywall";
}

/** Simulate identity transition for regression tests (no I/O). */
export function transitionRevenueCatIdentity(input: {
  beforeUserId: string | null;
  afterUserId: string | null;
  logInCalls: number;
}): { appUserId: string | null; logInCalls: number; switched: boolean } {
  const switched = !!input.afterUserId && input.beforeUserId !== input.afterUserId;
  return {
    appUserId: input.afterUserId,
    logInCalls: switched ? input.logInCalls + 1 : input.logInCalls,
    switched,
  };
}
