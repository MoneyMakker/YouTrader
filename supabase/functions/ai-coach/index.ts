import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import { checkAIQuota, recordAIUsage, DAILY_AI_LIMIT_MESSAGE } from "../_shared/aiQuota.ts";
import { generateAI } from "../_shared/aiProvider.ts";
import { isAICoachAction, type AICoachRequest } from "../_shared/aiSchemas.ts";
import { resolveServerProEntitlement } from "../_shared/revenueCatEntitlement.ts";

function getEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function periodKey(action: string, period?: string) {
  const now = new Date();
  return `${period || action}:month:${now.toISOString().slice(0, 7)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("ai_coach_missing_supabase_env");
    return jsonResponse({ error: "AI service is not configured." }, 500, req);
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

  let body: AICoachRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, req);
  }

  if (!isAICoachAction(body.action)) {
    return jsonResponse({ error: "Unsupported AI action." }, 400, req);
  }

  const entitlement = await resolveServerProEntitlement(supabaseAdmin, userData.user.id);
  if (!entitlement.isPro) {
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
      message: "Upgrade to Pro to run cloud AI coaching. This preview uses local analysis.",
      rag: result.retrieval ? {
        sources: result.retrieval.sources,
        confidence: result.retrieval.confidence,
        lowConfidence: result.retrieval.lowConfidence,
      } : undefined,
    }, 200, req);
  }

  const quota = await checkAIQuota(supabaseAdmin, userData.user.id, body.action);
  if (!quota.allowed) {
    return jsonResponse(
      {
        error: "quota_exceeded",
        message: quota.message || DAILY_AI_LIMIT_MESSAGE,
        providerStatus: "quota_exceeded",
        quota: { remaining: 0, limit: quota.limit },
      },
      429,
      req,
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

  if (!(body.action === "trade_vision_review" && result.usedFallback)) {
    await recordAIUsage(supabaseAdmin, {
      userId: userData.user.id,
      action: body.action,
      periodKey: periodKey(body.action, body.period),
      provider: result.provider,
      usedFallback: result.usedFallback,
      metadata: {
        source: "ai-coach",
        ...(result.platformMetadata || {}),
      },
    });
  }

  return jsonResponse({
    data: result.data,
    providerStatus: result.provider === "local" ? "local_fallback" : result.provider,
    usedFallback: result.usedFallback,
    message: result.message,
    rag: result.retrieval ? {
      sources: result.retrieval.sources,
      confidence: result.retrieval.confidence,
      lowConfidence: result.retrieval.lowConfidence,
    } : undefined,
    quota: {
      remaining: Math.max(0, quota.remaining - 1),
      limit: quota.limit,
      warning: quota.warning,
    },
  }, 200, req);
});
