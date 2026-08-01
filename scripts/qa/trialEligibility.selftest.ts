/**
 * Update trialEligibility selftest for introDays + labels.
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

const free3 = {
  identifier: "m",
  introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: "DAY" },
} as any;
const m = resolveIntroTrialInfo(free3);
assert.equal(m.eligibility, "eligible");
assert.equal(m.introDays, 3);
assert.equal(m.periodLabel, "3 days free");

const free7 = {
  identifier: "y",
  introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: "DAY" },
} as any;
const y = resolveIntroTrialInfo(free7);
assert.equal(y.introDays, 7);
assert.equal(y.periodLabel, "7 days free");

// Deprecated helper still annualizes monthly×12; paywall SAVE% uses weekly×52.
assert.equal(yearlySavingsLabel(12.99, 99.99), "Save 36% vs monthly");

console.log("trialEligibility selftest PASS");
