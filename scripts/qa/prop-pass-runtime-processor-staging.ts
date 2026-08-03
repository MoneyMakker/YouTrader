import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const email = process.env.STAGING_QA_ALLOW_EMAIL ?? "";
const password = process.env.STAGING_QA_ALLOW_PASSWORD ?? "";
const expectedUserId = process.env.ALLOW_UID ?? process.env.STAGING_QA_ALLOW_USER_ID ?? "";
if (!url.includes("zleojeqkzizeyerhjpur") || !anonKey || !serviceKey || !email || !password || !expectedUserId) {
  throw new Error("REFUSE: complete staging QA environment is required");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false } });
const signed = await auth.auth.signInWithPassword({ email, password });
if (signed.error || !signed.data.session || signed.data.user?.id !== expectedUserId) throw new Error("staging disposable QA sign-in failed");

const { data: challenge, error: challengeError } = await admin
  .from("prop_challenges")
  .select("id,account_id")
  .eq("user_id", expectedUserId)
  .in("status", ["active", "at_risk", "passed", "funded"])
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (challengeError || !challenge) throw new Error("disposable staging challenge fixture unavailable");

const { data: priorRuntime } = await admin
  .from("prop_account_runtime_states")
  .select("*")
  .eq("user_id", expectedUserId)
  .eq("account_id", challenge.account_id)
  .maybeSingle();
const { data: priorKillSettings } = await admin.from("prop_kill_switch_settings").select("*").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).maybeSingle();
const { data: priorLiveSettings } = await admin.from("prop_live_risk_settings").select("*").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).maybeSingle();
const startedAt = new Date().toISOString();
const suffix = randomUUID();
const eventKey = `${challenge.account_id}:runtime-worker-qa:${suffix}`;
try {
  const inserted = await admin.from("prop_processed_journal_events").insert({
    user_id: expectedUserId,
    account_id: challenge.account_id,
    challenge_id: challenge.id,
    event_key: eventKey,
    event_type: "trade_saved",
    journal_trade_id: null,
    trade_client_id: `runtime-worker-qa-${suffix}`,
    trade_revision: 1,
    calculation_version: "build117.pipeline.v2",
    prior_event_key: null,
    input_digest: `qa-${suffix}`,
    processing_state: "pending",
  });
  if (inserted.error) throw new Error(`fixture insert failed:${inserted.error.code}`);
  const response = await fetch(`${url}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signed.data.session.access_token}`,
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ op: "process_pending" }),
  });
  const body = await response.json() as { kind?: string; report?: { applied?: number; failed?: number } };
  assert.equal(response.status, 200);
  assert.equal(body.kind, "success");
  assert.ok((body.report?.applied ?? 0) >= 1);
  assert.equal(body.report?.failed, 0);
  const [{ data: event }, { data: runtime }] = await Promise.all([
    admin.from("prop_processed_journal_events").select("processing_state,result_digest").eq("user_id", expectedUserId).eq("event_key", eventKey).single(),
    admin.from("prop_account_runtime_states").select("calculation_version,payload").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).single(),
  ]);
  assert.equal(event?.processing_state, "applied");
  assert.ok(event?.result_digest);
  assert.equal(runtime?.calculation_version, "build117.pipeline.v2");
  assert.equal((runtime?.payload as { calculationVersion?: string } | null)?.calculationVersion, "build117.pipeline.v2");
  const configuredAt = new Date().toISOString();
  const settingsResponse = await fetch(`${url}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: { Authorization: `Bearer ${signed.data.session.access_token}`, apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({
      op: "save_live_settings",
      accountId: challenge.account_id,
      settings: {
        rules: { id: "qa.live.rules", dailyRiskBudgetMinor: 50000, weeklyLossLimitMinor: 150000, maximumDrawdownMinor: 250000, perTradeRiskCapMinor: 25000, maximumTrades: 5, consecutiveLossLimit: 2, recoveryModeThresholdBps: 500 },
        configuredAt, selectedMode: "balanced", weekStartsOn: 1,
        normalRiskPerTradeMinor: 20000, normalMaximumContracts: 4,
        recoveryRiskBps: 5000, minimumCompliantProfitableSessions: 3,
      },
    }),
  });
  const settingsBody = await settingsResponse.json() as { kind?: string; report?: { failed?: number } };
  assert.equal(settingsResponse.status, 200);
  assert.equal(settingsBody.kind, "success");
  assert.equal(settingsBody.report?.failed, 0);
  const { data: savedSettings } = await admin.from("prop_live_risk_settings").select("payload").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).single();
  assert.equal((savedSettings?.payload as { selectedMode?: string } | null)?.selectedMode, "balanced");
  const lockResponse = await fetch(`${url}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: { Authorization: `Bearer ${signed.data.session.access_token}`, apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ op: "activate_session_lock", accountId: challenge.account_id, confirm: true }),
  });
  const lockBody = await lockResponse.json() as { kind?: string; report?: { failed?: number } };
  assert.equal(lockResponse.status, 200);
  assert.equal(lockBody.kind, "success");
  assert.equal(lockBody.report?.failed, 0);
  const [{ data: lockedSettings }, { data: lockedRuntime }] = await Promise.all([
    admin.from("prop_kill_switch_settings").select("payload").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).single(),
    admin.from("prop_account_runtime_states").select("payload").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).single(),
  ]);
  assert.equal((lockedSettings?.payload as { manualSessionLockConfirmed?: boolean } | null)?.manualSessionLockConfirmed, true);
  assert.equal((lockedRuntime?.payload as { status?: string } | null)?.status, "stop_trading");
  console.log("prop-pass-runtime-processor-staging: PASS");
} finally {
  await admin.from("prop_processed_journal_events").delete().eq("user_id", expectedUserId).eq("event_key", eventKey);
  const { data: settingsEvents } = await admin.from("prop_processed_journal_events").select("id").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).eq("event_type", "settings_changed").gte("created_at", startedAt);
  const settingsIds = (settingsEvents ?? []).map((row) => row.id);
  if (settingsIds.length) await admin.from("prop_processed_journal_events").delete().in("id", settingsIds);
  if (priorKillSettings) await admin.from("prop_kill_switch_settings").upsert(priorKillSettings, { onConflict: "user_id,account_id" });
  else await admin.from("prop_kill_switch_settings").delete().eq("user_id", expectedUserId).eq("account_id", challenge.account_id);
  if (priorLiveSettings) await admin.from("prop_live_risk_settings").upsert(priorLiveSettings, { onConflict: "user_id,account_id" });
  else await admin.from("prop_live_risk_settings").delete().eq("user_id", expectedUserId).eq("account_id", challenge.account_id);
  if (priorRuntime) {
    await admin.from("prop_account_runtime_states").upsert(priorRuntime, { onConflict: "user_id,account_id" });
  } else {
    await admin.from("prop_account_runtime_states").delete().eq("user_id", expectedUserId).eq("account_id", challenge.account_id);
  }
  await auth.auth.signOut();
}
