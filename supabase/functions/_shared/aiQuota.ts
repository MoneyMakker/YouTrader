import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import type { AICoachAction } from "./aiSchemas.ts";

type QuotaRule = {
  limit: number;
  window: "month";
};

const QUOTAS: Record<AICoachAction, QuotaRule> = {
  daily_plan: { limit: 20, window: "month" },
  risk_predictor: { limit: 30, window: "month" },
  weekly_coach: { limit: 8, window: "month" },
  journal_summary: { limit: 12, window: "month" },
  news_explainer: { limit: 40, window: "month" },
  daily_challenge: { limit: 20, window: "month" },
};

const COOLDOWN_SECONDS: Record<AICoachAction, number> = {
  daily_plan: 60,
  risk_predictor: 45,
  weekly_coach: 300,
  journal_summary: 90,
  news_explainer: 15,
  daily_challenge: 60,
};

function startOfWindow(rule: QuotaRule) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function checkAIQuota(
  supabaseAdmin: SupabaseClient,
  userId: string,
  action: AICoachAction,
) {
  const rule = QUOTAS[action];
  const cooldownSeconds = COOLDOWN_SECONDS[action];
  const { data: latest, error: latestError } = await supabaseAdmin
    .from("ai_usage_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestError && latest?.created_at) {
    const elapsed = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
    if (elapsed < cooldownSeconds) {
      return {
        allowed: false,
        reason: "cooldown" as const,
        retryAfterSeconds: Math.ceil(cooldownSeconds - elapsed),
        remaining: Math.max(0, rule.limit - 1),
        limit: rule.limit,
      };
    }
  }

  const { count, error } = await supabaseAdmin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", startOfWindow(rule));

  if (error) {
    console.error("ai_quota_check_failed", { action, code: error.code, message: error.message });
    return { allowed: true, remaining: rule.limit, limit: rule.limit };
  }

  const used = count || 0;
  return {
    allowed: used < rule.limit,
    reason: used < rule.limit ? "ok" as const : "quota" as const,
    remaining: Math.max(0, rule.limit - used),
    limit: rule.limit,
    warning:
      used + 1 >= Math.floor(rule.limit * 0.9) && used < rule.limit
        ? "You are approaching your monthly AI allowance."
        : undefined,
  };
}

export async function recordAIUsage(
  supabaseAdmin: SupabaseClient,
  input: {
    userId: string;
    action: AICoachAction;
    periodKey: string;
    provider: string;
    usedFallback: boolean;
  },
) {
  const { error } = await supabaseAdmin.from("ai_usage_events").insert({
    user_id: input.userId,
    action: input.action,
    period_key: input.periodKey,
    provider: input.provider,
    used_fallback: input.usedFallback,
    metadata: { source: "ai-coach" },
  });
  if (error) {
    console.error("ai_usage_record_failed", { action: input.action, code: error.code, message: error.message });
  }
}
