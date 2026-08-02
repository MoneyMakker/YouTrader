import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  createServiceClient,
  deleteAppleRefreshToken,
  loadAppleRefreshTokenSealed,
  openRefreshToken,
  readAppleSecretConfig,
  revokeAppleRefreshToken,
} from "../_shared/appleAuthTokens.ts";

const defaultAllowedOrigins = ["https://youtrader.app", "https://www.youtrader.app"];

function configuredAllowedOrigins() {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const configured = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length ? configured : defaultAllowedOrigins;
}

function corsHeadersFor(req?: Request) {
  const allowedOrigins = configuredAllowedOrigins();
  const origin = req?.headers.get("Origin") || "";
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function userHasAppleIdentity(user: { identities?: Array<{ provider?: string }> | null }): boolean {
  return (user.identities || []).some((i) => String(i.provider || "").toLowerCase() === "apple");
}

/**
 * Deletes the authenticated Supabase user and applicable user-owned rows.
 * Requires Authorization: Bearer <user access token>.
 * Never accepts a client-supplied user_id as authority.
 * Never returns service-role material to the client.
 * Does not cancel App Store subscriptions.
 */
Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Ignore body for authority — JWT only. Body may exist but must not supply user_id.
  try {
    await req.json();
  } catch {
    // empty body is fine
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const userId = userData.user.id;
  const isAppleUser = userHasAppleIdentity(userData.user);
  const admin = createServiceClient();

  let appleRevoked = false;
  let manualAppleRevocationRequired = false;

  if (isAppleUser) {
    const sealed = await loadAppleRefreshTokenSealed(admin, userId);
    const cfg = readAppleSecretConfig();
    if (sealed && cfg) {
      const refresh = await openRefreshToken(sealed, cfg.encryptionKey);
      if (refresh) {
        const result = await revokeAppleRefreshToken(cfg, refresh);
        appleRevoked = result === "revoked" || result === "already_revoked";
        if (!appleRevoked) {
          manualAppleRevocationRequired = true;
        }
      } else {
        manualAppleRevocationRequired = true;
      }
    } else {
      // Legacy Apple accounts or missing Apple secrets — do not block deletion.
      manualAppleRevocationRequired = true;
    }
    await deleteAppleRefreshToken(admin, userId);
  }

  // Best-effort cleanup of known user-owned production tables.
  const tables = [
    "trade_journal",
    "trades",
    "user_subscriptions",
    "user_app_state",
    "user_firm_settings",
    "risk_snapshots",
    "upload_files",
    "security_events",
    "idempotency_keys",
    "request_limits",
    "ai_analysis_usage",
    "ai_usage_events",
    "achievement_share_usage",
    "ai_quota_lifecycle",
    "account_deletion_requests",
    "auth_provider_tokens",
  ];
  for (const table of tables) {
    const { error: tableError } = await admin.from(table).delete().eq("user_id", userId);
    if (tableError) {
      console.warn(`delete-account: cleanup skipped for ${table}`);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // Idempotent-ish: if user already gone, treat as success.
    const msg = String(deleteError.message || "").toLowerCase();
    if (!msg.includes("not found") && !msg.includes("user not found")) {
      return new Response(JSON.stringify({ error: "delete_failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      appleRevoked,
      manualAppleRevocationRequired,
      note: "App Store subscriptions are not cancelled by account deletion. Manage billing in Apple Subscriptions.",
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
