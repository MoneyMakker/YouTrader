/**
 * Explicit logout → AUTH_REQUIRED routing regression suite.
 * Run: node --import tsx scripts/qa/explicitLogoutRouting.selftest.ts
 */
import assert from "node:assert/strict";
import {
  resolveAcquisitionPhase,
  resolveReleaseGateState,
  mergeExplicitAuthRequiredFlag,
  shouldClearExplicitAuthRequiredOnSessionChange,
  type AcquisitionInput,
} from "../../src/app/startup/acquisitionState";
import {
  beginExplicitLogoutGuard,
  decidePostLoginNavigation,
  endExplicitLogoutGuard,
  planExplicitLogout,
  shouldCallRevenueCatLogOut,
  transitionRevenueCatIdentity,
} from "../../src/auth/explicitLogout";
import { shouldClearLocalUserCacheKey } from "../../src/auth/userCache";

function base(over: Partial<AcquisitionInput> = {}): AcquisitionInput {
  return {
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: true,
    isPremium: true,
    revenueCatReady: true,
    ...over,
  };
}

const phases: string[] = [];
function recordPhase(input: AcquisitionInput) {
  const phase = resolveAcquisitionPhase(input);
  phases.push(phase);
  return phase;
}

// Paid user logout → authentication screen (never paywall)
{
  phases.length = 0;
  const logging = base({ hasSession: true, isPremium: true, loggingOut: true });
  assert.equal(recordPhase(logging), "loading", "LOGGING_OUT suppresses UI flash");
  assert.equal(resolveReleaseGateState(logging), "LOGGING_OUT");

  const after = base({
    hasSession: false,
    isPremium: false,
    loggingOut: false,
    explicitAuthRequired: true,
  });
  assert.equal(recordPhase(after), "auth", "paid logout → auth chooser");
  assert.equal(resolveReleaseGateState(after), "AUTH_REQUIRED");
  assert.ok(!phases.includes("paywall"), "no paywall flash during logout");
}

// Entitlement still on device after logout still routes to auth, not main/paywall
{
  assert.equal(
    resolveAcquisitionPhase(
      base({
        hasSession: false,
        isPremium: true,
        explicitAuthRequired: true,
      }),
    ),
    "auth",
  );
}

// Navigation reset: authenticated root cannot remain after logout
{
  const before = resolveAcquisitionPhase(base({ hasSession: true, isPremium: true }));
  assert.equal(before, "main");
  const after = resolveAcquisitionPhase(
    base({ hasSession: false, isPremium: false, explicitAuthRequired: true }),
  );
  assert.equal(after, "auth");
  assert.notEqual(after, "main");
}

// Double-tap logout
{
  const guard = { current: false };
  assert.equal(beginExplicitLogoutGuard(guard), true);
  assert.equal(beginExplicitLogoutGuard(guard), false, "second tap ignored");
  endExplicitLogoutGuard(guard);
  assert.equal(beginExplicitLogoutGuard(guard), true);
  endExplicitLogoutGuard(guard);
}

// App restart after logout — sticky AUTH_REQUIRED
{
  const restarted = base({
    hasSession: false,
    isPremium: false,
    explicitAuthRequired: true,
    revenueCatReady: true,
  });
  assert.equal(resolveAcquisitionPhase(restarted), "auth");
  assert.equal(resolveReleaseGateState(restarted), "AUTH_REQUIRED");
}

// Hydrate race: storage not yet flushed, but in-memory sticky must win while signed out
{
  assert.equal(
    mergeExplicitAuthRequiredFlag({ hasSession: false, storageSticky: false, previous: true }),
    true,
    "in-memory AUTH_REQUIRED survives storage lag",
  );
  assert.equal(
    mergeExplicitAuthRequiredFlag({ hasSession: false, storageSticky: true, previous: false }),
    true,
    "storage sticky survives cold start",
  );
  assert.equal(
    mergeExplicitAuthRequiredFlag({ hasSession: true, storageSticky: true, previous: true }),
    false,
    "successful login clears sticky",
  );
  assert.equal(
    resolveAcquisitionPhase(
      base({
        hasSession: false,
        isPremium: false,
        explicitAuthRequired: mergeExplicitAuthRequiredFlag({
          hasSession: false,
          storageSticky: false,
          previous: true,
        }),
      }),
    ),
    "auth",
    "lagging storage must not flash paywall after logout",
  );
}

