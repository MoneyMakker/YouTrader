/**
 * Staging-only: print non-sensitive RevenueCat offering / entitlement / product mapping.
 * Uses public iOS SDK API key from staging env — never prints the key.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const rcKey = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "").trim();
  const entitlement = (process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "YouTrader Pro").trim();
  const monthly = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID || "").trim();
  const yearly = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID || "").trim();
  if (!url.includes("zleojeqkzizeyerhjpur")) throw new Error("refuse non-staging");
  if (!rcKey.startsWith("appl_")) throw new Error("expected public iOS appl_ key");

  const appUserId = `ytqa-offering-probe-${Date.now()}`;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${rcKey}`,
      "X-Platform": "ios",
      "Content-Type": "application/json",
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const subscriber = (body.subscriber || {}) as Record<string, unknown>;
  const ents = (subscriber.entitlements || {}) as Record<string, unknown>;

  // Offerings endpoint (v1)
  const offRes = await fetch("https://api.revenuecat.com/v1/subscribers/" + encodeURIComponent(appUserId) + "/offerings", {
    headers: {
      Authorization: `Bearer ${rcKey}`,
      "X-Platform": "ios",
    },
  });
  const offerings = (await offRes.json().catch(() => ({}))) as Record<string, any>;

  const current = offerings?.current_offering_id || offerings?.offerings?.[0]?.identifier || null;
  const offeringList = Array.isArray(offerings?.offerings) ? offerings.offerings : [];
  const currentOffering =
    offeringList.find((o: any) => o.identifier === current) || offeringList[0] || null;
  const packages = (currentOffering?.packages || []).map((p: any) => ({
    identifier: p.identifier,
    platform_product_identifier: p.platform_product_identifier || p.product?.identifier || null,
  }));

  console.info("[YTQA:rc]", {
    http_subscriber: res.status,
    http_offerings: offRes.status,
    entitlement_expected: entitlement,
    monthly_expected: monthly,
    yearly_expected: yearly,
    current_offering_id: currentOffering?.identifier || current,
    packages,
    active_entitlements: Object.keys(ents),
    key_prefix: rcKey.slice(0, 8) + "…",
    app_user_probe: appUserId.slice(0, 24) + "…",
  });

  const productIds = new Set(packages.map((p: any) => p.platform_product_identifier).filter(Boolean));
  const monthlyOk = productIds.has(monthly);
  const yearlyOk = productIds.has(yearly);
  console.info("[YTQA:rc] mapping", {
    monthly_in_offering: monthlyOk,
    yearly_in_offering: yearlyOk,
    package_count: packages.length,
  });
  if (!monthlyOk || !yearlyOk) process.exitCode = 3;
}

main().catch((e) => {
  console.error("[YTQA:rc] FAIL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
