import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helperModule = await import(new URL("../../supabase/functions/_shared/revenueCatEntitlement.ts", import.meta.url).href);
const { resolveServerProEntitlement } = helperModule;

const NOW = Date.parse("2026-07-26T12:00:00.000Z");

function revenueCatResponse({
  expires = "2026-08-26T12:00:00.000Z",
  gracePeriodExpires = null,
  refundedAt = null,
  productId = "youtrader_pro_monthly",
  includeEntitlement = true,
} = {}) {
  return new Response(JSON.stringify({
    subscriber: {
      entitlements: includeEntitlement ? {
        pro: {
          expires_date: expires,
          grace_period_expires_date: gracePeriodExpires,
          product_identifier: productId,
        },
      } : {},
      subscriptions: productId ? {
        [productId]: {
          refunded_at: refundedAt,
          grace_period_expires_date: gracePeriodExpires,
        },
      } : {},
    },
  }), { status: 200 });
}

const PRODUCTION_SUBSCRIPTION_COLUMNS = [
  "user_id", "provider", "entitlement_id", "product_id", "status",
  "original_transaction_id", "expires_at", "last_verified_at", "created_at", "updated_at",
];
const PRODUCTION_STATUSES = new Set(["active", "trialing", "grace_period", "expired", "canceled", "billing_retry"]);

function mockAdmin(initial, options = {}) {
  let row = initial;
  const queries = [];
  const upserts = [];
  const query = {
    eq(field, value) {
      queries.push({ field, value });
      return query;
    },
    async maybeSingle() {
      return { data: row, error: null };
    },
  };
  return {
    client: {
      from() {
        return {
          select(columns) {
            queries.push({ select: columns });
            return query;
          },
          async upsert(value, upsertOptions) {
            const unknownColumns = Object.keys(value).filter((column) => !PRODUCTION_SUBSCRIPTION_COLUMNS.includes(column));
            assert.deepEqual(unknownColumns, [], "upsert references only production user_subscriptions columns");
            assert.equal(value.provider, "revenuecat", "production provider is required");
            assert.equal(typeof value.product_id, "string", "production product_id is required");
            assert.ok(PRODUCTION_STATUSES.has(value.status), "production status check accepts the persisted status");
            assert.deepEqual(upsertOptions, { onConflict: "user_id,entitlement_id" });
            upserts.push({ value, upsertOptions });
            options.onUpsert?.(value, upsertOptions);
            if (!options.upsertError) {
              row = {
                status: String(value.status || ""),
                expires_at: typeof value.expires_at === "string" ? value.expires_at : null,
                last_verified_at: typeof value.last_verified_at === "string" ? value.last_verified_at : null,
              };
            }
            return { error: options.upsertError || null };
          },
        };
      },
    },
    queries,
    upserts,
  };
}

function dependencies(fetchImpl, timeoutMs = 20) {
  return {
    env: (name) => name === "REVENUECAT_SECRET_KEY" ? "test-secret" : name === "REVENUECAT_ENTITLEMENT_ID" ? "pro" : "",
    fetch: fetchImpl,
    now: () => NOW,
    timeoutMs,
  };
}

async function resolve(row, fetchImpl, options, timeoutMs) {
  const admin = mockAdmin(row, options);
  const result = await resolveServerProEntitlement(admin.client, "user-a", dependencies(fetchImpl, timeoutMs));
  return { ...admin, result };
}

const freshActive = {
  status: "active",
  expires_at: "2026-08-26T12:00:00.000Z",
  last_verified_at: "2026-07-26T11:59:00.000Z",
};

let fetchCalls = 0;
const cacheHit = await resolve(freshActive, async () => {
  fetchCalls += 1;
  return revenueCatResponse();
});
assert.deepEqual(cacheHit.result, { isPro: true, source: "subscription", subscriptionFound: true, synced: false });
assert.equal(fetchCalls, 0, "fresh active cache avoids RevenueCat");
assert.ok(cacheHit.queries.some((query) => query.select === "status, expires_at, last_verified_at"), "cache query matches production columns");

const expired = await resolve({ ...freshActive, expires_at: "2026-07-25T12:00:00.000Z", last_verified_at: "2026-07-25T11:00:00.000Z" }, async () => revenueCatResponse());
assert.equal(expired.result.isPro, true);
assert.equal(expired.result.source, "revenuecat");
assert.equal(expired.upserts.length, 1, "stale cache is reconciled");
assert.deepEqual(Object.keys(expired.upserts[0].value).sort(), ["entitlement_id", "expires_at", "last_verified_at", "product_id", "provider", "status", "updated_at", "user_id"]);

const missing = await resolve(null, async () => revenueCatResponse({ includeEntitlement: false, productId: null }));
assert.deepEqual(missing.result, { isPro: false, source: "revenuecat", subscriptionFound: false, synced: false });
assert.equal(missing.upserts.length, 0, "an unknown RevenueCat customer is not negatively cached");

let identityLookupUrl = "";
const aliasedIdentity = await resolve(null, async (url) => {
  identityLookupUrl = String(url);
  return new Response(JSON.stringify({
    subscriber: {
      original_app_user_id: "$RCAnonymousID:original",
      aliases: ["$RCAnonymousID:original", "user-a"],
      entitlements: {
        pro: { expires_date: "2026-08-26T12:00:00.000Z", product_identifier: "youtrader_pro_monthly" },
      },
      subscriptions: { youtrader_pro_monthly: { refunded_at: null } },
    },
  }), { status: 200 });
});
assert.equal(aliasedIdentity.result.isPro, true, "an entitlement returned for the Supabase UUID is accepted");
assert.match(identityLookupUrl, /\/subscribers\/user-a$/, "the server looks up the Supabase UUID, never an email address");

