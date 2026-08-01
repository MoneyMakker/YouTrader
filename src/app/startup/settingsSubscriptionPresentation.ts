/**
 * Settings subscription presentation from RevenueCat CustomerInfo.
 * Plan/price/dates come from CustomerInfo + optional StoreProduct — never AsyncStorage.
 */

/** Keep product IDs local so Node selftests do not pull Expo/RN constants. */
const WEEKLY_PRODUCT_ID = "youtrader_pro_weekly";
const MONTHLY_PRODUCT_ID = "youtrader_pro_monthly";
const YEARLY_PRODUCT_ID = "youtrader_pro_yearly__";

export type SubscriptionPlanKind = "weekly" | "monthly" | "yearly" | "unknown";

export type SettingsSubscriptionPresentation = {
  entitled: boolean;
  planKind: SubscriptionPlanKind;
  planLabel: string;
  /** Localized price from StoreProduct when available; otherwise empty. */
  priceLabel: string;
  /** "Renews <date>" or "Expires <date>" or empty. */
  renewalLine: string;
  renewalKind: "renews" | "expires" | "none";
  expirationIso: string | null;
  managementURL: string | null;
  /** True when displayed expiration is in the past relative to `now` — caller should refresh CustomerInfo. */
  expirationLooksStale: boolean;
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
  managementURL?: string | null;
  requestDate?: string | null;
} | null;

type StoreProductLike = {
  identifier?: string | null;
  productIdentifier?: string | null;
  priceString?: string | null;
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
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function productIdOf(product: StoreProductLike): string {
  return String(product?.identifier || product?.productIdentifier || "").trim();
}

function priceForProduct(
  productId: string | null,
  storeProducts: StoreProductLike[] | null | undefined,
): string {
  if (!productId || !storeProducts?.length) return "";
  const match = storeProducts.find((p) => productIdOf(p) === productId);
  return (match?.priceString || "").trim();
}

export function buildSettingsSubscriptionPresentation(
  customerInfo: CustomerInfoLike,
  entitlementId = "YouTrader Pro",
  options?: {
    storeProducts?: StoreProductLike[] | null;
    nowMs?: number;
  },
): SettingsSubscriptionPresentation | null {
  const entitlement = customerInfo?.entitlements?.active?.[entitlementId] || null;
  const activeSubs = customerInfo?.activeSubscriptions || [];
  const productId =
    entitlement?.productIdentifier ||
    activeSubs.find((id) => classifyProductId(id) !== "unknown") ||
    null;
  if (!productId && !entitlement) return null;

  const kind = classifyProductId(productId);
  const expirationIso =
    entitlement?.expirationDate ||
    (productId ? customerInfo?.allExpirationDates?.[productId] : null) ||
    null;
  const expirationLabel = formatDate(expirationIso);
  const nowMs = options?.nowMs ?? Date.now();
  const expirationMs = expirationIso ? Date.parse(expirationIso) : NaN;
  const expirationLooksStale =
    Number.isFinite(expirationMs) && expirationMs < nowMs - 60_000;

  const willRenew =
    entitlement?.willRenew === true &&
    !entitlement?.unsubscribeDetectedAt;

  let renewalKind: SettingsSubscriptionPresentation["renewalKind"] = "none";
  let renewalLine = "";
  if (expirationLabel) {
    if (willRenew) {
      renewalKind = "renews";
      renewalLine = `Renews ${expirationLabel}`;
    } else {
      renewalKind = "expires";
      renewalLine = `Expires ${expirationLabel}`;
    }
  }

  return {
    entitled: true,
    planKind: kind,
    planLabel: planLabel(kind),
    priceLabel: priceForProduct(productId, options?.storeProducts),
    renewalLine,
    renewalKind,
    expirationIso,
    managementURL: customerInfo?.managementURL || null,
    expirationLooksStale,
  };
}
