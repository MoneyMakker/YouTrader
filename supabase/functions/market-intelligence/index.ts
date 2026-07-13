import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import { fetchBraveMarketNews, formatBraveArticlesForPrompt } from "../_shared/braveSearch.ts";
import { generateMarketIntelligence } from "../_shared/marketAiProvider.ts";
import { isMarketIntelligenceAction, type MarketIntelligenceAction } from "../_shared/marketAiSchemas.ts";
import { checkRateLimitBucket, recordRateLimitUsage } from "../_shared/rateLimits.ts";
import { resolveServerProEntitlement } from "../_shared/revenueCatEntitlement.ts";

type SuppliedHeadline = {
  title: string;
  summary?: string;
  source?: string;
  time?: string;
  impact?: string;
  symbols?: string[];
};

function getEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function periodKey(action: string) {
  const now = new Date();
  return `${action}:${now.toISOString().slice(0, 10)}`;
}

function suppliedHeadlines(payload: Record<string, unknown>): SuppliedHeadline[] {
  if (!Array.isArray(payload.headlines)) return [];
  return payload.headlines
    .slice(0, 10)
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        title: String(row.title || "").trim().slice(0, 220),
        summary: String(row.summary || "").trim().slice(0, 320),
        source: String(row.source || "").trim().slice(0, 80),
        time: String(row.time || "").trim().slice(0, 80),
        impact: String(row.impact || "").trim().slice(0, 20),
        symbols: Array.isArray(row.symbols) ? row.symbols.map((symbol) => String(symbol).slice(0, 12)).slice(0, 8) : [],
      };
    })
    .filter((item) => item.title);
}

function formatSuppliedHeadlines(headlines: SuppliedHeadline[]) {
  if (!headlines.length) return "";
  return headlines.map((item, index) => [
    `VISIBLE HEADLINE ${index + 1}`,
    item.title,
    item.summary || null,
    item.source ? `Source: ${item.source}` : null,
    item.time ? `Time: ${item.time}` : null,
    item.impact ? `Impact: ${item.impact}` : null,
    item.symbols?.length ? `Related symbols: ${item.symbols.join(", ")}` : null,
  ].filter(Boolean).join("\n")).join("\n\n");
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

  const entitlement = await resolveServerProEntitlement(supabaseAdmin, userData.user.id);
  if (!entitlement.isPro) {
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

  const visibleHeadlines = suppliedHeadlines(payload);
  const articles = visibleHeadlines.length ? [] : await fetchBraveMarketNews({ query, symbols, count: 5 });
  const articlesText = visibleHeadlines.length ? formatSuppliedHeadlines(visibleHeadlines) : formatBraveArticlesForPrompt(articles);
  const enrichedPayload = {
    ...payload,
    headlines: visibleHeadlines.length ? visibleHeadlines : payload.headlines,
    inputHeadlineCount: visibleHeadlines.length || articles.length,
  };
  const result = await generateMarketIntelligence(body.action, enrichedPayload, articlesText);

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
    articles: visibleHeadlines.length ? visibleHeadlines.slice(0, 5) : articles.slice(0, 5),
    providerStatus: result.provider,
    usedFallback: result.usedFallback,
    message: result.message,
    quota: { remaining: Math.max(0, quota.remaining - 1), limit: quota.limit },
  }, 200, req);
});
