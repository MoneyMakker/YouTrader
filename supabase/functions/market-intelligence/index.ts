import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import { fetchBraveMarketNews, formatBraveArticlesForPrompt } from "../_shared/braveSearch.ts";
import { generateMarketIntelligence } from "../_shared/marketAiProvider.ts";
import { isMarketIntelligenceAction, type MarketIntelligenceAction } from "../_shared/marketAiSchemas.ts";
import { checkRateLimitBucket, recordRateLimitUsage } from "../_shared/rateLimits.ts";

function getEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function periodKey(action: string) {
  const now = new Date();
  return `${action}:${now.toISOString().slice(0, 10)}`;
}

async function hasServerProEntitlement(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const entitlementId = getEnv("REVENUECAT_ENTITLEMENT_ID") || "pro";
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("status, expires_at")
    .eq("user_id", userId)
    .eq("entitlement_id", entitlementId)
    .maybeSingle();

  if (error) {
    console.warn("[YouTrader:subscription] pro_check_failed", { code: error.code });
    return false;
  }
  if (!data) return false;
  const status = String(data.status || "").toLowerCase();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  return ["active", "trialing"].includes(status) || expiresAt > Date.now();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Market intelligence is not configured." }, 500, req);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return jsonResponse({ error: "Authentication required." }, 401, req);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Authentication required." }, 401, req);
  }

  let body: { action?: MarketIntelligenceAction; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, req);
  }

  if (!isMarketIntelligenceAction(body.action)) {
    return jsonResponse({ error: "Unsupported market action." }, 400, req);
  }

  const isPro = await hasServerProEntitlement(supabaseAdmin, userData.user.id);
  if (!isPro) {
    console.log("[YouTrader:subscription] market_intel_blocked_free", { action: body.action });
    return jsonResponse({ error: "YouTrader Pro is required for this feature." }, 403, req);
  }

  const quota = await checkRateLimitBucket(supabaseAdmin, userData.user.id, body.action);
  if (!quota.allowed) {
    return jsonResponse({
      error: quota.message || "Daily AI limit reached. More requests become available tomorrow.",
      quota: { remaining: 0, limit: quota.limit, bucket: quota.bucket },
    }, 429, req);
  }

  const payload = body.payload || {};
  const symbols = Array.isArray(payload.symbols)
    ? payload.symbols.map((item) => String(item))
    : typeof payload.symbols === "string"
      ? payload.symbols.split(/[,\s]+/).filter(Boolean)
      : undefined;
  const symbol = typeof payload.symbol === "string" ? payload.symbol : undefined;
  const query =
    body.action === "why_market_moving" && symbol
      ? `${symbol} market news today why moving`
      : undefined;

  const articles = await fetchBraveMarketNews({ query, symbols, count: 5 });
  const articlesText = formatBraveArticlesForPrompt(articles);
  const result = await generateMarketIntelligence(body.action, payload, articlesText);

  await recordRateLimitUsage(supabaseAdmin, {
    userId: userData.user.id,
    action: body.action,
    periodKey: periodKey(body.action),
    provider: result.provider,
    usedFallback: result.usedFallback,
    source: "market-intelligence",
  });

  return jsonResponse({
    data: result.data,
    articles: articles.slice(0, 5),
    providerStatus: result.provider,
    usedFallback: result.usedFallback,
    message: result.message,
    quota: { remaining: Math.max(0, quota.remaining - 1), limit: quota.limit },
  }, 200, req);
});