// Sticky must NOT clear when logout sets AUTH_REQUIRED while session still present
{
  assert.equal(
    shouldClearExplicitAuthRequiredOnSessionChange({
      explicitAuthRequired: true,
      loggingOut: false,
      previousUserId: "user-a",
      nextUserId: "user-a",
    }),
    false,
    "setting sticky mid-session (logout start) must not clear it",
  );
  assert.equal(
    shouldClearExplicitAuthRequiredOnSessionChange({
      explicitAuthRequired: true,
      loggingOut: true,
      previousUserId: "user-a",
      nextUserId: "user-a",
    }),
    false,
    "LOGGING_OUT blocks sticky clear",
  );
  assert.equal(
    shouldClearExplicitAuthRequiredOnSessionChange({
      explicitAuthRequired: true,
      loggingOut: false,
      previousUserId: null,
      nextUserId: "user-b",
    }),
    true,
    "login transition signed-out → signed-in clears sticky",
  );
  assert.equal(
    shouldClearExplicitAuthRequiredOnSessionChange({
      explicitAuthRequired: true,
      loggingOut: false,
      previousUserId: "user-a",
      nextUserId: null,
    }),
    false,
    "session cleared after logout keeps sticky",
  );
}

// Login again with same account → CustomerInfo → main when entitled
{
  assert.equal(
    decidePostLoginNavigation({
      customerInfoReady: true,
      networkError: false,
      entitlementActive: true,
    }),
    "main",
  );
  assert.equal(
    resolveAcquisitionPhase(base({ hasSession: true, isPremium: true, explicitAuthRequired: false })),
    "main",
  );
}

// Login with another account — identity transition + no cache crossover
{
  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";
  const id = transitionRevenueCatIdentity({
    beforeUserId: userA,
    afterUserId: userB,
    logInCalls: 1,
  });
  assert.equal(id.switched, true);
  assert.equal(id.logInCalls, 2);
  assert.equal(id.appUserId, userB);

  assert.equal(shouldClearLocalUserCacheKey(`trades-v7:${userA}`, userA), true);
  assert.equal(shouldClearLocalUserCacheKey(`trades-v7:${userA}`, userB), false);
  assert.equal(shouldClearLocalUserCacheKey("prop-risk-template-v1", userA), true);
  assert.equal(shouldClearLocalUserCacheKey("prop-risk-mode-v2", null), true);
}

// CustomerInfo refresh / loading — never false paywall
{
  assert.equal(
    decidePostLoginNavigation({
      customerInfoReady: false,
      networkError: false,
      entitlementActive: null,
    }),
    "loading",
  );
  assert.equal(
    decidePostLoginNavigation({
      customerInfoReady: true,
      networkError: true,
      entitlementActive: null,
    }),
    "retry",
  );
  assert.equal(
    decidePostLoginNavigation({
      customerInfoReady: true,
      networkError: false,
      entitlementActive: false,
    }),
    "paywall",
  );
}

// RevenueCat identity: logOut once when required
{
  assert.equal(shouldCallRevenueCatLogOut({ purchasesConfigured: true, isAnonymous: false }), true);
  assert.equal(shouldCallRevenueCatLogOut({ purchasesConfigured: true, isAnonymous: true }), false);
  assert.equal(shouldCallRevenueCatLogOut({ purchasesConfigured: false, isAnonymous: false }), false);
}

// Cache clearing plan includes journal + analytics reset; preserves StoreKit
{
  const plan = planExplicitLogout();
  assert.equal(plan.navigationRoot, "AUTH_REQUIRED");
  assert.equal(plan.suppressPaywall, true);
  assert.equal(plan.preserveStoreKitReceipt, true);
  assert.equal(plan.revenueCatLogOutOnce, true);
  assert.equal(plan.clearInMemoryJournal, true);
  assert.equal(plan.clearLocalUserCache, true);
}

// Background/foreground during logout — LOGGING_OUT stays loading
{
  const mid = base({ loggingOut: true, hasSession: false, isPremium: false });
  assert.equal(resolveAcquisitionPhase(mid), "loading");
  assert.equal(resolveReleaseGateState(mid), "LOGGING_OUT");
}

// Supabase / RevenueCat recoverable errors — stay on AUTH_REQUIRED after logout completes
{
  const recovered = base({
    hasSession: false,
    isPremium: false,
    explicitAuthRequired: true,
    identitySyncFailed: false,
  });
  assert.equal(resolveAcquisitionPhase(recovered), "auth");
  // Identity sync failure only applies when authenticated
  assert.equal(
    resolveReleaseGateState(base({ hasSession: true, identitySyncFailed: true })),
    "RECOVERABLE_ERROR",
  );
}

// Fresh acquisition without explicit logout still uses paywall
{
  assert.equal(
    resolveAcquisitionPhase(
      base({
        hasSession: false,
        isPremium: false,
        explicitAuthRequired: false,
        onboardingCompleted: true,
      }),
    ),
    "paywall",
  );
}

console.log("explicitLogoutRouting selftest: PASS");