const expiredEntitlement = await resolve(null, async () => revenueCatResponse({ expires: "2026-07-25T12:00:00.000Z" }));
assert.equal(expiredEntitlement.result.isPro, false, "expired RevenueCat entitlements are denied");
assert.equal(expiredEntitlement.upserts[0].value.status, "expired");

const freshInactive = await resolve({ status: "expired", expires_at: "2026-07-25T12:00:00.000Z", last_verified_at: "2026-07-26T11:59:30.000Z" }, async () => {
  throw new Error("fresh negative cache must not call RevenueCat");
});
assert.deepEqual(freshInactive.result, { isPro: false, source: "subscription", subscriptionFound: true, synced: false });

let expiredCacheFetches = 0;
const expiredFreshCache = await resolve({ ...freshActive, expires_at: "2026-07-25T12:00:00.000Z" }, async () => {
  expiredCacheFetches += 1;
  return revenueCatResponse({ includeEntitlement: false, productId: null });
});
assert.equal(expiredCacheFetches, 1, "a fresh cache row with passed expiry is never accepted");
assert.equal(expiredFreshCache.result.isPro, false);

const gracePeriod = await resolve(null, async () => revenueCatResponse({
  expires: "2026-07-25T12:00:00.000Z",
  gracePeriodExpires: "2026-07-27T12:00:00.000Z",
}));
assert.equal(gracePeriod.result.isPro, true, "an active RevenueCat grace period is honored");
assert.equal(gracePeriod.upserts[0].value.expires_at, "2026-07-27T12:00:00.000Z");

const refunded = await resolve(null, async () => revenueCatResponse({ refundedAt: "2026-07-26T11:00:00.000Z" }));
assert.equal(refunded.result.isPro, false, "a refunded RevenueCat subscription is denied");
assert.equal(refunded.upserts[0].value.status, "expired");

const timeout = await resolve(null, async () => { throw new Error("network unavailable"); });
assert.deepEqual(timeout.result, { isPro: false, source: "none", subscriptionFound: false, synced: false });
assert.equal(timeout.upserts.length, 0, "provider failures do not create cache rows");

const httpFailure = await resolve(null, async () => new Response("unavailable", { status: 503 }));
assert.deepEqual(httpFailure.result, { isPro: false, source: "none", subscriptionFound: false, synced: false });
assert.equal(httpFailure.upserts.length, 0, "RevenueCat HTTP failures do not create cache rows");

const staleActiveFailure = await resolve({ ...freshActive, last_verified_at: "2026-07-26T11:00:00.000Z" }, async () => {
  throw new Error("transient failure");
});
assert.equal(staleActiveFailure.result.isPro, false, "a failed refresh fails closed");
assert.equal(staleActiveFailure.upserts.length, 0, "a failed refresh does not overwrite a prior cache row");

const timedOut = await resolve(null, (_url, init) => new Promise((_resolve, reject) => {
  init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
}), undefined, 1);
assert.deepEqual(timedOut.result, { isPro: false, source: "none", subscriptionFound: false, synced: false });
assert.equal(timedOut.upserts.length, 0, "RevenueCat timeouts fail closed without a cache write");

const shared = mockAdmin(null);
const reconcile = async () => resolveServerProEntitlement(
  shared.client,
  "user-a",
  dependencies(async () => revenueCatResponse()),
);
const duplicate = await Promise.all([reconcile(), reconcile()]);
assert.ok(duplicate.every((result) => result.isPro));
assert.equal(shared.upserts.length, 2, "duplicate reconciliation uses idempotent upserts");
assert.ok(shared.upserts.every(({ value }) => value.user_id === "user-a" && value.entitlement_id === "pro"));
assert.ok(cacheHit.queries.some((query) => query.field === "user_id" && query.value === "user-a"), "cache lookup stays scoped to the authenticated user");

const coach = readFileSync("supabase/functions/ai-coach/index.ts", "utf8");
const market = readFileSync("supabase/functions/market-intelligence/index.ts", "utf8");
const app = readFileSync("App.tsx", "utf8");
assert.match(app, /Purchases\.logIn\(session\.user\.id\)/, "the client identifies RevenueCat with the Supabase UUID");
for (const source of [coach, market]) {
  const entitlementCall = source.indexOf("const entitlement = await resolveServerProEntitlement");
  const freeGate = source.indexOf("if (!entitlement.isPro)", entitlementCall);
  const lifecycleCall = source.indexOf("const lifecycle = await runQuotaLifecycle", freeGate);
  assert.ok(entitlementCall >= 0, "the shared entitlement resolver is invoked");
  assert.ok(freeGate > entitlementCall, "free access is rejected after entitlement resolution");
  assert.ok(lifecycleCall > freeGate, "free access cannot enter the quota lifecycle");
  assert.match(source, /userData\.user\.id/);
}
const helper = readFileSync("supabase/functions/_shared/revenueCatEntitlement.ts", "utf8");
assert.doesNotMatch(helper, /console\.(?:log|warn|error)\([^\n]*\{\s*(?:userId|secret|authorization|subscriber)/i);
console.log("RevenueCat entitlement QA passed");
