/**
 * Account-first acquisition resolver — Node selftest.
 * Run: npx tsx scripts/qa/acquisitionPhase.selftest.ts
 */
import assert from "node:assert/strict";
import {
  resolveAcquisitionPhase,
  resolveReleaseGateState,
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
  "auth",
  "no session after onboarding → Auth, never Paywall",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    paywallCompleted: true,
  }),
  "auth",
  "paywallCompleted alone must not unlock Main or Paywall without session",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    paywallCompleted: true,
    isPremium: true,
  }),
  "auth",
  "anonymous premium flag must never skip Auth",
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
  "authenticated without entitlement → Paywall",
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
    hasSession: true,
    identitySyncPending: true,
    isPremium: true,
  }),
  "loading",
  "identity sync pending must not flash Journal or Paywall",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    hasSession: true,
    identitySyncFailed: true,
    isPremium: false,
  }),
  "loading",
  "identity sync failure → retry loading, not false Paywall",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    hasSession: true,
    revenueCatReady: false,
  }),
  "loading",
);
assert.equal(
  resolveAcquisitionPhase({
    ...base,
    onboardingCompleted: true,
    loggingOut: true,
    hasSession: false,
  }),
  "loading",
);

assert.equal(
  resolveReleaseGateState({
    ...base,
    onboardingCompleted: true,
    hasSession: false,
  }),
  "UNAUTHENTICATED",
);
assert.equal(
  resolveReleaseGateState({
    ...base,
    onboardingCompleted: true,
    hasSession: true,
    isPremium: false,
  }),
  "AUTHENTICATED_NOT_ENTITLED",
);
assert.equal(
  resolveReleaseGateState({
    ...base,
    onboardingCompleted: true,
    hasSession: true,
    isPremium: true,
  }),
  "AUTHENTICATED_ENTITLED",
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
