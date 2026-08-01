/**
 * RevenueCat / subscription CustomerInfo contract matrix.
 * Status: CONTRACT PASS — LIVE REVENUECAT NOT RUN / LIVE E2E NOT RUN
 * Run: node --import tsx scripts/qa/customerInfoContract.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CUSTOMER_INFO_FIXTURES,
  REVENUECAT_CONTRACT,
} from "./fixtures/customerInfoFixtures";
import { buildSettingsSubscriptionPresentation } from "../../src/app/startup/settingsSubscriptionPresentation";
import { resolveAcquisitionPhase } from "../../src/app/startup/acquisitionState";
import {
  buildPaywallPlanPresentation,
  computeYearlySavingsPercent,
  computeYearlyPerWeek,
} from "../../src/app/startup/paywallPlanCopy";
import { resolveIntroTrialInfo } from "../../src/app/startup/trialEligibility";

const root = path.resolve(__dirname, "../..");

// Product / entitlement / offering identifiers
assert.equal(REVENUECAT_CONTRACT.weeklyProductId, "youtrader_pro_weekly");
assert.equal(REVENUECAT_CONTRACT.monthlyProductId, "youtrader_pro_monthly");
assert.equal(REVENUECAT_CONTRACT.yearlyProductId, "youtrader_pro_yearly__");
assert.equal(REVENUECAT_CONTRACT.entitlementId, "YouTrader Pro");
assert.equal(REVENUECAT_CONTRACT.offeringId, "default");
assert.equal(REVENUECAT_CONTRACT.expectedPackageCountWhenComplete, 3);

// StoreKit local intros
const storekit = JSON.parse(fs.readFileSync(path.join(root, "ios/YouTraderStaging.storekit"), "utf8"));
const byId = Object.fromEntries(
  storekit.subscriptionGroups[0].subscriptions.map((s: { productID: string }) => [s.productID, s]),
);
assert.equal(byId.youtrader_pro_weekly.introductoryOffer, null);
assert.equal(byId.youtrader_pro_monthly.introductoryOffer.subscriptionPeriod, "P3D");
assert.equal(byId.youtrader_pro_yearly__.introductoryOffer.subscriptionPeriod, "P1W");

// Trial policy via products
const weeklyProd = { identifier: "youtrader_pro_weekly", introPrice: null } as any;
const monthlyProd = {
  identifier: "youtrader_pro_monthly",
  introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: "DAY" },
} as any;
const yearlyProd = {
  identifier: "youtrader_pro_yearly__",
  introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;
assert.equal(resolveIntroTrialInfo(weeklyProd).eligibility, "ineligible");
assert.equal(resolveIntroTrialInfo(monthlyProd).introDays, 3);
assert.equal(resolveIntroTrialInfo(yearlyProd).introDays, 7);

const weeklyUi = buildPaywallPlanPresentation({
  id: "weekly",
  priceString: "$4.99",
  product: weeklyProd,
});
assert.equal(weeklyUi.trialBadge, null);
assert.match(weeklyUi.cta, /Start for \$4\.99\/week/);

const monthlyUi = buildPaywallPlanPresentation({
  id: "monthly",
  priceString: "$12.99",
  product: monthlyProd,
});
assert.equal(monthlyUi.cta, "Try 3 Days Free");

const yearlyUi = buildPaywallPlanPresentation({
  id: "yearly",
  priceString: "$99.99",
  product: yearlyProd,
  weeklyPriceString: "$4.99",
});
assert.equal(yearlyUi.cta, "Start 7 Days Free");
assert.equal(computeYearlySavingsPercent(4.99, 99.99), 61);
assert.equal(computeYearlyPerWeek(99.99), 1.92);

// Settings matrix
const weekly = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.weekly_active);
assert.ok(weekly);
assert.equal(weekly!.planKind, "weekly");
assert.match(weekly!.statusLine, /Weekly/);
assert.ok(!/\bFree\b/i.test(weekly!.statusLine));

const monthlyTrial = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.monthly_trial);
assert.equal(monthlyTrial!.planKind, "monthly");
assert.ok(monthlyTrial!.detailLines.some((l) => /Trial ends/.test(l)));

const monthlyConv = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.monthly_converted);
assert.ok(monthlyConv!.detailLines.some((l) => /\$12\.99\/month/.test(l)));

const annualTrial = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.annual_trial);
assert.equal(annualTrial!.planKind, "yearly");
assert.ok(annualTrial!.detailLines.some((l) => /Trial ends/.test(l)));

const annualConv = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.annual_converted);
assert.ok(annualConv!.detailLines.some((l) => /\$99\.99\/year/.test(l)));

const canceled = buildSettingsSubscriptionPresentation(
  CUSTOMER_INFO_FIXTURES.trial_canceled_access_active,
);
assert.match(canceled!.planLabel, /Yearly Trial/);
assert.ok(canceled!.detailLines.some((l) => /Canceled/.test(l)));

const expired = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.expired);
assert.equal(expired, null);

const billing = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.billing_issue);
assert.ok(billing);
assert.ok(billing!.detailLines.some((l) => /Canceled|Access until/.test(l)));

const unknown = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.unknown_product);
assert.equal(unknown!.planKind, "unknown");

const missing = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES.missing_customer_info);
assert.equal(missing, null);

// Startup routing vs fixtures (entitlement boolean derived)
function premiumFrom(fixture: (typeof CUSTOMER_INFO_FIXTURES)[string]): boolean {
  if (!fixture) return false;
  const ent = fixture.entitlements?.active?.[REVENUECAT_CONTRACT.entitlementId];
  return !!ent && ent.isActive !== false;
}

assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: false,
    isPremium: premiumFrom(CUSTOMER_INFO_FIXTURES.monthly_trial),
    revenueCatReady: true,
  }),
  "auth",
);

assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: true,
    isPremium: premiumFrom(CUSTOMER_INFO_FIXTURES.monthly_trial),
    revenueCatReady: true,
  }),
  "main",
);

assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: false,
    authRequired: true,
    hasSession: false,
    isPremium: false,
    revenueCatReady: true,
  }),
  "paywall",
);

assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: true,
    isPremium: false,
    revenueCatReady: true,
  }),
  "paywall",
);

// No free / guest strings in acquisition + settings sources
const acq = fs.readFileSync(path.join(root, "src/app/startup/acquisitionState.ts"), "utf8");
assert.ok(acq.includes("no free plan") || acq.includes("no guest"));
assert.ok(!new RegExp("Continue without an " + "account", "i").test(acq));

console.log("customerInfoContract selftest CONTRACT PASS (LIVE REVENUECAT NOT RUN)");
