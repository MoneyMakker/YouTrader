/**
 * Staging-only: print non-sensitive RevenueCat offering / entitlement / product mapping.
 * Loads identifiers from ios/.xcode.env.staging (quote-safe) — never prints the API key.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const body = t.startsWith("export ") ? t.slice(7) : t;
    const i = body.indexOf("=");
    if (i < 0) continue;
    out[body.slice(0, i)] = body.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const staging = loadEnvFile(resolve(ROOT, "ios/.xcode.env.staging"));
  const url = (staging.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const rcKey = (staging.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "").trim();
  const entitlement = (staging.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "YouTrader Pro").trim();
  const monthly = (staging.EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID || "").trim();
  const yearly = (staging.EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID || "").trim();
  if (!url.includes("zleojeqkzizeyerhjpur")) throw new Error("refuse non-staging");
  if (!rcKey.startsWith("appl_")) throw new Error("expected public iOS appl_ key");
  if (entitlement !== "YouTrader Pro") {
    throw new Error(`entitlement must be exactly "YouTrader Pro", got ${JSON.stringify(entitlement)}`);
  }

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

  const offRes = await fetch(
    "https://api.revenuecat.com/v1/subscribers/" + encodeURIComponent(appUserId) + "/offerings",
    {
      headers: {
        Authorization: `Bearer ${rcKey}`,
        "X-Platform": "ios",
      },
    },
  );
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
    offering: currentOffering?.identifier || current,
    entitlement,
    monthly_package: packages.find((p: any) => p.identifier === "$rc_monthly") || null,
    annual_package: packages.find((p: any) => p.identifier === "$rc_annual") || null,
    monthly_app_store_product: monthly,
    annual_app_store_product: yearly,
    packages,
    active_entitlements: Object.keys(ents),
    key_prefix: rcKey.slice(0, 8) + "…",
    app_user_probe: appUserId.slice(0, 24) + "…",
  });

  const productIds = new Set(packages.map((p: any) => p.platform_product_identifier).filter(Boolean));
  const monthlyOk = productIds.has(monthly);
  const yearlyOk = productIds.has(yearly);
  const hasMonthlyPkg = packages.some((p: any) => p.identifier === "$rc_monthly");
  const hasAnnualPkg = packages.some((p: any) => p.identifier === "$rc_annual");
  console.info("[YTQA:rc] mapping", {
    monthly_in_offering: monthlyOk,
    yearly_in_offering: yearlyOk,
    has_rc_monthly_package: hasMonthlyPkg,
    has_rc_annual_package: hasAnnualPkg,
    package_count: packages.length,
    entitlement_id_quoted_ok: entitlement === "YouTrader Pro",
  });
  if (!monthlyOk || !yearlyOk || !hasMonthlyPkg || !hasAnnualPkg) process.exitCode = 3;
}

main().catch((e) => {
  console.error("[YTQA:rc] FAIL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
