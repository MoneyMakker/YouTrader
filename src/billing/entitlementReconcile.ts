/**
 * Post-auth entitlement reconciliation after purchase-before-login.
 * Pure helpers + restore decision — no React / no I/O.
 */

export type EntitlementProbe = {
  isEntitled: boolean;
};

export type ReconcileDecision =
  | { action: "confirmed_entitled" }
  | { action: "confirmed_not_entitled" }
  | { action: "restore_once" }
  | { action: "fail_closed" }
  | { action: "refresh_then_decide" };

/**
 * Decide how to proceed after Purchases.logIn when the anonymous customer
 * may have held an entitlement that did not transfer cleanly.
 *
 * Restore is automatic only when:
 * - anonymous / pre-auth CustomerInfo was entitled (purchase-before-login), or
 * - the same Supabase user was entitled at the previous logout (same-account re-login).
 *
 * Never restore solely because another account used this device.
 */
export function decidePostLoginEntitlementReconcile(input: {
  preAuthEntitled: boolean;
  postLoginEntitled: boolean;
  restoreAlreadyAttempted: boolean;
  /** Same Supabase UUID that held Pro at last logout on this device session. */
  sameUserWasEntitledAtLogout?: boolean;
}): ReconcileDecision {
  if (input.postLoginEntitled) return { action: "confirmed_entitled" };
  const shouldAutoRestore =
    input.preAuthEntitled || input.sameUserWasEntitledAtLogout === true;
  if (!shouldAutoRestore) return { action: "confirmed_not_entitled" };
  if (!input.restoreAlreadyAttempted) return { action: "restore_once" };
  return { action: "fail_closed" };
}

/**
 * After identity logIn, prefer an explicit CustomerInfo refresh before treating
 * a empty post-login snapshot as confirmed inactive.
 */
export function decideAfterLoginCustomerInfoRefresh(input: {
  logInEntitled: boolean;
  refreshedEntitled: boolean;
}): "confirmed_entitled" | "still_not_entitled" {
  if (input.logInEntitled || input.refreshedEntitled) return "confirmed_entitled";
  return "still_not_entitled";
}

export function isActiveEntitlement(
  customerInfo: { entitlements?: { active?: Record<string, unknown> } } | null | undefined,
  entitlementId: string,
): boolean {
  if (!customerInfo || !entitlementId) return false;
  return !!customerInfo.entitlements?.active?.[entitlementId];
}

/**
 * Entitlement UI while identity sync is in flight — never emit a false inactive.
 */
export function decideEntitlementUiPhase(input: {
  identitySyncPending: boolean;
  identitySyncFailed: boolean;
  isPro: boolean;
}): "loading" | "retry" | "entitled" | "inactive" {
  if (input.identitySyncPending) return "loading";
  if (input.identitySyncFailed) return "retry";
  if (input.isPro) return "entitled";
  return "inactive";
}
