/**
 * Run: npx tsx scripts/qa/stagingQaResetModes.selftest.ts
 */
import assert from "node:assert/strict";
import {
  parseStagingQaResetMode,
  stagingQaResetModeUi,
} from "../../src/qa/stagingQaResetModes";
import { shouldRunStagingQaReset } from "../../src/qa/stagingQaResetGates";
import { resolveAcquisitionPhase } from "../../src/app/startup/acquisitionState";
import { computeCalculatorResults } from "../../src/calc/riskCalculator";
import { evaluateAuthScreenReadiness } from "../../src/auth/authScreenReadiness";
import { planPendingOAuthClear } from "../../src/auth/pendingOAuthKeys";
import {
  STAGING_QA_RESET_SUCCESS_ORDER,
  assertResetPhaseTransition,
  a11yIdForResetPhase,
  createResetStatus,
  parseResetStatus,
  serializeResetStatus,
} from "../../src/qa/stagingQaResetState";

assert.equal(parseStagingQaResetMode("youtrader://qa/reset-auth"), "auth");
assert.equal(parseStagingQaResetMode("youtrader://qa/reset-fresh"), "fresh");
assert.equal(parseStagingQaResetMode("youtrader://qa/reset-paywall"), "paywall");
assert.equal(parseStagingQaResetMode("youtrader://qa/reset-returning-allow"), "returning-allow");
assert.equal(parseStagingQaResetMode("youtrader://qa/reset-returning-deny"), "returning-deny");
assert.equal(parseStagingQaResetMode("youtrader://qa/seed-trade"), null);

const authUi = stagingQaResetModeUi("auth");
assert.equal(authUi.onboardingCompleted, true);
assert.equal(authUi.paywallCompleted, true);
assert.equal(authUi.expectedPhase, "auth");

const freshUi = stagingQaResetModeUi("fresh");
assert.equal(freshUi.onboardingCompleted, false);
assert.equal(freshUi.expectedPhase, "onboarding");

assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    guestContinued: false,
      paywallCompleted: true,
    authRequired: true,
    hasSession: false,
    isPremium: false,
    revenueCatReady: true,
  }),
  "auth",
);

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

assert.equal(
  shouldRunStagingQaReset({
    env: { EXPO_PUBLIC_APP_ENV: "staging" },
    deepLinkUrl: "youtrader://qa/reset-auth",
  }),
  true,
);
assert.equal(
  shouldRunStagingQaReset({
    env: { EXPO_PUBLIC_APP_ENV: "production" },
    deepLinkUrl: "youtrader://qa/reset-auth",
  }),
  false,
);

const mes = { tickSize: 0.25, tickValue: 1.25, name: "Micro ES" };
const valid = computeCalculatorResults({
  mode: "ticks",
  amount: "20",
  contracts: "1",
  stopLoss: "20",
  takeProfit: "40",
  balance: "50000",
  riskPct: "1",
  instrument: mes,
});
assert.equal(valid.resultUsd, 25); // 20 * 1.25 * 1
assert.equal(valid.maxRiskUsd, 500);
assert.equal(valid.riskReward, 2);
assert.equal(valid.hasNaN, false);
assert.equal(valid.isFinite, true);

const zeroBal = computeCalculatorResults({
  mode: "ticks",
  amount: "10",
  contracts: "1",
  stopLoss: "0",
  takeProfit: "10",
  balance: "0",
  riskPct: "1",
  instrument: mes,
});
assert.equal(zeroBal.maxRiskUsd, 0);
assert.equal(zeroBal.riskUsd, 0);
assert.equal(zeroBal.riskReward, 0);

const invalid = computeCalculatorResults({
  mode: "ticks",
  amount: "abc",
  contracts: "1",
  stopLoss: "10",
  takeProfit: "20",
  balance: "10000",
  riskPct: "1",
  instrument: mes,
});
assert.ok(invalid.errors.includes("invalid_amount"));
assert.equal(invalid.hasNaN, true);

