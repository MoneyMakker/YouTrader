/**
 * Pure entitlement → startup routing contract (no network / no Apple).
 */
// @ts-nocheck — executed via node --experimental-strip-types
import assert from "node:assert/strict";
import { resolveAcquisitionPhase } from "../src/app/startup/acquisitionState.ts";

const ready = {
  hydrated: true as const,
  onboardingCompleted: true as const,
  authRequired: true as const,
  revenueCatReady: true as const,
  paywallCompleted: false as const,
};

function run() {
  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      hasSession: true,
      isPremium: false,
    }),
    "main",
  );

  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      hasSession: true,
      isPremium: true,
    }),
    "main",
  );

  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      hasSession: false,
      isPremium: true,
    }),
    "auth",
  );

  assert.equal(
    resolveAcquisitionPhase({
      ...ready,
      hasSession: true,
      isPremium: false,
      revenueCatReady: false,
    }),
    "main",
  );

  assert.equal(
    resolveAcquisitionPhase({
      hydrated: true,
      onboardingCompleted: false,
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
