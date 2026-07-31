import assert from "node:assert/strict";
import {
  isStuckAcquisitionLoading,
  resolveAcquisitionPhase,
  stagingQaResetAcquisitionUi,
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

  // --- QA reset hang regression ---
  // Bug: after reset with session already null, flipping hydrated→false sticks forever.
  const buggyPostReset = base({
    hydrated: false,
    onboardingCompleted: false,
    paywallCompleted: false,
    hasSession: false,
  });
  assert.equal(
    resolveAcquisitionPhase(buggyPostReset),
    "loading",
    "buggy post-reset flags must reproduce Loading your journal",
  );
  assert.equal(
    isStuckAcquisitionLoading(buggyPostReset),
    true,
    "hydrated=false signed-out is the stuck class",
  );

  const fixed = stagingQaResetAcquisitionUi();
  assert.equal(fixed.session, null);
  assert.equal(fixed.onboardingCompleted, false);
  assert.equal(fixed.paywallCompleted, false);
  assert.equal(fixed.acquisitionHydrated, true);
  assert.equal(
    resolveAcquisitionPhase(
      base({
        hydrated: fixed.acquisitionHydrated,
        onboardingCompleted: fixed.onboardingCompleted,
        paywallCompleted: fixed.paywallCompleted,
        hasSession: false,
      }),
    ),
    "onboarding",
    "fixed post-reset must enter onboarding, not loading",
  );
  assert.equal(
    isStuckAcquisitionLoading(
      base({
        hydrated: fixed.acquisitionHydrated,
        onboardingCompleted: fixed.onboardingCompleted,
        paywallCompleted: fixed.paywallCompleted,
        hasSession: false,
      }),
    ),
    false,
  );

  console.log("acquisition-state-qa: PASS");
}

run();
