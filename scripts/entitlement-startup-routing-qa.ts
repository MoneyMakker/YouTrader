/**
 * Pure entitlement → startup routing contract (no network / no Apple).
 * Complements acquisition-state-qa + entitlement-resolution-qa.
 */
// @ts-nocheck — executed via node --experimental-strip-types
import assert from "node:assert/strict";
import { resolveAcquisitionPhase } from "../src/app/startup/acquisitionState.ts";

const ready = {
  hydrated: true as const,
  onboardingCompleted: true as const,
  authRequired: true as const,
  revenueCatReady: true as const,
};

function run() {
  // Failed / cancelled purchase: no entitlement → paywall when session exists
  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      guestContinued: false,
      paywallCompleted: false,
      hasSession: true,
      isPremium: false,
    }),
    "paywall",
  );

  // Active entitlement (monthly or yearly — same isPremium flag) → main
  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      guestContinued: false,
      paywallCompleted: false,
      hasSession: true,
      isPremium: true,
    }),
    "main",
  );

  // Anonymous entitled before auth → auth (not main)
  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      guestContinued: false,
      paywallCompleted: false,
      hasSession: false,
      isPremium: true,
    }),
    "auth",
  );

  // Restore / RC not ready yet → loading (no false unlock flash)
  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      guestContinued: false,
      paywallCompleted: false,
      hasSession: true,
      isPremium: false,
      revenueCatReady: false,
    }),
    "loading",
  );

  // Expiration: premium lost → paywall again
  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      guestContinued: false,
      paywallCompleted: false,
      hasSession: true,
      isPremium: false,
    }),
    "paywall",
  );

  // Second user after logout: no session → onboarding/paywall/auth path, not main
  assert.equal(
    resolveAcquisitionPhase({
      hydrated: true,
      onboardingCompleted: false,
      guestContinued: false,
      paywallCompleted: false,
      authRequired: true,
      hasSession: false,
      isPremium: false,
      revenueCatReady: true,
    }),
    "onboarding",
  );

  console.log("entitlement-startup-routing-qa: PASS");
}

run();
