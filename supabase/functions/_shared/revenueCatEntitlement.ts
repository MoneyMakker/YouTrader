import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

type SubscriptionRow = {
  status: string | null;
  expires_at: string | null;
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

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function isActiveSubscription(row: SubscriptionRow | null) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (!["active", "trialing"].includes(status)) return false;
  if (!row.expires_at) return true;
  const expiresAt = new Date(row.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function isActiveRevenueCatEntitlement(entitlement: RevenueCatEntitlement | undefined) {
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true;
  const expiresAt = new Date(entitlement.expires_date).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function fetchRevenueCatEntitlement(userId: string, entitlementId: string) {
  const secret = env("REVENUECAT_SECRET_KEY");
  if (!secret) {
    console.warn("[YouTrader:subscription] revenuecat_secret_missing", { entitlement_id: entitlementId });
    return null;
  }

  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      console.warn("[YouTrader:subscription] revenuecat_lookup_failed", {
        entitlement_id: entitlementId,
        status: response.status,
      });
      return null;
    }
    const body = await response.json() as RevenueCatSubscriberResponse;
    return body.subscriber?.entitlements?.[entitlementId] || null;
  } catch (error) {
    console.warn("[YouTrader:subscription] revenuecat_lookup_error", {
      entitlement_id: entitlementId,
      error_type: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

export async function resolveServerProEntitlement(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<ServerEntitlementResult> {
  const entitlementId = env("REVENUECAT_ENTITLEMENT_ID") || "pro";
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("status, expires_at")
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
  if (!error && isActiveSubscription(row)) {
    return { isPro: true, source: "subscription", subscriptionFound, synced: false };
  }

  const revenueCatEntitlement = await fetchRevenueCatEntitlement(userId, entitlementId);
  const valid = isActiveRevenueCatEntitlement(revenueCatEntitlement || undefined);
  if (!valid || !revenueCatEntitlement) {
    return { isPro: false, source: "none", subscriptionFound, synced: false };
  }

  const { error: syncError } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      entitlement_id: entitlementId,
      status: "active",
      product_id: revenueCatEntitlement.product_identifier || null,
      store: revenueCatEntitlement.store || null,
      environment: revenueCatEntitlement.is_sandbox ? "sandbox" : "production",
      expires_at: revenueCatEntitlement.expires_date || null,
      metadata: {
        source: "revenuecat_v1",
        validated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,entitlement_id" });

  if (syncError) {
    console.error("[YouTrader:subscription] entitlement_sync_failed", {
      entitlement_id: entitlementId,
      code: syncError.code,
    });
    // RevenueCat has still authenticated this request. The write is only a cache/sync optimization.
    return { isPro: true, source: "revenuecat", subscriptionFound, synced: false };
  }

  return { isPro: true, source: "revenuecat", subscriptionFound, synced: true };
}
