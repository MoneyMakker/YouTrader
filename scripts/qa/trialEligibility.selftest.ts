/**
 * Trial eligibility resolver selftest.
 * Run: npx tsx scripts/qa/trialEligibility.selftest.ts
 */
import assert from "node:assert/strict";
import {
  resolveIntroTrialInfo,
  yearlySavingsLabel,
} from "../../src/app/startup/trialEligibility";

assert.equal(resolveIntroTrialInfo(null).eligibility, "unknown");
assert.equal(resolveIntroTrialInfo(undefined, { checkFailed: true }).eligibility, "failed");

const noIntro = { identifier: "x", introPrice: null } as any;
assert.equal(resolveIntroTrialInfo(noIntro).eligibility, "ineligible");

const freeWeek = {
  identifier: "y",
  introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;
const free = resolveIntroTrialInfo(freeWeek);
assert.equal(free.eligibility, "eligible");
assert.equal(free.hasFreeIntro, true);
assert.equal(free.periodLabel, "7 days free");

const paidIntro = {
  identifier: "z",
  introPrice: { price: 0.99, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;
assert.equal(resolveIntroTrialInfo(paidIntro).eligibility, "ineligible");

assert.equal(yearlySavingsLabel(12.99, 99.99), "Save 36% vs monthly");
assert.equal(yearlySavingsLabel(0, 99.99), null);

console.log("trialEligibility selftest PASS");
