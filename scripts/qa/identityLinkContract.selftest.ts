/**
 * Identity-linking acquisition contract (mocks only).
 * AUTH LINK CONTRACT PASS — LIVE PROVIDER E2E NOT RUN
 * Run: node --import tsx scripts/qa/identityLinkContract.selftest.ts
 */
import assert from "node:assert/strict";
import { resolveAcquisitionPhase, type AcquisitionInput } from "../../src/app/startup/acquisitionState";

type RcIdentity = { appUserId: string; isAnonymous: boolean; entitlementActive: boolean };
type AuthSession = { userId: string } | null;

function afterPurchaseAnonymous(entitlementActive: boolean): {
  phase: string;
  rc: RcIdentity;
  session: AuthSession;
} {
  const rc: RcIdentity = {
    appUserId: "anon_$RCAnonymousID:abc",
    isAnonymous: true,
    entitlementActive,
  };
  const session: AuthSession = null;
  const phase = resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: false,
    isPremium: entitlementActive,
    revenueCatReady: true,
  });
  return { phase, rc, session };
}

function linkIdentity(
  rc: RcIdentity,
  session: AuthSession,
  opts: { logInOk: boolean; cancel?: boolean; fail?: boolean } = { logInOk: true },
): {
  phase: string;
  rc: RcIdentity;
  session: AuthSession;
  entitlementPreserved: boolean;
} {
  if (opts.cancel || opts.fail) {
    // Remain on auth; entitlement retained on anonymous RC user
    return {
      phase: resolveAcquisitionPhase({
        hydrated: true,
        onboardingCompleted: true,
        paywallCompleted: true,
        authRequired: true,
        hasSession: false,
        isPremium: rc.entitlementActive,
        revenueCatReady: true,
      }),
      rc,
      session: null,
      entitlementPreserved: rc.entitlementActive,
    };
  }
  assert.ok(session, "session required for successful link");
  const linked: RcIdentity = opts.logInOk
    ? { appUserId: session!.userId, isAnonymous: false, entitlementActive: rc.entitlementActive }
    : rc;
  const phase = resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: true,
    isPremium: linked.entitlementActive,
    revenueCatReady: true,
  });
  return {
    phase,
    rc: linked,
    session,
    entitlementPreserved: linked.entitlementActive === rc.entitlementActive && linked.entitlementActive,
  };
}

function userCacheKey(userId: string, domain: "journal" | "stats" | "propPass" | "entitlement") {
  return `${domain}:${userId}`;
}

// Email / Apple / Google all share the same post-auth contract
for (const provider of ["email", "apple", "google"] as const) {
  const purchased = afterPurchaseAnonymous(true);
  assert.equal(purchased.phase, "auth", `${provider}: must auth after entitlement`);
  assert.equal(purchased.rc.isAnonymous, true);

  const linked = linkIdentity(purchased.rc, { userId: `user_${provider}_1` }, { logInOk: true });
  assert.equal(linked.phase, "main", `${provider}: main after link`);
  assert.equal(linked.entitlementPreserved, true);
  assert.equal(linked.rc.isAnonymous, false);
  assert.equal(linked.rc.appUserId, `user_${provider}_1`);
}

// Auth canceled / failed — stay on auth, keep entitlement
{
  const purchased = afterPurchaseAnonymous(true);
  const canceled = linkIdentity(purchased.rc, null, { logInOk: false, cancel: true });
  assert.equal(canceled.phase, "auth");
  assert.equal(canceled.entitlementPreserved, true);
  const failed = linkIdentity(purchased.rc, null, { logInOk: false, fail: true });
  assert.equal(failed.phase, "auth");
  assert.equal(failed.entitlementPreserved, true);
}

// Cold relaunch before auth
{
  const input: AcquisitionInput = {
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: true,
    authRequired: true,
    hasSession: false,
    isPremium: true,
    revenueCatReady: true,
  };
  assert.equal(resolveAcquisitionPhase(input), "auth");
}

// Cold relaunch after auth
{
  assert.equal(
    resolveAcquisitionPhase({
      hydrated: true,
      onboardingCompleted: true,
      paywallCompleted: true,
      authRequired: true,
      hasSession: true,
      isPremium: true,
      revenueCatReady: true,
    }),
    "main",
  );
}

// Logout → second user → no cache crossover → return
{
  const userA = "user_a";
  const userB = "user_b";
  const cache = new Map<string, string>();
  cache.set(userCacheKey(userA, "journal"), "trade-a");
  cache.set(userCacheKey(userA, "stats"), "stats-a");
  cache.set(userCacheKey(userA, "propPass"), "prop-a");
  cache.set(userCacheKey(userA, "entitlement"), "weekly");

  // logout clears session; entitlement may remain device-bound until RC logOut — product requires auth for Main
  assert.equal(
    resolveAcquisitionPhase({
      hydrated: true,
      onboardingCompleted: true,
      paywallCompleted: true,
      authRequired: true,
      hasSession: false,
      isPremium: true,
      revenueCatReady: true,
    }),
    "auth",
  );

  // switch to B — must not read A's namespaced cache
  assert.notEqual(cache.get(userCacheKey(userB, "journal")), "trade-a");
  assert.equal(cache.get(userCacheKey(userB, "journal")), undefined);
  assert.notEqual(cache.get(userCacheKey(userB, "stats")), "stats-a");
  assert.notEqual(cache.get(userCacheKey(userB, "propPass")), "prop-a");
  assert.notEqual(cache.get(userCacheKey(userB, "entitlement")), "weekly");

  // return to A
  assert.equal(cache.get(userCacheKey(userA, "journal")), "trade-a");
  assert.equal(cache.get(userCacheKey(userA, "entitlement")), "weekly");
}

// No entitlement → never main even with session
assert.equal(
  resolveAcquisitionPhase({
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: false,
    authRequired: true,
    hasSession: true,
    isPremium: false,
    revenueCatReady: true,
  }),
  "paywall",
);

console.log("identityLinkContract selftest AUTH LINK CONTRACT PASS (LIVE PROVIDER E2E NOT RUN)");
