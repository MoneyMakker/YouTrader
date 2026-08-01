/**
 * Settings subscription presentation from RevenueCat CustomerInfo.
 */

/** Keep product IDs local so Node selftests do not pull Expo/RN constants. */
const WEEKLY_PRODUCT_ID = "youtrader_pro_weekly";
const MONTHLY_PRODUCT_ID = "youtrader_pro_monthly";
const YEARLY_PRODUCT_ID = "youtrader_pro_yearly__";

export type SubscriptionPlanKind = "weekly" | "monthly" | "yearly" | "unknown";

export type SettingsSubscriptionPresentation = {
  planKind: SubscriptionPlanKind;
  planLabel: string;
  statusLine: string;
  detailLines: string[];
};

type EntitlementLike = {
  productIdentifier?: string | null;
  expirationDate?: string | null;
  willRenew?: boolean | null;
  periodType?: string | null;
  unsubscribeDetectedAt?: string | null;
} | null;

type CustomerInfoLike = {
  activeSubscriptions?: string[] | null;
  entitlements?: { active?: Record<string, EntitlementLike> } | null;
  allExpirationDates?: Record<string, string | null> | null;
} | null;

function classifyProductId(productId: string | null | undefined): SubscriptionPlanKind {
  if (!productId) return "unknown";
  if (productId === WEEKLY_PRODUCT_ID || productId.includes("weekly")) return "weekly";
  if (productId === MONTHLY_PRODUCT_ID || productId.includes("monthly")) return "monthly";
  if (
    productId === YEARLY_PRODUCT_ID ||
    productId.includes("yearly") ||
    productId.includes("annual")
  ) {
    return "yearly";
  }
  return "unknown";
}

function planLabel(kind: SubscriptionPlanKind): string {
  switch (kind) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return "YouTrader Pro";
  }
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function priceFor(kind: SubscriptionPlanKind): string {
  switch (kind) {
    case "weekly":
      return "$4.99/week";
    case "monthly":
      return "$12.99/month";
    case "yearly":
      return "$99.99/year";
    default:
      return "";
  }
}

export function buildSettingsSubscriptionPresentation(
  customerInfo: CustomerInfoLike,
  entitlementId = "YouTrader Pro",
): SettingsSubscriptionPresentation | null {
  const entitlement = customerInfo?.entitlements?.active?.[entitlementId] || null;
  const activeSubs = customerInfo?.activeSubscriptions || [];
  const productId =
    entitlement?.productIdentifier ||
    activeSubs.find((id) => classifyProductId(id) !== "unknown") ||
    null;
  if (!productId && !entitlement) return null;

  const kind = classifyProductId(productId);
  const expiration =
    formatDate(entitlement?.expirationDate) ||
    formatDate(productId ? customerInfo?.allExpirationDates?.[productId] : null);
  const periodType = String(entitlement?.periodType || "").toUpperCase();
  const isTrial = periodType.includes("TRIAL") || periodType === "INTRO";
  const canceled =
    entitlement?.willRenew === false ||
    !!entitlement?.unsubscribeDetectedAt ||
    false;

  const details: string[] = [];
  if (canceled) {
    details.push(expiration ? `Access until\n${expiration}` : "Access until current period ends");
    details.push("Renewal\nCanceled");
    return {
      planKind: kind,
      planLabel: isTrial ? `${planLabel(kind)} Trial` : planLabel(kind),
      statusLine: `Current plan\n${isTrial ? `${planLabel(kind)} Trial` : planLabel(kind)}`,
      detailLines: details,
    };
  }

  if (isTrial) {
    details.push(expiration ? `Trial ends\n${expiration}` : "Trial active");
    const renewPrice = priceFor(kind);
    if (renewPrice) details.push(`Renews at\n${renewPrice}`);
    return {
      planKind: kind,
      planLabel: planLabel(kind),
      statusLine: `Current plan\n${planLabel(kind)}`,
      detailLines: details,
    };
  }

  details.push(expiration ? `Renews\n${expiration}` : "Active subscription");
  const price = priceFor(kind);
  if (price) details.push(`Price\n${price}`);
  return {
    planKind: kind,
    planLabel: planLabel(kind),
    statusLine: `Current plan\n${planLabel(kind)}`,
    detailLines: details,
  };
}
