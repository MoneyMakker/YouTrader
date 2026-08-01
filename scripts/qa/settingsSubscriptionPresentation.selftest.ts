/**
 * Settings subscription presentation selftest.
 * Run: npx tsx scripts/qa/settingsSubscriptionPresentation.selftest.ts
 */
import assert from "node:assert/strict";
import { buildSettingsSubscriptionPresentation } from "../../src/app/startup/settingsSubscriptionPresentation";

const weekly = buildSettingsSubscriptionPresentation(
  {
    activeSubscriptions: ["youtrader_pro_weekly"],
    managementURL: "https://apps.apple.com/account/subscriptions",
    entitlements: {
      active: {
        "YouTrader Pro": {
          productIdentifier: "youtrader_pro_weekly",
          expirationDate: "2026-08-15T00:00:00.000Z",
          willRenew: true,
          periodType: "NORMAL",
        },
      },
    },
  },
  "YouTrader Pro",
  {
    storeProducts: [{ identifier: "youtrader_pro_weekly", priceString: "$4.99" }],
    nowMs: Date.parse("2026-08-01T12:00:00.000Z"),
  },
);
assert.ok(weekly);
assert.equal(weekly!.planKind, "weekly");
assert.equal(weekly!.planLabel, "Weekly");
assert.equal(weekly!.priceLabel, "$4.99");
assert.equal(weekly!.renewalKind, "renews");
assert.match(weekly!.renewalLine, /Renews/);
assert.equal(weekly!.managementURL, "https://apps.apple.com/account/subscriptions");
assert.equal(weekly!.expirationLooksStale, false);

const expires = buildSettingsSubscriptionPresentation(
  {
    entitlements: {
      active: {
        "YouTrader Pro": {
          productIdentifier: "youtrader_pro_monthly",
          expirationDate: "2026-08-20T00:00:00.000Z",
          willRenew: false,
          periodType: "NORMAL",
          unsubscribeDetectedAt: "2026-08-01T00:00:00.000Z",
        },
      },
    },
  },
  "YouTrader Pro",
  { nowMs: Date.parse("2026-08-01T12:00:00.000Z") },
);
assert.ok(expires);
assert.equal(expires!.renewalKind, "expires");
assert.match(expires!.renewalLine, /Expires/);

const stale = buildSettingsSubscriptionPresentation(
  {
    entitlements: {
      active: {
        "YouTrader Pro": {
          productIdentifier: "youtrader_pro_yearly__",
          expirationDate: "2026-07-01T00:00:00.000Z",
          willRenew: true,
          periodType: "NORMAL",
        },
      },
    },
  },
  "YouTrader Pro",
  { nowMs: Date.parse("2026-08-01T12:00:00.000Z") },
);
assert.ok(stale);
assert.equal(stale!.expirationLooksStale, true);

const none = buildSettingsSubscriptionPresentation({ entitlements: { active: {} } });
assert.equal(none, null);

console.log("settingsSubscriptionPresentation selftest PASS");
