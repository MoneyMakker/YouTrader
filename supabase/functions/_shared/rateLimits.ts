import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export type RateLimitBucket = "ai_coach" | "ai_news" | "ai_analytics" | "weekly_review" | "heavy_analysis";

export const BUCKET_LIMITS: Record<RateLimitBucket, { limit: number; window: "day" | "week" }> = {
  ai_coach: { limit: 30, window: "day" },
  ai_news: { limit: 40, window: "day" },
  ai_analytics: { limit: 20, window: "day" },
  weekly_review: { limit: 5, window: "week" },
  heavy_analysis: { limit: 10, window: "day" },
};

export const DAILY_AI_LIMIT_MESSAGE = "Daily AI limit reached. More requests become available tomorrow.";

const BUCKET_ACTIONS: Record<RateLimitBucket, string[]> = {
  ai_coach: ["daily_plan", "risk_predictor", "journal_summary", "daily_challenge"],
  ai_news: ["news_explainer", "market_sentiment"],
  ai_analytics: ["market_narrative", "volatility_radar", "opportunity_scanner", "noise_filter"],
  weekly_review: ["weekly_coach", "pre_market_brief"],
  heavy_analysis: ["watchlist_risk", "why_market_moving", "trade_analysis"],
};

function startOfWindow(window: "day" | "week") {
  const now = new Date();
  if (window === "week") {
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
    return start.toISOString();
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function bucketForAction(action: string): RateLimitBucket {
  for (const [bucket, actions] of Object.entries(BUCKET_ACTIONS) as [RateLimitBucket, string[]][]) {
    if (actions.includes(action)) return bucket;
  }
  return "ai_analytics";
}

export async function checkRateLimitBucket(
  supabaseAdmin: SupabaseClient,
  userId: string,
  action: string,
) {
  const bucket = bucketForAction(action);
  const rule = BUCKET_LIMITS[bucket];
  const actions = BUCKET_ACTIONS[bucket];
  const since = startOfWindow(rule.window);

  const { count, error } = await supabaseAdmin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("action", actions)
    .gte("created_at", since);

  if (error) {
    console.error("[YouTrader:subscription] rate_limit_check_failed", { bucket, code: error.code });
    return { allowed: true, remaining: rule.limit, limit: rule.limit, bucket };
  }

  const used = count || 0;
  return {
    allowed: used < rule.limit,
    remaining: Math.max(0, rule.limit - used),
    limit: rule.limit,
    bucket,
    reason: used < rule.limit ? ("ok" as const) : ("quota" as const),
    message: used < rule.limit ? undefined : DAILY_AI_LIMIT_MESSAGE,
  };
}

export async function recordRateLimitUsage(
  supabaseAdmin: SupabaseClient,
  input: { userId: string; action: string; periodKey: string; provider: string; usedFallback: boolean; source: string; metadata?: Record<string, unknown> },
) {
  const { error } = await supabaseAdmin.from("ai_usage_events").insert({
    user_id: input.userId,
    action: input.action,
    period_key: input.periodKey,
    provider: input.provider,
    used_fallback: input.usedFallback,
    metadata: { source: input.source, bucket: bucketForAction(input.action), ...(input.metadata || {}) },
  });
  if (error) {
    console.error("[YouTrader:subscription] usage_record_failed", { action: input.action, code: error.code });
  }
}
