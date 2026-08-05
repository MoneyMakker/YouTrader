/**
 * RevenueCatIdentityLinker — transfers an anonymous purchase to a stable
 * Supabase auth identity via Purchases.logIn. Idempotent, retryable,
 * never calls Purchases.logOut.
 */
import Purchases, { type CustomerInfo } from "react-native-purchases";
import { logger } from "../lib/logger";

export type LinkResult =
  | { status: "linked"; customerInfo: CustomerInfo }
  | { status: "already_linked"; customerInfo: CustomerInfo }
  | { status: "not_configured" }
  | { status: "failed"; message: string };

export async function linkAnonymousPurchaseToIdentity(
  supabaseUserId: string,
  priorAnonymousInfo: CustomerInfo | null,
): Promise<LinkResult> {
  try {
    const currentAppUserId = await Purchases.getAppUserID();
  } catch {
    return { status: "not_configured" };
  }

  let customerInfo: CustomerInfo;
  try {
    const loginResult = await Purchases.logIn(supabaseUserId);
    customerInfo = loginResult.customerInfo;
  } catch (error: any) {
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("already") && msg.includes("same")) {
      // The current appUserID is already the supabase UUID — fetch fresh info.
      try {
        customerInfo = await Purchases.getCustomerInfo();
      } catch {
        return { status: "failed", message: "CustomerInfo fetch after already-linked failed" };
      }
    } else {
      logger.error(error, { feature: "revenuecat", action: "log_in_post_purchase" });
      return { status: "failed", message: error?.message || "RevenueCat logIn failed" };
    }
  }

  // Consume returned CustomerInfo — always prefer a fresh fetch after logIn.
  try {
    customerInfo = await Purchases.getCustomerInfo();
  } catch {
    // retain the login-returned info if refresh fails
  }

  if (priorAnonymousInfo) {
    // Preserve anonymous identity snapshot for recovery — logged only via booleans.
    logger.info("post_purchase_identity_linked", {
      anonymousEntitlementActive: !!priorAnonymousInfo?.entitlements?.active,
      authenticatedEntitlementActive: !!customerInfo?.entitlements?.active,
      feature: "revenuecat",
      action: "anonymous_to_authenticated_link",
    });
  }

  return { status: "linked", customerInfo };
}