const negative = computeCalculatorResults({
  mode: "ticks",
  amount: "10",
  contracts: "-1",
  stopLoss: "10",
  takeProfit: "20",
  balance: "10000",
  riskPct: "1",
  instrument: mes,
});
assert.ok(negative.errors.includes("negative_contracts"));

const large = computeCalculatorResults({
  mode: "ticks",
  amount: "999999",
  contracts: "100",
  stopLoss: "999999",
  takeProfit: "999999",
  balance: "1000000000000",
  riskPct: "100",
  instrument: mes,
});
assert.equal(large.isFinite, true);
assert.equal(large.hasNaN, false);
assert.equal(large.maxRiskUsd, 1000000000000);

const ready = evaluateAuthScreenReadiness({
  startupResolverIdle: true,
  onboardingModalActive: false,
  paywallModalActive: false,
  asWebAuthSheetActive: false,
  oauthRequestPending: false,
  appleCtaMounted: true,
  googleCtaMounted: true,
  emailCtaMounted: true,
  buttonsEnabled: true,
  configurationBannerResolved: true,
});
assert.equal(ready.ready, true);

const blockedByOAuth = evaluateAuthScreenReadiness({
  ...{
    startupResolverIdle: true,
    onboardingModalActive: false,
    paywallModalActive: false,
    asWebAuthSheetActive: true,
    oauthRequestPending: false,
    appleCtaMounted: true,
    googleCtaMounted: true,
    emailCtaMounted: true,
    buttonsEnabled: true,
    configurationBannerResolved: true,
  },
});
assert.equal(blockedByOAuth.ready, false);
assert.ok(blockedByOAuth.blockers.includes("aswebauth_active"));

const oauthPlan = planPendingOAuthClear("sb-staging-auth-token");
assert.ok(oauthPlan.storageKeys.includes("sb-staging-auth-token-code-verifier"));
assert.equal(oauthPlan.dismissAuthSession, true);

// Scenario matrix (pure contracts): reset while sheet open / after cancel / invalid / success / repeat
for (const scenario of [
  "sheet_open",
  "after_cancel",
  "invalid_callback",
  "after_success",
  "repeated_reset",
] as const) {
  const plan = planPendingOAuthClear(`sb-${scenario}-auth-token`);
  assert.equal(plan.clearProviderBusy, true);
  assert.ok(plan.storageKeys.length >= 1);
}


const decimal = computeCalculatorResults({
  mode: "ticks",
  amount: "1.5",
  contracts: "2",
  stopLoss: "0.25",
  takeProfit: "1",
  balance: "10000.50",
  riskPct: "0.5",
  instrument: mes,
});
assert.equal(decimal.resultUsd, 3.75);
assert.equal(decimal.isFinite, true);

assert.equal(a11yIdForResetPhase("reset_complete"), "qa.reset.complete");
assert.equal(a11yIdForResetPhase("reset_failed"), "qa.reset.failed");
assert.equal(a11yIdForResetPhase("clearing_oauth_state"), "qa.reset.in-progress");
for (let i = 0; i < STAGING_QA_RESET_SUCCESS_ORDER.length - 1; i++) {
  assert.equal(
    assertResetPhaseTransition(
      STAGING_QA_RESET_SUCCESS_ORDER[i],
      STAGING_QA_RESET_SUCCESS_ORDER[i + 1],
    ),
    true,
  );
}
assert.equal(assertResetPhaseTransition("idle", "reset_requested"), true);
assert.equal(assertResetPhaseTransition("reset_requested", "persisted"), false);
const snap = createResetStatus("reset_complete", "auth");
assert.equal(parseResetStatus(serializeResetStatus(snap))?.phase, "reset_complete");

console.log("stagingQaResetModes + riskCalculator + auth readiness + reset state selftest PASS");
