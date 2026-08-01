/**
 * Settings subscription presentation selftest.
 * Run: npx tsx scripts/qa/settingsSubscriptionPresentation.selftest.ts
 */
import assert from "node:assert/strict";
import { buildSettingsSubscriptionPresentation } from "../../src/app/startup/settingsSubscriptionPresentation";

const weekly = buildSettingsSubscriptionPresentation({
  activeSubscriptions: ["youtrader_pro_weekly"],
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
});
assert.ok(weekly);
assert.equal(weekly!.planKind, "weekly");
assert.match(weekly!.statusLine, /Weekly/);
assert.ok(weekly!.detailLines.some((l) => /\$4\.99\/week/.test(l)));
assert.doesNotMatch(weekly!.statusLine, /\bGuest\b/i);
assert.doesNotMatch(weekly!.statusLine, /\bFree\b/i);

const monthlyTrial = buildSettingsSubscriptionPresentation({
  entitlements: {
    active: {
      "YouTrader Pro": {
        productIdentifier: "youtrader_pro_monthly",
        expirationDate: "2026-08-04T00:00:00.000Z",
        willRenew: true,
        periodType: "TRIAL",
      },
    },
  },
});
assert.ok(monthlyTrial);
assert.equal(monthlyTrial!.planKind, "monthly");
assert.ok(monthlyTrial!.detailLines.some((l) => /Trial ends/.test(l)));
assert.ok(monthlyTrial!.detailLines.some((l) => /\$12\.99\/month/.test(l)));

const yearlyTrial = buildSettingsSubscriptionPresentation({
  entitlements: {
    active: {
      "YouTrader Pro": {
        productIdentifier: "youtrader_pro_yearly__",
        expirationDate: "2026-08-08T00:00:00.000Z",
        willRenew: true,
        periodType: "INTRO",
      },
    },
  },
});
assert.ok(yearlyTrial);
assert.equal(yearlyTrial!.planKind, "yearly");
assert.ok(yearlyTrial!.detailLines.some((l) => /\$99\.99\/year/.test(l)));

const canceled = buildSettingsSubscriptionPresentation({
  entitlements: {
    active: {
      "YouTrader Pro": {
        productIdentifier: "youtrader_pro_yearly__",
        expirationDate: "2026-08-08T00:00:00.000Z",
        willRenew: false,
        periodType: "TRIAL",
        unsubscribeDetectedAt: "2026-08-01T00:00:00.000Z",
      },
    },
  },
});
assert.ok(canceled);
assert.match(canceled!.planLabel, /Yearly Trial/);
assert.ok(canceled!.detailLines.some((l) => /Canceled/.test(l)));

console.log("settingsSubscriptionPresentation selftest PASS");
