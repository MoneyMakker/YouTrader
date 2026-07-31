/**
 * Deterministic entitlement / product-id resolution for staging QA.
 * No network — pure mapping checks against env + StoreKit file expectations.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

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

function run() {
  const staging = loadEnvFile(resolve(ROOT, "ios/.xcode.env.staging"));
  const sk = JSON.parse(
    readFileSync(resolve(ROOT, "ios/YouTraderStaging.storekit"), "utf8"),
  ) as {
    subscriptionGroups: Array<{
      subscriptions: Array<{
        productID: string;
        displayPrice: string;
        recurringSubscriptionPeriod: string;
      }>;
    }>;
  };

  const monthly = staging.EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID;
  const yearly = staging.EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID;
  const entitlement = staging.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID;
  assert.equal(monthly, "youtrader_pro_monthly");
  assert.equal(yearly, "youtrader_pro_yearly__");
  assert.equal(entitlement, "YouTrader Pro");

  const products = sk.subscriptionGroups.flatMap((g) => g.subscriptions);
  const byId = Object.fromEntries(products.map((p) => [p.productID, p]));
  assert.ok(byId[monthly], "monthly missing from StoreKit");
  assert.ok(byId[yearly], "yearly missing from StoreKit");
  assert.equal(byId[monthly].displayPrice, "12.99");
  assert.equal(byId[yearly].displayPrice, "99.99");
  assert.equal(byId[monthly].recurringSubscriptionPeriod, "P1M");
  assert.equal(byId[yearly].recurringSubscriptionPeriod, "P1Y");

  // Both packages map to the same entitlement id (app contract).
  const entitlementFor = (productId: string) => {
    if (productId === monthly || productId === yearly) return entitlement;
    return null;
  };
  assert.equal(entitlementFor(monthly), entitlement);
  assert.equal(entitlementFor(yearly), entitlement);
  assert.equal(entitlementFor("other"), null);

  // Scheme StoreKit path must resolve from xcscheme directory.
  const scheme = readFileSync(
    resolve(
      ROOT,
      "ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader-Staging.xcscheme",
    ),
    "utf8",
  );
  assert.match(scheme, /identifier = "\.\.\/YouTraderStaging\.storekit"/);
  const prodScheme = readFileSync(
    resolve(ROOT, "ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader.xcscheme"),
    "utf8",
  );
  assert.doesNotMatch(prodScheme, /StoreKitConfigurationFileReference/);

  console.log("entitlement-resolution-qa: PASS", {
    monthly,
    yearly,
    entitlement,
    prices: { monthly: byId[monthly].displayPrice, yearly: byId[yearly].displayPrice },
  });
}

run();
