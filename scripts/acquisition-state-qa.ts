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
    "paywall",
    "no free bypass — entitlement required",
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
        isPremium: false,
      }),
    ),
    "main",
    "authenticated without entitlement enters four-tab main",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({
        onboardingCompleted: true,
        paywallCompleted: true,
        hasSession: true,
        isPremium: true,
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
        isPremium: true,
      }),
    ),
    "main",
  );
  // Authenticated without onboarding flag → paywall or main, never onboarding
  assert.notEqual(
    resolveAcquisitionPhase(
      base({ onboardingCompleted: false, hasSession: true }),
    ),
    "onboarding",
  );

  const buggyPostReset = base({
    hydrated: false,
    onboardingCompleted: false,
    paywallCompleted: false,
    hasSession: false,
  });
  assert.equal(resolveAcquisitionPhase(buggyPostReset), "loading");
  assert.equal(isStuckAcquisitionLoading(buggyPostReset), true);

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
  );

  console.log("acquisition-state-qa: PASS");
}

run();
