/** Minimal client surface used by the harness — avoids Deno-only https://esm.sh imports under tsc. */
type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (field: string, value: string) => {
        eq: (field: string, value: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: { code?: string } | null }>;
        };
      };
    };
    upsert: (
      value: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: { code?: string } | null }>;
  };
};

type SubscriptionRow = {
  status: string | null;
  expires_at: string | null;
  last_verified_at: string | null;
};

type RevenueCatEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string | null;
};

type RevenueCatSubscription = {
  refunded_at?: string | null;
  grace_period_expires_date?: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
};

export type ServerEntitlementResult = {
  isPro: boolean;
  source: "subscription" | "revenuecat" | "none";
  subscriptionFound: boolean;
  synced: boolean;
};

type EntitlementDependencies = {
  env?: (name: string) => string;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

const ACTIVE_CACHE_TTL_MS = 15 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 1000;
const REVENUECAT_TIMEOUT_MS = 5_000;

function env(name: string) {
  // Harness always injects dependencies.env; this fallback is Node-safe for accidental direct calls.
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  if (typeof denoEnv?.get === "function") {
    return denoEnv.get(name)?.trim() || "";
  }
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return processEnv?.[name]?.trim() || "";
}

export function isActiveSubscription(row: SubscriptionRow | null, now = Date.now()) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (!["active", "trialing", "grace_period", "billing_retry", "canceled"].includes(status)) return false;
  if (!row.expires_at) return ["active", "trialing"].includes(status);
  const expiresAt = new Date(row.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function isFutureDate(value: string | null | undefined, now: number) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > now;
}

function effectiveExpiration(entitlement: RevenueCatEntitlement, subscription?: RevenueCatSubscription) {
  const candidates = [
    entitlement.expires_date,
    entitlement.grace_period_expires_date,
    subscription?.grace_period_expires_date,
  ].filter((value): value is string => !!value && Number.isFinite(new Date(value).getTime()));
  return candidates.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;
}

export function isActiveRevenueCatEntitlement(
  entitlement: RevenueCatEntitlement | undefined,
  subscription: RevenueCatSubscription | undefined,
  now = Date.now(),
) {
  if (!entitlement) return false;
  if (subscription?.refunded_at) return false;
  if (!entitlement.expires_date) return true;
  return isFutureDate(effectiveExpiration(entitlement, subscription), now);
}

function isFreshCache(row: SubscriptionRow, now: number) {
  const verifiedAt = new Date(row.last_verified_at || "").getTime();
  if (!Number.isFinite(verifiedAt) || verifiedAt > now) return false;
  const ttl = isActiveSubscription(row, now) ? ACTIVE_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
  return now - verifiedAt < ttl;
}

type RevenueCatLookup =
  | { kind: "active"; entitlement: RevenueCatEntitlement; expiresAt: string | null }
  | { kind: "inactive"; entitlement?: RevenueCatEntitlement; expiresAt: string | null }
  | { kind: "unavailable" };

async function fetchRevenueCatEntitlement(
  userId: string,
  entitlementId: string,
  dependencies: Required<Pick<EntitlementDependencies, "env" | "fetch" | "timeoutMs" | "now">>,
): Promise<RevenueCatLookup> {
  const secret = dependencies.env("REVENUECAT_SECRET_KEY");
  if (!secret) {
    console.warn("[YouTrader:subscription] revenuecat_secret_missing", { entitlement_id: entitlementId });
    return { kind: "unavailable" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs);
  try {
    const response = await dependencies.fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[YouTrader:subscription] revenuecat_lookup_failed", {
        entitlement_id: entitlementId,
        status: response.status,
      });
      return { kind: "unavailable" };
    }
    const body = await response.json() as RevenueCatSubscriberResponse;
    const entitlement = body.subscriber?.entitlements?.[entitlementId];
    const subscription = entitlement?.product_identifier
      ? body.subscriber?.subscriptions?.[entitlement.product_identifier]
      : undefined;
    const expiresAt = entitlement ? effectiveExpiration(entitlement, subscription) : null;
    return isActiveRevenueCatEntitlement(entitlement, subscription, dependencies.now()) && entitlement
      ? { kind: "active", entitlement, expiresAt }
      : { kind: "inactive", entitlement, expiresAt };
  } catch {
    console.warn("[YouTrader:subscription] revenuecat_lookup_error", {
      entitlement_id: entitlementId,
    });
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveServerProEntitlement(
  supabaseAdmin: SupabaseClient,
  userId: string,
  dependencies: EntitlementDependencies = {},
): Promise<ServerEntitlementResult> {
  const resolved = {
    env: dependencies.env || env,
    fetch: dependencies.fetch || fetch,
    now: dependencies.now || (() => Date.now()),
    timeoutMs: dependencies.timeoutMs || REVENUECAT_TIMEOUT_MS,
  };
  const now = resolved.now();
  const entitlementId = resolved.env("REVENUECAT_ENTITLEMENT_ID") || "pro";
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("status, expires_at, last_verified_at")
    .eq("user_id", userId)
    .eq("entitlement_id", entitlementId)
    .maybeSingle();

  const row = (data as SubscriptionRow | null) || null;
  if (error) {
    console.warn("[YouTrader:subscription] subscription_lookup_failed", {
      entitlement_id: entitlementId,
      code: error.code,
    });
  }

  const subscriptionFound = !error && !!row;
  if (!error && row && isFreshCache(row, now) && isActiveSubscription(row, now)) {
    return { isPro: true, source: "subscription", subscriptionFound, synced: false };
  }
  if (!error && row && isFreshCache(row, now) && !isActiveSubscription(row, now)) {
    return { isPro: false, source: "subscription", subscriptionFound, synced: false };
  }

  const revenueCat = await fetchRevenueCatEntitlement(userId, entitlementId, resolved);
  if (revenueCat.kind === "unavailable") {
    return { isPro: false, source: "none", subscriptionFound, synced: false };
  }

  const isPro = revenueCat.kind === "active";
  const entitlement = revenueCat.entitlement;
  // Production requires provider and product_id. Do not persist an unknown inactive
  // customer as an authoritative negative cache entry.
  if (!entitlement?.product_identifier) {
    return { isPro, source: "revenuecat", subscriptionFound, synced: false };
  }
  const { error: syncError } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      provider: "revenuecat",
      entitlement_id: entitlementId,
      status: isPro ? "active" : "expired",
      product_id: entitlement.product_identifier,
      expires_at: revenueCat.expiresAt,
      last_verified_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "user_id,entitlement_id" });

  if (syncError) {
    console.error("[YouTrader:subscription] entitlement_sync_failed", {
      entitlement_id: entitlementId,
      code: syncError.code,
    });
    // RevenueCat is still authoritative. The write is only a cache/sync optimization.
    return { isPro, source: "revenuecat", subscriptionFound, synced: false };
  }

  return { isPro, source: "revenuecat", subscriptionFound, synced: true };
}
