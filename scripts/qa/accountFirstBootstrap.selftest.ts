/**
 * Account-first bootstrap / navigation / restore contract matrix.
 * Run: npx tsx scripts/qa/accountFirstBootstrap.selftest.ts
 */
import assert from "node:assert/strict";
import {
  resolveAcquisitionPhase,
  resolveReleaseGateState,
  type AcquisitionInput,
} from "../../src/app/startup/acquisitionState";
import {
  decidePostLoginEntitlementReconcile,
  decideEntitlementUiPhase,
  isActiveEntitlement,
} from "../../src/billing/entitlementReconcile";
import {
  decidePostLoginNavigation,
  planExplicitLogout,
  shouldCallRevenueCatLogOut,
  transitionRevenueCatIdentity,
} from "../../src/auth/explicitLogout";
import {
  isSupabaseUuidAppUserId,
  RevenueCatIdentitySynchronizer,
} from "../../src/billing/revenueCatIdentity";

function input(over: Partial<AcquisitionInput> = {}): AcquisitionInput {
  return {
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: false,
    authRequired: true,
    hasSession: false,
    isPremium: false,
    revenueCatReady: true,
    ...over,
  };
}

async function main() {

// BOOTSTRAP
assert.equal(resolveAcquisitionPhase(input({ onboardingCompleted: false })), "onboarding");
assert.equal(resolveAcquisitionPhase(input()), "auth");
assert.equal(
  resolveAcquisitionPhase(input({ hasSession: true, isPremium: true })),
  "main",
);
assert.equal(
  resolveAcquisitionPhase(input({ hasSession: true, isPremium: false })),
  "paywall",
);
assert.equal(
  resolveAcquisitionPhase(input({ hasSession: true, identitySyncPending: true, isPremium: true })),
  "loading",
);
assert.equal(
  resolveAcquisitionPhase(input({ hasSession: true, identitySyncFailed: true })),
  "loading",
);
assert.equal(
  resolveReleaseGateState(input({ hasSession: true, identitySyncFailed: true })),
  "RECOVERABLE_ERROR",
);

// AUTH routing — never paywall without session
assert.notEqual(resolveAcquisitionPhase(input({ isPremium: true })), "paywall");
assert.notEqual(resolveAcquisitionPhase(input({ isPremium: true })), "main");

// IDENTITY
assert.equal(isSupabaseUuidAppUserId("2fb97295-edc2-4969-9d6a-4ea92a39dfc5"), true);
assert.equal(isSupabaseUuidAppUserId("trader@example.com"), false);
assert.equal(isSupabaseUuidAppUserId("anonymous"), false);
assert.equal(isSupabaseUuidAppUserId("guest"), false);

{
  let configured = false;
  let current = "stale-a";
  let loginCalls = 0;
  const sync = new RevenueCatIdentitySynchronizer<{ id: string }>(
    {
      getAppUserID: async () => current,
      getCustomerInfo: async () => ({ id: current }),
      logIn: async (id) => {
        loginCalls += 1;
        current = id;
        return { customerInfo: { id } };
      },
    },
    { isConfigured: () => configured },
  );
  await (async () => {
    const before = await sync.synchronize("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    assert.equal(before.status, "skipped_not_configured");
    configured = true;
    const a = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const b = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const toA = await sync.synchronize(a);
    assert.equal(toA.status, "synced");
    assert.equal(loginCalls, 1);
    const toB = await sync.synchronize(b);
    assert.equal(toB.status, "synced");
    assert.equal(toB.customerInfo?.id, b);
    assert.equal(loginCalls, 2);
    assert.notEqual(toB.customerInfo?.id, a);
  })();
}

// LOGOUT
{
  const plan = planExplicitLogout();
  assert.equal(plan.revenueCatLogOutOnce, false);
  assert.equal(plan.clearLocalCustomerInfo, true);
  assert.equal(plan.navigationRoot, "AUTH_REQUIRED");
  assert.equal(shouldCallRevenueCatLogOut({ purchasesConfigured: true, isAnonymous: false }), false);
  assert.equal(
    resolveAcquisitionPhase(input({ explicitAuthRequired: true, hasSession: false })),
    "auth",
  );
}

{
  const switched = transitionRevenueCatIdentity({
    beforeUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    afterUserId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    logInCalls: 0,
  });
  assert.equal(switched.switched, true);
  assert.equal(switched.logInCalls, 1);
}

// PURCHASE / ENTITLEMENT decisions
assert.equal(
  decidePostLoginEntitlementReconcile({ postLoginEntitled: true }).action,
  "confirmed_entitled",
);
assert.equal(
  decidePostLoginEntitlementReconcile({ postLoginEntitled: false }).action,
  "confirmed_not_entitled",
);
assert.equal(
  decidePostLoginNavigation({
    customerInfoReady: true,
    networkError: false,
    entitlementActive: true,
  }),
  "main",
);
assert.equal(
  decidePostLoginNavigation({
    customerInfoReady: true,
    networkError: false,
    entitlementActive: false,
  }),
  "paywall",
);
assert.equal(
  decidePostLoginNavigation({
    customerInfoReady: false,
    networkError: true,
    entitlementActive: null,
  }),
  "retry",
);
assert.equal(
  isActiveEntitlement({ entitlements: { active: { "YouTrader Pro": { isActive: true } } } }, "YouTrader Pro"),
  true,
);
assert.equal(
  decideEntitlementUiPhase({ identitySyncPending: false, identitySyncFailed: false, isPro: false }),
  "inactive",
);

// Unauthenticated deep-link destinations collapse to Auth via acquisition phase
assert.equal(resolveAcquisitionPhase(input()), "auth");


  console.log("accountFirstBootstrap selftest PASS");
}

void main();
