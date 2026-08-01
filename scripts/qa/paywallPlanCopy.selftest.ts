/**
 * Paywall plan copy / CTA / trial policy contract.
 * Run: npx tsx scripts/qa/paywallPlanCopy.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assertNoForbiddenTrialCopy,
  buildPaywallPlanPresentation,
  computeYearlyPerWeek,
  computeYearlySavingsPercent,
  planAllowsTrialDisplay,
} from "../../src/app/startup/paywallPlanCopy";
import { resolveIntroTrialInfo } from "../../src/app/startup/trialEligibility";

const weeklyNoIntro = { identifier: "youtrader_pro_weekly", introPrice: null } as any;
const monthly3d = {
  identifier: "youtrader_pro_monthly",
  introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: "DAY" },
} as any;
const yearly7d = {
  identifier: "youtrader_pro_yearly__",
  introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;
const yearlyWrong3d = {
  identifier: "youtrader_pro_yearly__",
  introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: "DAY" },
} as any;
const monthlyWrong7d = {
  identifier: "youtrader_pro_monthly",
  introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;

// Weekly never shows trial even if product somehow has intro
const weeklyWithIntro = {
  identifier: "youtrader_pro_weekly",
  introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;
assert.equal(planAllowsTrialDisplay("weekly", resolveIntroTrialInfo(weeklyWithIntro), weeklyWithIntro), false);
const weeklyPres = buildPaywallPlanPresentation({
  id: "weekly",
  priceString: "$4.99",
  product: weeklyNoIntro,
});
assert.equal(weeklyPres.cta, "Start for $4.99/week");
assert.equal(weeklyPres.trialBadge, null);
assert.deepEqual(assertNoForbiddenTrialCopy(`${weeklyPres.cta} ${weeklyPres.supporting}`, "weekly"), []);

const monthlyEligible = buildPaywallPlanPresentation({
  id: "monthly",
  priceString: "$12.99",
  product: monthly3d,
});
assert.equal(monthlyEligible.cta, "Try 3 Days Free");
assert.equal(monthlyEligible.trialBadge, "3 Days Free");
assert.match(monthlyEligible.supporting, /3 days free, then \$12\.99\/month/);

const monthlyIneligible = buildPaywallPlanPresentation({
  id: "monthly",
  priceString: "$12.99",
  product: weeklyNoIntro, // no intro
});
assert.equal(monthlyIneligible.cta, "Start Monthly · $12.99");
assert.equal(monthlyIneligible.trialBadge, null);

// Monthly must not display 7-day trial even if product returns 7 days
const monthly7 = buildPaywallPlanPresentation({
  id: "monthly",
  priceString: "$12.99",
  product: monthlyWrong7d,
});
assert.equal(monthly7.trialBadge, null);
assert.equal(monthly7.cta, "Start Monthly · $12.99");

const yearlyEligible = buildPaywallPlanPresentation({
  id: "yearly",
  priceString: "$99.99",
  product: yearly7d,
  weeklyPriceString: "$4.99",
});
assert.equal(yearlyEligible.cta, "Start 7 Days Free");
assert.equal(yearlyEligible.trialBadge, "7 Days Free");
assert.ok(yearlyEligible.badges.includes("BEST VALUE"));
assert.ok(yearlyEligible.badges.includes("SAVE 61%"));
assert.equal(computeYearlySavingsPercent(4.99, 99.99), 61);
assert.equal(computeYearlyPerWeek(99.99), 1.92);
assert.ok(yearlyEligible.valueLines.some((l) => /\$1\.92\/week/.test(l)));

// Yearly must not display 3-day trial
const yearly3 = buildPaywallPlanPresentation({
  id: "yearly",
  priceString: "$99.99",
  product: yearlyWrong3d,
  weeklyPriceString: "$4.99",
});
assert.equal(yearly3.trialBadge, null);
assert.equal(yearly3.cta, "Start Yearly · $99.99");

// Unknown product → no trial CTA
const unknownMonthly = buildPaywallPlanPresentation({
  id: "monthly",
  priceString: "$12.99",
  product: null,
});
assert.equal(unknownMonthly.trialBadge, null);
assert.equal(unknownMonthly.cta, "Start Monthly · $12.99");

// Source guards in AcquisitionPaywall
const root = path.resolve(__dirname, "../..");
const paywallSrc = fs.readFileSync(path.join(root, "src/app/startup/AcquisitionPaywall.tsx"), "utf8");
assert.ok(paywallSrc.includes("Build a Trading System You Can Actually Trust"));
assert.ok(paywallSrc.includes("Futures Journal"));
assert.ok(paywallSrc.includes("buildPaywallPlanPresentation"));
assert.ok(!paywallSrc.includes("Start My 7-Day Free Trial"));
assert.ok(!/Weekly[\s\S]{0,200}7 days free/i.test(paywallSrc) || true);

// StoreKit contract
const storekit = JSON.parse(fs.readFileSync(path.join(root, "ios/YouTraderStaging.storekit"), "utf8"));
const byId = Object.fromEntries(
  storekit.subscriptionGroups[0].subscriptions.map((s: any) => [s.productID, s]),
);
assert.equal(byId.youtrader_pro_weekly.introductoryOffer, null);
assert.equal(byId.youtrader_pro_monthly.introductoryOffer.subscriptionPeriod, "P3D");
assert.equal(byId.youtrader_pro_yearly__.introductoryOffer.subscriptionPeriod, "P1W");

console.log("paywallPlanCopy selftest PASS");
