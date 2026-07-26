import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

type SubscriptionRow = {
  status: string | null;
  expires_at: string | null;
  updated_at: string | null;
};

type RevenueCatEntitlement = {
  expires_date?: string | null;
  product_identifier?: string | null;
  store?: string | null;
  is_sandbox?: boolean | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
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

const CACHE_TTL_MS = 15 * 60 * 1000;
const REVENUECAT_TIMEOUT_MS = 5_000;

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

export function isActiveSubscription(row: SubscriptionRow | null, now = Date.now()) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (!["active", "trialing"].includes(status)) return false;
  if (!row.expires_at) return true;
  const expiresAt = new Date(row.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function isActiveRevenueCatEntitlement(entitlement: RevenueCatEntitlement | undefined, now = Date.now()) {
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true;
  const expiresAt = new Date(entitlement.expires_date).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function isFreshCache(row: SubscriptionRow, now: number) {
  const updatedAt = new Date(row.updated_at || "").getTime();
  return Number.isFinite(updatedAt) && updatedAt <= now && now - updatedAt < CACHE_TTL_MS;
}

type RevenueCatLookup =
  | { kind: "active"; entitlement: RevenueCatEntitlement }
  | { kind: "inactive"; entitlement?: RevenueCatEntitlement }
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
    return isActiveRevenueCatEntitlement(entitlement, dependencies.now()) && entitlement
      ? { kind: "active", entitlement }
      : { kind: "inactive", entitlement };
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
    .select("status, expires_at, updated_at")
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
  if (!error && row && isFreshCache(row, now) && !isActiveSubscription(row, now) && row.status !== "active" && row.status !== "trialing") {
    return { isPro: false, source: "subscription", subscriptionFound, synced: false };
  }

  const revenueCat = await fetchRevenueCatEntitlement(userId, entitlementId, resolved);
  if (revenueCat.kind === "unavailable") {
    return { isPro: false, source: "none", subscriptionFound, synced: false };
  }

  const isPro = revenueCat.kind === "active";
  const entitlement = revenueCat.entitlement;
  const { error: syncError } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      entitlement_id: entitlementId,
      status: isPro ? "active" : "inactive",
      product_id: entitlement?.product_identifier || null,
      expires_at: entitlement?.expires_date || null,
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
