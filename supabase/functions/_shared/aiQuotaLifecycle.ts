import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { BUCKET_LIMITS, bucketForAction } from "./rateLimits.ts";
import type { QuotaReservation } from "./aiQuotaOrchestrator.ts";

function windowStart(window: "day" | "week") {
  const now = new Date();
  if (window === "week") { const d = now.getUTCDay(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (d === 0 ? 6 : d - 1))).toISOString(); }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function requestId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) ? value : null;
}

export async function reserveAiQuota(admin: SupabaseClient, userId: string, action: string, id: string): Promise<QuotaReservation> {
  const bucket = bucketForAction(action); const rule = BUCKET_LIMITS[bucket];
  const { data, error } = await admin.rpc("security_reserve_ai_quota_lifecycle", { p_user_id: userId, p_action: action, p_request_id: id, p_bucket: bucket, p_limit: rule.limit, p_window_start: windowStart(rule.window) });
  if (error || !data) return { kind: "failure" as const };
  if (data.denied) return { kind: "denied" as const };
  const status = data.status;
  if (status !== "reserved" && status !== "completed" && status !== "provider_failed" && status !== "released") return { kind: "failure" };
  return { kind: "reserved", status, replay: data.replay === true };
}

export async function transitionAiQuota(admin: SupabaseClient, userId: string, action: string, id: string, target: "completed" | "provider_failed" | "released", reason?: string) {
  const { data, error } = await admin.rpc("security_transition_ai_quota_lifecycle", { p_user_id: userId, p_action: action, p_request_id: id, p_target: target, p_reason: reason || null });
  return !error && data?.status === target;
}
