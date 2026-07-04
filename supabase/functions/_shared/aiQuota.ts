import {
  checkRateLimitBucket,
  DAILY_AI_LIMIT_MESSAGE,
  recordRateLimitUsage,
} from "./rateLimits.ts";
import type { AICoachAction } from "./aiSchemas.ts";

/** @deprecated Use checkRateLimitBucket from rateLimits.ts */
export async function checkAIQuota(
  supabaseAdmin: Parameters<typeof checkRateLimitBucket>[0],
  userId: string,
  action: AICoachAction,
) {
  const quota = await checkRateLimitBucket(supabaseAdmin, userId, action);
  return {
    allowed: quota.allowed,
    reason: quota.reason,
    remaining: quota.remaining,
    limit: quota.limit,
    message: quota.message,
    warning: quota.remaining <= 3 && quota.allowed ? "You are approaching your daily AI allowance." : undefined,
  };
}

/** @deprecated Use recordRateLimitUsage from rateLimits.ts */
export async function recordAIUsage(
  supabaseAdmin: Parameters<typeof recordRateLimitUsage>[0],
  input: {
    userId: string;
    action: AICoachAction;
    periodKey: string;
    provider: string;
    usedFallback: boolean;
  },
) {
  await recordRateLimitUsage(supabaseAdmin, {
    userId: input.userId,
    action: input.action,
    periodKey: input.periodKey,
    provider: input.provider,
    usedFallback: input.usedFallback,
    source: "ai-coach",
  });
}

export { DAILY_AI_LIMIT_MESSAGE };
