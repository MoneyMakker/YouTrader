/**
 * First-launch acquisition resolver — Node selftest.
 * Run: npx tsx scripts/qa/acquisitionPhase.selftest.ts
 */
import assert from "node:assert/strict";
import {
  resolveAcquisitionPhase,
  type AcquisitionInput,
} from "../../src/app/startup/acquisitionState";
import {
  buildPersonalizedValueBullets,
  defaultOnboardingProfile,
  parseOnboardingProfile,
} from "../../src/app/startup/onboardingProfile";

const base: AcquisitionInput = {
  hydrated: true,
  onboardingCompleted: false,
  paywallCompleted: false,
  authRequired: true,
  hasSession: false,
  isPremium: false,
  revenueCatReady: true,
};

assert.equal(resolveAcquisitionPhase({ ...base, hydrated: false }), "loading");
assert.equal(resolveAcquisitionPhase(base), "onboarding");
assert.equal(
  resolveAcquisitionPhase({ ...base, onboardingCompleted: true }),
  "paywall",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    paywallCompleted: true,
  }),
  "paywall",
  "paywallCompleted alone must not unlock Main App without entitlement",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    paywallCompleted: true,
    isPremium: true,
  }),
  "auth",
  "purchase-before-auth must force registration",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    isPremium: true,
    paywallCompleted: false,
  }),
  "auth",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    hasSession: true,
    paywallCompleted: true,
    isPremium: false,
  }),
  "paywall",
  "authenticated without entitlement stays on paywall",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    hasSession: true,
    paywallCompleted: true,
    isPremium: true,
  }),
  "main",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    revenueCatReady: false,
  }),
  "loading",
);

const profile = defaultOnboardingProfile({
  instruments: ["MES"],
  session: "ny_am",
  style: "intraday",
  propChallenge: true,
});
const bullets = buildPersonalizedValueBullets(profile);
assert.ok(bullets.length >= 3);
assert.ok(bullets.some((b) => /New York AM/i.test(b)));
assert.ok(!bullets.some((b) => /\bAI\b/i.test(b)));
assert.ok(parseOnboardingProfile(profile)?.version === 1);
assert.equal(parseOnboardingProfile({ version: 99 }), null);

console.log("acquisitionPhase + onboardingProfile selftest PASS");
