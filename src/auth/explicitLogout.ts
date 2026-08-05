/**
 * Explicit logout orchestration — pure helpers for routing + side-effect order.
 * Logout must never cancel StoreKit / App Store subscriptions.
 * Account-first: do NOT call Purchases.logOut on ordinary YouTrader logout.
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
  /**
   * Clear in-memory CustomerInfo / entitlement coordinator state.
   * Do not call Purchases.logOut — next login uses Purchases.logIn(newUUID).
   */
  clearLocalCustomerInfo: true;
  /** @deprecated Always false in account-first architecture. */
  revenueCatLogOutOnce: false;
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
    clearLocalCustomerInfo: true,
    revenueCatLogOutOnce: false,
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

/**
 * Ordinary YouTrader logout must NOT call Purchases.logOut.
 * Always returns false under the account-first contract.
 */
export function shouldCallRevenueCatLogOut(_input: {
  purchasesConfigured: boolean;
  isAnonymous: boolean | null;
}): boolean {
  return false;
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
