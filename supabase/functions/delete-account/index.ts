import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

/**
 * Deletes the authenticated Supabase user and applicable user-owned rows.
 * Requires Authorization: Bearer <user access token>.
 * Never returns service-role material to the client.
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
  const admin = createClient(supabaseUrl, serviceKey);

  // Best-effort cleanup of known user-owned tables (RLS-bypass via service role).
  const tables = [
    "trade_journal",
    "user_subscriptions",
    "security_events",
    "idempotency_keys",
    "request_limits",
  ];
  for (const table of tables) {
    try {
      await admin.from(table).delete().eq("user_id", userId);
    } catch {
      // Table may not exist in every environment — continue.
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: "delete_failed" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      note: "App Store subscriptions are not cancelled by account deletion. Manage billing in Apple Subscriptions.",
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
