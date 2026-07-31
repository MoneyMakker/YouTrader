import assert from "node:assert/strict";
import {
  resolveAcquisitionPhase,
  type AcquisitionInput,
} from "../src/app/startup/acquisitionState";

function base(over: Partial<AcquisitionInput> = {}): AcquisitionInput {
  return {
    hydrated: true,
    onboardingCompleted: false,
    paywallCompleted: false,
    authRequired: true,
    hasSession: false,
    isPremium: false,
    revenueCatReady: true,
    ...over,
  };
}

function run() {
  assert.equal(resolveAcquisitionPhase(base({ hydrated: false })), "loading");
  assert.equal(resolveAcquisitionPhase(base()), "onboarding");
  assert.equal(
    resolveAcquisitionPhase(base({ onboardingCompleted: true })),
    "paywall",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({ onboardingCompleted: true, revenueCatReady: false }),
    ),
    "loading",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({ onboardingCompleted: true, paywallCompleted: true }),
    ),
    "auth",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({
        onboardingCompleted: true,
        paywallCompleted: false,
        isPremium: true,
      }),
    ),
    "auth",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({
        onboardingCompleted: true,
        paywallCompleted: true,
        hasSession: true,
      }),
    ),
    "main",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({
        onboardingCompleted: true,
        paywallCompleted: false,
        hasSession: true,
        isPremium: false,
      }),
    ),
    "paywall",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({
        onboardingCompleted: true,
        paywallCompleted: false,
        hasSession: true,
        isPremium: true,
      }),
    ),
    "main",
  );
  // Grandfather: authenticated without onboarding flag → paywall or main, never onboarding
  assert.notEqual(
    resolveAcquisitionPhase(
      base({ onboardingCompleted: false, hasSession: true }),
    ),
    "onboarding",
  );
  console.log("acquisition-state-qa: PASS");
}

run();
