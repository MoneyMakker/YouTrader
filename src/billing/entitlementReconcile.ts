/**
 * Post-auth entitlement reconciliation — account-first (no anonymous purchase).
 * Pure helpers — no React / no I/O.
 *
 * Automatic restorePurchases is never selected. Manual Restore is a UI action.
 */

export type EntitlementProbe = {
  isEntitled: boolean;
};

export type ReconcileDecision =
  | { action: "confirmed_entitled" }
  | { action: "confirmed_not_entitled" }
  | { action: "fail_closed" }
  | { action: "refresh_then_decide" };

/**
 * Decide how to proceed after Purchases.logIn + CustomerInfo.
 * Never auto-restores. Legacy preAuth / same-user-at-logout flags are ignored.
 */
export function decidePostLoginEntitlementReconcile(input: {
  /** @deprecated Ignored — purchase-before-login removed. */
  preAuthEntitled?: boolean;
  postLoginEntitled: boolean;
  /** @deprecated Ignored — automatic restore removed. */
  restoreAlreadyAttempted?: boolean;
  /** @deprecated Ignored — automatic restore removed. */
  sameUserWasEntitledAtLogout?: boolean;
}): ReconcileDecision {
  if (input.postLoginEntitled) return { action: "confirmed_entitled" };
  return { action: "confirmed_not_entitled" };
}

/**
 * After identity logIn, prefer an explicit CustomerInfo refresh before treating
 * an empty post-login snapshot as confirmed inactive.
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
