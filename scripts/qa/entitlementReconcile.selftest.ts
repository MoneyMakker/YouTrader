/**
 * Post-login entitlement reconciliation — Node selftest (account-first).
 * Run: npx tsx scripts/qa/entitlementReconcile.selftest.ts
 */
import assert from "node:assert/strict";
import {
  decideAfterLoginCustomerInfoRefresh,
  decideEntitlementUiPhase,
  decidePostLoginEntitlementReconcile,
  isActiveEntitlement,
} from "../../src/billing/entitlementReconcile";
import {
  resolveAcquisitionPhase,
  resolveReleaseGateState,
} from "../../src/app/startup/acquisitionState";
import {
  mapIntroEligibilityStatus,
  resolvePlanTrialPresentation,
} from "../../src/billing/trialEligibilityPresentation";

assert.equal(
  decidePostLoginEntitlementReconcile({
    preAuthEntitled: true,
    postLoginEntitled: true,
    restoreAlreadyAttempted: false,
  }).action,
  "confirmed_entitled",
);
assert.equal(
  decidePostLoginEntitlementReconcile({
    preAuthEntitled: true,
    postLoginEntitled: false,
    restoreAlreadyAttempted: false,
  }).action,
  "confirmed_not_entitled",
  "pre-auth entitled flag must never trigger automatic restore",
);
assert.equal(
  decidePostLoginEntitlementReconcile({
    preAuthEntitled: false,
    postLoginEntitled: false,
    restoreAlreadyAttempted: false,
    sameUserWasEntitledAtLogout: true,
  }).action,
  "confirmed_not_entitled",
  "same-account re-login must not auto-restore",
);
assert.equal(
  decidePostLoginEntitlementReconcile({
    preAuthEntitled: false,
    postLoginEntitled: false,
    restoreAlreadyAttempted: false,
    sameUserWasEntitledAtLogout: false,
  }).action,
  "confirmed_not_entitled",
);
assert.equal(
  decidePostLoginEntitlementReconcile({
    preAuthEntitled: true,
    postLoginEntitled: false,
    restoreAlreadyAttempted: true,
  }).action,
  "confirmed_not_entitled",
  "restoreAlreadyAttempted is ignored — never fail_closed via auto restore",
);
assert.equal(
  decidePostLoginEntitlementReconcile({
    preAuthEntitled: false,
    postLoginEntitled: true,
    restoreAlreadyAttempted: false,
  }).action,
  "confirmed_entitled",
  "existing entitled user login unlocks without Restore",
);

assert.equal(
  decideAfterLoginCustomerInfoRefresh({ logInEntitled: false, refreshedEntitled: true }),
  "confirmed_entitled",
);
assert.equal(
  decideAfterLoginCustomerInfoRefresh({ logInEntitled: false, refreshedEntitled: false }),
  "still_not_entitled",
);

assert.equal(
  decideEntitlementUiPhase({ identitySyncPending: true, identitySyncFailed: false, isPro: false }),
  "loading",
  "CustomerInfo loading must not emit false paywall",
);
assert.equal(
  decideEntitlementUiPhase({ identitySyncPending: false, identitySyncFailed: true, isPro: false }),
  "retry",
  "CustomerInfo network failure → retry",
);
assert.equal(
  decideEntitlementUiPhase({ identitySyncPending: false, identitySyncFailed: false, isPro: true }),
  "entitled",
);
assert.equal(
  decideEntitlementUiPhase({ identitySyncPending: false, identitySyncFailed: false, isPro: false }),
  "inactive",
);

assert.equal(
  isActiveEntitlement({ entitlements: { active: { "YouTrader Pro": {} } } }, "YouTrader Pro"),
  true,
);
assert.equal(isActiveEntitlement({ entitlements: { active: {} } }, "YouTrader Pro"), false);

assert.equal(mapIntroEligibilityStatus("INTRO_ELIGIBILITY_STATUS_ELIGIBLE"), "eligible");
assert.equal(mapIntroEligibilityStatus("INTRO_ELIGIBILITY_STATUS_INELIGIBLE"), "ineligible");
assert.equal(mapIntroEligibilityStatus("INTRO_ELIGIBILITY_STATUS_UNKNOWN"), "unknown");

const weekly = resolvePlanTrialPresentation({ plan: "weekly", product: null, eligibilityStatus: "INTRO_ELIGIBILITY_STATUS_ELIGIBLE" });
assert.equal(weekly.showTrialCopy, false);

const monthlyUnknown = resolvePlanTrialPresentation({
  plan: "monthly",
  product: { introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: "DAY" } } as any,
});
assert.equal(monthlyUnknown.showTrialCopy, false, "unknown eligibility must not advertise trial");

const monthlyEligible = resolvePlanTrialPresentation({
  plan: "monthly",
  product: { introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: "DAY" } } as any,
  eligibilityStatus: "INTRO_ELIGIBILITY_STATUS_ELIGIBLE",
});
assert.equal(monthlyEligible.showTrialCopy, true);
assert.equal(monthlyEligible.introDays, 3);

assert.equal(
  resolveReleaseGateState({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: false,
    authRequired: true,
    hasSession: false,
    isPremium: true,
    revenueCatReady: true,
  }),
  "UNAUTHENTICATED",
);
assert.equal(
  resolveReleaseGateState({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: true,
    isPremium: false,
    revenueCatReady: true,
  }),
  "AUTHENTICATED_NOT_ENTITLED",
);
assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: true,
    isPremium: false,
    revenueCatReady: true,
  }),
  "paywall",
);

console.log("entitlementReconcile + releaseGate + trialPresentation selftest PASS");
