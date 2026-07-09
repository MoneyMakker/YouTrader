#!/usr/bin/env node
/**
 * Live comparison: deployed ai-coach — AI Platform V2 vs legacy (secret toggle).
 * Preview/staging only. Creates ephemeral Pro test user; cleans up after.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REPORT_DIR = path.join(ROOT, "scripts/ai-platform-v2/reports");

const COACH_ACTIONS = [
  "daily_plan",
  "weekly_coach",
  "journal_summary",
  "risk_predictor",
  "news_explainer",
  "daily_challenge",
];

const SAMPLE_PAYLOADS = {
  daily_plan: { stats: { totalTrades: 5, wr: 60, pf: 1.2 }, bestSession: "NY Open" },
  weekly_coach: { stats: { totalTrades: 18, wr: 55, pf: 1.3 }, bestSession: "NY Open", worstSession: "Asia" },
  journal_summary: { period: "month", stats: { totalTrades: 40, wr: 54, pf: 1.25 } },
  risk_predictor: { stats: { totalTrades: 10, wr: 40, pf: 0.8 }, recentDrawdown: "moderate" },
  news_explainer: { headline: "Fed holds rates steady", context: "Markets mixed ahead of CPI" },
  daily_challenge: { stats: { totalTrades: 6, wr: 50, pf: 1.0 }, focus: "patience" },
};

const REQUIRED_KEYS = {
  daily_plan: ["dailyFocus", "coachMessage"],
  weekly_coach: ["title", "summary", "topStrengths"],
  journal_summary: ["summary"],
  risk_predictor: ["riskLevel", "coachMessage"],
  news_explainer: ["headline", "plainEnglish"],
  daily_challenge: ["challengeTitle", "challengeDescription"],
};

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function getProjectKeys() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  let anon = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  let service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if ((!anon || !service) && process.env.SUPABASE_PROJECT_REF) {
    try {
      const out = execFileSync(
        "supabase",
        ["projects", "api-keys", "--project-ref", process.env.SUPABASE_PROJECT_REF, "--output-format", "json"],
        { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
      const parsed = JSON.parse(out);
      for (const k of parsed.keys || []) {
        if (k.id === "anon" && !anon) anon = k.api_key;
        if (k.id === "service_role" && !service) service = k.api_key;
      }
    } catch {
      /* fall through */
    }
  }

  if (!url || !anon || !service) {
    throw new Error("Missing Supabase URL/keys for live validation");
  }
  return { url, anon, service };
}

async function createSupabase(url, key) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setPreviewSecret(name, value) {
  execFileSync("supabase", ["secrets", "set", `${name}=${value}`], { cwd: ROOT, stdio: "pipe" });
}

function schemaScore(action, data) {
  const keys = REQUIRED_KEYS[action] || [];
  const present = keys.filter((k) => data && typeof data[k] !== "undefined");
  return keys.length ? present.length / keys.length : 1;
}

async function invokeCoach(url, anonKey, jwt, action, payload) {
  const started = Date.now();
  const res = await fetch(`${url}/functions/v1/ai-coach`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ action, period: action === "weekly_coach" ? "week" : "day", payload }),
  });
  const latencyMs = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  return { status: res.status, latencyMs, body };
}

