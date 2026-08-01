/**
 * Post-auth entitlement reconciliation after purchase-before-login.
 * Pure helpers + one restore fallback — no React.
 */

export type EntitlementProbe = {
  isEntitled: boolean;
};

export type ReconcileDecision =
  | { action: "confirmed_entitled" }
  | { action: "confirmed_not_entitled" }
  | { action: "restore_once" }
  | { action: "fail_closed" };

/**
 * Decide how to proceed after Purchases.logIn when the anonymous customer
 * may have held an entitlement that did not transfer cleanly.
 */
export function decidePostLoginEntitlementReconcile(input: {
  preAuthEntitled: boolean;
  postLoginEntitled: boolean;
  restoreAlreadyAttempted: boolean;
}): ReconcileDecision {
  if (input.postLoginEntitled) return { action: "confirmed_entitled" };
  if (!input.preAuthEntitled) return { action: "confirmed_not_entitled" };
  if (!input.restoreAlreadyAttempted) return { action: "restore_once" };
  return { action: "fail_closed" };
}

export function isActiveEntitlement(
  customerInfo: { entitlements?: { active?: Record<string, unknown> } } | null | undefined,
  entitlementId: string,
): boolean {
  if (!customerInfo || !entitlementId) return false;
  return !!customerInfo.entitlements?.active?.[entitlementId];
}
