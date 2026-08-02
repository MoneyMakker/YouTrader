import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  createServiceClient,
  exchangeAppleAuthorizationCode,
  readAppleSecretConfig,
  sealRefreshToken,
  upsertAppleRefreshToken,
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

/**
 * Exchanges a one-time Apple authorizationCode for a refresh token and stores it
 * server-side for later revocation during account deletion.
 * Never returns the refresh token to the client.
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

  let authorizationCode = "";
  try {
    const body = await req.json();
    authorizationCode = String(body?.authorizationCode || "").trim();
  } catch {
    authorizationCode = "";
  }
  if (!authorizationCode || authorizationCode.length > 2048) {
    return new Response(JSON.stringify({ error: "invalid_request" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const cfg = readAppleSecretConfig();
  if (!cfg) {
    // Do not fail Apple sign-in UX when Apple revoke secrets are not yet configured.
    return new Response(JSON.stringify({ ok: true, stored: false, reason: "apple_secrets_missing" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const exchanged = await exchangeAppleAuthorizationCode(cfg, authorizationCode);
  if (!exchanged.refreshToken) {
    return new Response(JSON.stringify({ ok: true, stored: false, reason: "exchange_failed" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const sealed = await sealRefreshToken(exchanged.refreshToken, cfg.encryptionKey);
  const admin = createServiceClient();
  const stored = await upsertAppleRefreshToken(admin, userData.user.id, sealed);
  return new Response(JSON.stringify({ ok: true, stored }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