async function fetchLatestUsage(admin, userId, action) {
  const { data } = await admin
    .from("ai_usage_events")
    .select("metadata, provider, used_fallback, created_at")
    .eq("user_id", userId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function runLiveComparison() {
  loadDotEnv();
  const linked = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/.temp/linked-project.json"), "utf8"));
  process.env.SUPABASE_PROJECT_REF = linked.ref;

  const { url, anon, service } = getProjectKeys();
  const admin = await createSupabase(url, service);

  const email = `ai-preview-${Date.now()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  let userId = null;

  const comparison = {
    generatedAt: new Date().toISOString(),
    environment: "preview-staging",
    projectRef: linked.ref,
    modes: { v2: [], legacy: [] },
    summary: {},
    errors: [],
  };

  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) throw new Error(createErr?.message || "createUser failed");
    userId = created.user.id;

    const entitlementId = "pro";
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error: subErr } = await admin.from("user_subscriptions").upsert(
      {
        user_id: userId,
        entitlement_id: entitlementId,
        provider: "revenuecat",
        product_id: "preview_pro_validation",
        status: "active",
        expires_at: expires,
      },
      { onConflict: "user_id,entitlement_id" },
    );
    if (subErr) {
      const sql = `insert into public.user_subscriptions (user_id, provider, entitlement_id, product_id, status, expires_at) values ('${userId}', 'revenuecat', '${entitlementId}', 'preview_pro_validation', 'active', '${expires}') on conflict (user_id, entitlement_id) do update set status = 'active', expires_at = excluded.expires_at, updated_at = now();`;
      try {
        const out = execFileSync("supabase", ["db", "query", "--linked", "--yes", sql], { cwd: ROOT, encoding: "utf8" });
        if (/error|failed/i.test(out) && !/"rows"/.test(out)) {
          throw new Error(out.slice(0, 300));
        }
      } catch (sqlErr) {
        const msg = String(sqlErr.stdout || sqlErr.stderr || sqlErr.message);
        if (!/"rows"/.test(msg)) {
          throw new Error(`subscription upsert failed: ${subErr.message}; sql: ${msg.slice(0, 200)}`);
        }
      }
    }

    const verifySql = `select status, entitlement_id from public.user_subscriptions where user_id = '${userId}' and entitlement_id = '${entitlementId}' limit 1;`;
    const verifyOut = execFileSync("supabase", ["db", "query", "--linked", "--yes", verifySql], { cwd: ROOT, encoding: "utf8" });
    if (!verifyOut.includes("active")) {
      throw new Error(`Pro subscription not visible after upsert (verify output empty)`);
    }

    const client = await createSupabase(url, anon);
    const { data: session, error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr || !session.session?.access_token) throw new Error(signErr?.message || "signIn failed");
    const jwt = session.session.access_token;

    async function runMode(mode, label) {
      for (const action of COACH_ACTIONS) {
        const payload = SAMPLE_PAYLOADS[action];
        const result = await invokeCoach(url, anon, jwt, action, payload);
        const usage = userId ? await fetchLatestUsage(admin, userId, action) : null;
        const meta = usage?.metadata || {};
        const data = result.body?.data || {};
        const isProCloud =
          result.status === 200 &&
          result.body?.providerStatus !== "free_preview" &&
          result.body?.providerStatus !== "quota_exceeded";
        comparison.modes[mode].push({
          action,
          mode: label,
          httpStatus: result.status,
          latencyMs: result.latencyMs,
          providerStatus: result.body?.providerStatus,
          usedFallback: result.body?.usedFallback,
          schemaScore: schemaScore(action, data),
          estimatedCostUsd: meta.estimatedCostUsd ?? null,
          estimatedInputTokens: meta.estimatedInputTokens ?? null,
          estimatedOutputTokens: meta.estimatedOutputTokens ?? null,
          cacheHit: meta.cacheHit ?? null,
          modelRef: meta.modelRef ?? null,
          promptVersion: meta.promptVersion ?? null,
          ok: result.status === 200 && schemaScore(action, data) >= 0.5 && isProCloud,
          isProCloud,
        });
        await sleep(800);
      }
    }

    // V2 path (default / explicit true)
    if (!process.env.SKIP_SECRET_TOGGLE) {
      setPreviewSecret("AI_PLATFORM_V2_ENABLED", "true");
      await sleep(3000);
    }
    await runMode("v2", "platform_v2");

    // Legacy path
    if (!process.env.SKIP_SECRET_TOGGLE) {
      setPreviewSecret("AI_PLATFORM_V2_ENABLED", "false");
      await sleep(3000);
    }
    await runMode("legacy", "legacy");

    // Restore V2 for preview testing
    if (!process.env.SKIP_SECRET_TOGGLE) {
      setPreviewSecret("AI_PLATFORM_V2_ENABLED", "true");
    }

    const v2 = comparison.modes.v2;
    const leg = comparison.modes.legacy;
    const avg = (arr, key) => {
      const nums = arr.map((x) => x[key]).filter((n) => typeof n === "number");
      return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    };

    comparison.summary = {
      v2SuccessRate: v2.filter((x) => x.ok).length / v2.length,
      legacySuccessRate: leg.filter((x) => x.ok).length / leg.length,
      v2AvgLatencyMs: avg(v2, "latencyMs"),
      legacyAvgLatencyMs: avg(leg, "latencyMs"),
      v2AvgSchemaScore: avg(v2, "schemaScore"),
      legacyAvgSchemaScore: avg(leg, "schemaScore"),
      v2FallbackCount: v2.filter((x) => x.usedFallback).length,
      legacyFallbackCount: leg.filter((x) => x.usedFallback).length,
      v2CacheHits: v2.filter((x) => x.cacheHit === true).length,
      v2AvgCostUsd: (() => {
        const c = v2.map((x) => x.estimatedCostUsd).filter((n) => typeof n === "number");
        return c.length ? Number((c.reduce((a, b) => a + b, 0) / c.length).toFixed(6)) : null;
      })(),
    };
  } catch (err) {
    comparison.errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* best effort */
      }
    }
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "live-comparison.json"), JSON.stringify(comparison, null, 2));
  return comparison;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveComparison()
    .then((r) => {
      console.log(JSON.stringify(r.summary, null, 2));
      process.exit(r.errors.length || r.summary.v2SuccessRate < 1 ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
