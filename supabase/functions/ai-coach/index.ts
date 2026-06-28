import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { checkAIQuota, recordAIUsage } from "../_shared/aiQuota.ts";
import { generateAI } from "../_shared/aiProvider.ts";
import { isAICoachAction, type AICoachRequest } from "../_shared/aiSchemas.ts";

function getEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function periodKey(action: string, period?: string) {
  const now = new Date();
  return `${period || action}:month:${now.toISOString().slice(0, 7)}`;
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
    console.warn("ai_pro_check_failed", { code: error.code, message: error.message });
    return false;
  }

  if (!data) return false;
  const status = String(data.status || "").toLowerCase();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  return ["active", "trialing"].includes(status) || expiresAt > Date.now();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("ai_coach_missing_supabase_env");
    return jsonResponse({ error: "AI service is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return jsonResponse({ error: "Authentication required." }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  let body: AICoachRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!isAICoachAction(body.action)) {
    return jsonResponse({ error: "Unsupported AI action." }, 400);
  }

  const isPro = await hasServerProEntitlement(supabaseAdmin, userData.user.id);
  if (!isPro) {
    const result = await generateAI(
      {
        action: body.action,
        period: body.period || "day",
        payload: body.payload || {},
      },
      false,
    );
    return jsonResponse({
      data: result.data,
      providerStatus: "free_preview",
      usedFallback: true,
      message: "Upgrade to Pro to run NVIDIA AI coaching. This preview uses local analysis.",
    });
  }

  const quota = await checkAIQuota(supabaseAdmin, userData.user.id, body.action);
  if (!quota.allowed) {
    const isCooldown = quota.reason === "cooldown";
    if (!isCooldown) {
      const result = await generateAI(
        {
          action: body.action,
          period: body.period || "day",
          payload: body.payload || {},
        },
        false,
      );
      return jsonResponse({
        data: result.data,
        providerStatus: "quota_exceeded",
        usedFallback: true,
        message: "Your monthly AI allowance has been used. AI features will automatically reset after your next billing cycle.",
        quota: {
          remaining: 0,
          limit: quota.limit,
        },
      });
    }
    return jsonResponse(
      {
        error: isCooldown ? "cooldown" : "quota_exceeded",
        message: isCooldown
          ? `Please wait ${quota.retryAfterSeconds || 60} seconds before generating this AI coach again.`
          : "Your monthly AI allowance has been used. AI features will automatically reset after your next billing cycle.",
        providerStatus: "quota_exceeded",
      },
      429,
    );
  }

  const result = await generateAI(
    {
      action: body.action,
      period: body.period || "day",
      payload: body.payload || {},
    },
    true,
  );

  await recordAIUsage(supabaseAdmin, {
    userId: userData.user.id,
    action: body.action,
    periodKey: periodKey(body.action, body.period),
    provider: result.provider,
    usedFallback: result.usedFallback,
  });

  return jsonResponse({
    data: result.data,
    providerStatus: result.provider === "nvidia" ? "nvidia" : "local_fallback",
    usedFallback: result.usedFallback,
    message: result.message,
    quota: {
      remaining: Math.max(0, quota.remaining - 1),
      limit: quota.limit,
      warning: quota.warning,
    },
  });
});
