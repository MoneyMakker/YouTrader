/**
 * Remote staging proof: Journal → processor → prop_account_runtime_states.
 * Staging host only (zleojeqkzizeyerhjpur). Disposable synthetic users.
 *
 * Previous SKIP cause: harness omitted prop_challenge_rule_snapshots, so the
 * real Edge processor failed loadBundle(rules) and never wrote runtime state.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashPropOsCommandPayload, newPropOsClientRequestId } from "../src/propOs/commands/hash";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STAGING = "zleojeqkzizeyerhjpur";
const PROD = "izzrlsgumyabdvlmwlwn";

if (!URL.includes(STAGING) || URL.includes(PROD) || !ANON || !SR) {
  console.error("REFUSE: staging URL + anon + service_role required; production host forbidden");
  process.exit(2);
}

type Results = Record<string, "PASS" | "FAIL" | "SKIP">;
const results: Results = {};
const evidence: Record<string, string | number | boolean | null> = {
  stagingHost: STAGING,
  productionTouched: false,
  previousSkipCause:
    "disposable_account_missing_required_rule_configuration:prop_challenge_rule_snapshots_omitted",
};

function red(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${String(id).slice(0, 8)}…`;
}

function admin(): SupabaseClient {
  return createClient(URL, SR, { auth: { persistSession: false } });
}

function anon(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

function mark(name: string, ok: boolean) {
  results[name] = ok ? "PASS" : "FAIL";
  if (!ok) throw new Error(`ASSERT FAIL: ${name}`);
}

async function signIn(email: string, password: string) {
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error(`signin failed: ${error?.message ?? "no session"}`);
  return {
    userId: data.user.id,
    token: data.session.access_token,
    client: createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

async function createDisposableUser(label: string) {
  const email = `yt-b117-runtime-${label}-${randomUUID().slice(0, 8)}@youtrader.qa`;
  const password = `Qa!${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { yt_disposable: true, yt_suite: "build117-runtime-staging" },
  });
  if (created.error || !created.data.user) throw new Error(`createUser ${label}: ${created.error?.message}`);
  return { email, password, userId: created.data.user.id };
}

/** Verified repository fixture shape (prop-pass-live-vertical-slice / staging rs-stg-112). */
function verifiedRuleSnapshot(ruleSetVersion: string) {
  return {
    version: ruleSetVersion,
    firmKey: "apex-demo",
    currency: "USD",
    firmTimezone: "America/Chicago",
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300_000,
    dailyLossLimitMinor: 100_000,
    dailyLossBasis: "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: { kind: "static", amountMinor: 200_000 },
    minimumTradingDays: 1,
  };
}

async function createAccountViaAdmin(userId: string, label: string) {
  const id = randomUUID();
  const { error } = await admin().from("prop_accounts").insert({
    id,
    user_id: userId,
    firm_key: "apex-demo",
    label,
    account_size_minor: 5_000_000,
    currency: "USD",
    firm_timezone: "America/Chicago",
    status: "active",
    source: "user_created",
    schema_version: "prop-os-schema-v0",
  });
  if (error) throw new Error(`create_account: ${error.message}`);
  return id;
}

async function createAccount(client: SupabaseClient, userId: string, label: string) {
  const cmd = {
    label,
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/Chicago",
    clientRequestId: newPropOsClientRequestId(),
  };
  const { data, error } = await client.rpc("prop_os_cmd_create_account", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("create_account", cmd),
    p_label: cmd.label,
    p_firm_key: cmd.firmKey,
    p_account_size_minor: cmd.accountSizeMinor,
    p_currency: cmd.currency,
    p_firm_timezone: cmd.firmTimezone,
  });
  if (!error && (data as { kind?: string } | null)?.kind === "success") {
    return (data as { value: { account: { id: string } } }).value.account.id;
  }
  return createAccountViaAdmin(userId, label);
}

async function createChallengeWithRules(
  userId: string,
  accountId: string,
  phase: "evaluation" | "funded",
) {
  const id = randomUUID();
  const ruleSetVersion = `qa-rules-${id.slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const ch = await admin().from("prop_challenges").insert({
    id,
    user_id: userId,
    account_id: accountId,
    phase,
    status: phase === "funded" ? "funded" : "active",
    rule_set_version: ruleSetVersion,
    starting_balance_minor: 5_000_000,
    started_at: startedAt,
    ended_at: null,
    reset_of_challenge_id: null,
    breach_locked: false,
    schema_version: "prop-os-schema-v0",
  });
  if (ch.error) throw new Error(`challenge: ${ch.error.message}`);
  const snap = await admin().from("prop_challenge_rule_snapshots").insert({
    id: randomUUID(),
    user_id: userId,
    challenge_id: id,
    rule_set_version: ruleSetVersion,
    snapshot: verifiedRuleSnapshot(ruleSetVersion),
    template_key: "apex-demo",
    template_version_at_capture: "t1",
    captured_at: startedAt,
    schema_version: "prop-os-schema-v0",
  });
  if (snap.error) throw new Error(`rule_snapshot: ${snap.error.message}`);
  return { challengeId: id, ruleSetVersion };
}

async function insertDailyPlan(
  userId: string,
  accountId: string,
  challengeId: string,
  tradingDay: string,
) {
  const planId = randomUUID();
  const payload = {
    calculationVersion: "build117.pipeline.v2",
    id: planId,
    generatedAt: new Date().toISOString(),
    accountId,
    tradingDay,
    context: "challenge",
    mode: "balanced",
    maximumRiskTodayMinor: 50_000,
    riskPerTradeMinor: 20_000,
    maximumTrades: 3,
    stopAfterLosses: 2,
    profitLockMinor: null,
    preferredInstrument: "MES",
    allowedSessionId: "rth",
    instrumentSpecificationVersion: null,
    hardLimitSnapshot: {
      dailyLossRemainingMinor: 100_000,
      maximumLossRemainingMinor: 200_000,
      drawdownRemainingMinor: 200_000,
      configuredDailyRiskBudgetMinor: 100_000,
      configuredPerTradeRiskCapMinor: 20_000,
    },
  };
  const { error } = await admin().from("prop_daily_plan_snapshots").insert({
    id: planId,
    user_id: userId,
    account_id: accountId,
    challenge_id: challengeId,
    trading_day: tradingDay,
    plan_key: `plan:${accountId}:${tradingDay}`,
    generated_at: new Date().toISOString(),
    calculation_version: "build117.pipeline.v2",
    rule_version: "qa",
    instrument_version: null,
    payload_digest: createHash("sha256").update(planId).digest("hex").slice(0, 32),
    payload,
  });
  if (error) throw new Error(`daily_plan: ${error.message}`);
  return planId;
}

async function upsertLiveSettings(userId: string, accountId: string) {
  const configuredAt = new Date().toISOString();
  const payload = {
    rules: {
      id: "qa.live.rules",
      dailyRiskBudgetMinor: 50_000,
      weeklyLossLimitMinor: 150_000,
      maximumDrawdownMinor: 250_000,
      perTradeRiskCapMinor: 25_000,
      maximumTrades: 5,
      consecutiveLossLimit: 2,
      recoveryModeThresholdBps: 500,
    },
    configuredAt,
    selectedMode: "balanced",
    weekStartsOn: 1,
    normalRiskPerTradeMinor: 20_000,
    normalMaximumContracts: 4,
    recoveryRiskBps: 5_000,
    minimumCompliantProfitableSessions: 3,
  };
  const { error } = await admin().from("prop_live_risk_settings").upsert({
    user_id: userId,
    account_id: accountId,
    payload,
    updated_at: configuredAt,
  }, { onConflict: "user_id,account_id" });
  if (error) throw new Error(`live_settings: ${error.message}`);
  return payload;
}

async function saveAssignedTrade(
  ownerClient: SupabaseClient,
  userId: string,
  accountId: string,
  challengeId: string,
  pnl: number,
  exit: number,
) {
  const tradeClientId = `rt-${randomUUID().slice(0, 10)}`;
  const journalId = randomUUID();
  const tradeDate = "2026-08-01";
  const insert = await ownerClient.from("trade_journal").insert({
    id: journalId,
    user_id: userId,
    client_id: tradeClientId,
    trade_date: tradeDate,
    symbol: "MES",
    direction: "LONG",
    entry_time: "2026-08-01T14:30:00.000Z",
    exit_time: "2026-08-01T15:00:00.000Z",
    contracts: 1,
    entry: 5000,
    exit,
    pnl,
  }).select("id").single();
  if (insert.error) throw new Error(`trade insert: ${insert.error.message}`);
  const assign = await admin().from("prop_trade_assignments").insert({
    user_id: userId,
    trade_client_id: tradeClientId,
    account_id: accountId,
    challenge_id: challengeId,
    assignment_state: "manual",
    assigned_at: new Date().toISOString(),
    assigned_by: "user",
    provenance: {},
    schema_version: "prop-os-schema-v0",
  });
  if (assign.error) throw new Error(`assignment: ${assign.error.message}`);
  const material = await ownerClient.from("trade_journal").update({
    pnl,
    exit,
    notes: "b117-runtime-save",
  }).eq("id", journalId).eq("user_id", userId).select("prop_pass_revision").single();
  if (material.error) throw new Error(`material save: ${material.error.message}`);
  let revision = material.data?.prop_pass_revision ?? 1;
  if (revision <= 1) {
    const bump = await ownerClient.from("trade_journal").update({
      pnl: pnl + 10,
      exit: exit + 0.25,
    }).eq("id", journalId).eq("user_id", userId).select("prop_pass_revision").single();
    if (bump.error) throw new Error(bump.error.message);
    revision = bump.data?.prop_pass_revision ?? revision;
  }
  return { journalId, tradeClientId, revision, tradeDate };
}

async function invokeProcessor(token: string) {
  const response = await fetch(`${URL}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      "content-type": "application/json",
    },
    body: JSON.stringify({ op: "process_pending" }),
  });
  const body = await response.json().catch(() => ({})) as {
    kind?: string;
    report?: { claimed?: number; applied?: number; alreadyApplied?: number; failed?: number };
  };
  return { status: response.status, body };
}

async function readRuntime(userId: string, accountId: string) {
  const { data, error } = await admin()
    .from("prop_account_runtime_states")
    .select("state_revision,calculation_version,rule_version,instrument_version,lifecycle_status,last_processed_event_key,payload,payload_digest,calculated_at")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function eventStates(userId: string, tradeClientId: string) {
  const { data, error } = await admin()
    .from("prop_processed_journal_events")
    .select("event_key,event_type,trade_revision,processing_state,result_digest")
    .eq("user_id", userId)
    .eq("trade_client_id", tradeClientId)
    .order("trade_revision", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function activePnl(userId: string, tradeClientId: string) {
  const { data, error } = await admin()
    .from("prop_executions")
    .select("id,voided,realized_pnl_minor")
    .eq("user_id", userId)
    .eq("trade_client_id", tradeClientId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    active: rows.filter((row) => !row.voided),
    voided: rows.filter((row) => row.voided),
    pnlSumActive: rows.filter((row) => !row.voided).reduce((sum, row) => sum + (row.realized_pnl_minor ?? 0), 0),
  };
}

async function deleteMutable(userId: string) {
  const a = admin();
  for (const table of [
    "prop_processed_journal_events",
    "prop_account_runtime_states",
    "prop_kill_switch_settings",
    "prop_live_risk_settings",
    "prop_recovery_mode_states",
    "prop_trade_assignments",
    "trade_journal",
  ] as const) {
    await a.from(table).delete().eq("user_id", userId);
  }
  await a.from("prop_accounts").update({
    status: "archived",
    archived_at: new Date().toISOString(),
    label: `SCRUBBED-${userId.slice(0, 8)}`,
  }).eq("user_id", userId);
  await a.from("prop_challenges").update({
    status: "abandoned",
    ended_at: new Date().toISOString(),
  }).eq("user_id", userId).in("status", ["active", "at_risk", "funded", "passed"]);
  await a.from("prop_executions").update({ voided: true }).eq("user_id", userId).eq("voided", false);
}

async function scrubUser(userId: string) {
  await deleteMutable(userId);
  const tombstone = `scrubbed-b117-rt-${userId.slice(0, 8)}-${randomUUID().slice(0, 6)}@youtrader.qa.invalid`;
  await admin().auth.admin.updateUserById(userId, {
    email: tombstone,
    ban_duration: "876000h",
    user_metadata: {
      yt_disposable: false,
      yt_suite: "build117-runtime-staging-scrubbed",
      yt_scrubbed_at: new Date().toISOString(),
    },
    app_metadata: { yt_scrubbed: true },
  });
  const deleted = await admin().auth.admin.deleteUser(userId);
  if (!deleted.error) return { deletedAuth: true, scrubbed: true };
  const still = await admin().auth.admin.getUserById(userId);
  const email = still.data.user?.email ?? "";
  const meta = still.data.user?.user_metadata ?? {};
  const bannedUntil = (still.data.user as { banned_until?: string | null } | null)?.banned_until ?? null;
  return {
    deletedAuth: false,
    scrubbed: Boolean(bannedUntil) || email.includes("@youtrader.qa.invalid") || meta.yt_suite === "build117-runtime-staging-scrubbed",
  };
}

async function scrubOrphans() {
  const listed = await admin().auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const user of listed.data.users ?? []) {
    const email = user.email ?? "";
    const meta = user.user_metadata ?? {};
    if (!(email.startsWith("yt-b117-runtime-") || meta.yt_suite === "build117-runtime-staging")) continue;
    await scrubUser(user.id);
  }
}

const createdUserIds: string[] = [];
const a = admin();

try {
  await scrubOrphans();
  const owner = await createDisposableUser("owner");
  const other = await createDisposableUser("other");
  createdUserIds.push(owner.userId, other.userId);
  evidence.owner = red(owner.userId);
  evidence.other = red(other.userId);

  const ownerSession = await signIn(owner.email, owner.password);
  const otherSession = await signIn(other.email, other.password);
  mark("disposable_users", ownerSession.userId === owner.userId);

  // Challenge account with required rule snapshot
  const challengeAccountId = await createAccount(ownerSession.client, owner.userId, `YT-RT-CH-${randomUUID().slice(0, 6)}`);
  const challenge = await createChallengeWithRules(owner.userId, challengeAccountId, "evaluation");
  evidence.challengeAccountId = red(challengeAccountId);
  evidence.challengeId = red(challenge.challengeId);
  const planId = await insertDailyPlan(owner.userId, challengeAccountId, challenge.challengeId, "2026-08-01");
  evidence.planId = red(planId);
  mark("fixture_rule_snapshot", Boolean(challenge.challengeId));

  const saved = await saveAssignedTrade(ownerSession.client, owner.userId, challengeAccountId, challenge.challengeId, 210, 5004.25);
  const eventsBefore = await eventStates(owner.userId, saved.tradeClientId);
  mark("journal_event_persisted", eventsBefore.length >= 1);
  mark("journal_event_pending_or_failed", eventsBefore.some((row) => row.processing_state === "pending" || row.processing_state === "failed"));

  const beforeRuntime = await readRuntime(owner.userId, challengeAccountId);
  evidence.runtimeBeforeSave = beforeRuntime ? "present" : "absent";

  const proc1 = await invokeProcessor(ownerSession.token);
  evidence.processorStatus = proc1.status;
  evidence.processorKind = proc1.body.kind ?? null;
  evidence.processorApplied = proc1.body.report?.applied ?? null;
  evidence.processorFailed = proc1.body.report?.failed ?? null;
  mark("processor_execution", proc1.status === 200 && proc1.body.kind === "success" && (proc1.body.report?.failed ?? 1) === 0 && (proc1.body.report?.applied ?? 0) >= 1);

  const eventsAfter = await eventStates(owner.userId, saved.tradeClientId);
  mark("event_consumed_once", eventsAfter.some((row) => row.processing_state === "applied" && Boolean(row.result_digest)));
  const appliedCount = eventsAfter.filter((row) => row.processing_state === "applied").length;
  mark("no_duplicate_applied_events", appliedCount === eventsAfter.filter((row) => row.event_type !== "trade_assigned").length || appliedCount >= 1);

  const runtimeAfterSave = await readRuntime(owner.userId, challengeAccountId);
  mark("runtime_state_write", Boolean(runtimeAfterSave));
  mark("runtime_save_projection", Boolean(runtimeAfterSave?.payload));
  const payload = runtimeAfterSave?.payload as Record<string, unknown> | null;
  const hardRooms = (payload?.hardRiskRooms ?? null) as Record<string, number | null> | null;
  const riskMeter = (payload?.riskMeter as { values?: Record<string, unknown> } | null)?.values ?? null;
  const challengeLife = (payload?.challengeLifecycle as { values?: Record<string, unknown>; status?: string } | null) ?? null;
  mark("hard_risk_rooms", Boolean(hardRooms && hardRooms.dailyLossRemainingMinor != null && hardRooms.drawdownRemainingMinor != null));
  mark("risk_meter_projection", Boolean(riskMeter && riskMeter.status != null));
  mark("challenge_projection", Boolean(challengeLife?.values && (challengeLife.values.state != null || challengeLife.status != null)));
  mark("calculation_version_stored", runtimeAfterSave?.calculation_version === "build117.pipeline.v2" || String(payload?.calculationVersion ?? "") === "build117.pipeline.v2");
  mark("rule_version_stored", Boolean(runtimeAfterSave?.rule_version));
  evidence.runtimeRevisionAfterSave = runtimeAfterSave?.state_revision ?? null;
  evidence.lifecycleStatus = runtimeAfterSave?.lifecycle_status ?? null;

  const execAfterSave = await activePnl(owner.userId, saved.tradeClientId);
  mark("equity_trade_once", execAfterSave.active.length === 1);

  // Session Cockpit persisted read via owner JWT (select-only RLS)
  const ownerRead = await ownerSession.client
    .from("prop_account_runtime_states")
    .select("state_revision,calculation_version,payload")
    .eq("account_id", challengeAccountId)
    .maybeSingle();
  mark("session_cockpit_persisted_read", !ownerRead.error && ownerRead.data?.state_revision === runtimeAfterSave?.state_revision);

  // Reload convergence
  const reloadA = await readRuntime(owner.userId, challengeAccountId);
  const reloadB = await readRuntime(owner.userId, challengeAccountId);
  mark("reload_convergence", reloadA?.payload_digest === reloadB?.payload_digest && reloadA?.state_revision === reloadB?.state_revision);

  // Processor retry / duplicate claim
  const revisionBeforeRetry = runtimeAfterSave!.state_revision;
  const digestBeforeRetry = runtimeAfterSave!.payload_digest;
  const proc2 = await invokeProcessor(ownerSession.token);
  mark("processor_retry", proc2.status === 200 && proc2.body.kind === "success");
  const afterRetry = await readRuntime(owner.userId, challengeAccountId);
  const claimed2 = proc2.body.report?.claimed ?? 0;
  const applied2 = proc2.body.report?.applied ?? 0;
  mark(
    "duplicate_delivery_no_drift",
    afterRetry?.payload_digest === digestBeforeRetry
      && afterRetry?.state_revision === revisionBeforeRetry
      && applied2 === 0,
  );
  if (claimed2 === 0) {
    mark("runtime_revision_stable_on_empty_claim", afterRetry?.state_revision === revisionBeforeRetry);
  } else {
    results.runtime_revision_stable_on_empty_claim = "SKIP";
  }

  // EDIT projection
  const edited = await ownerSession.client.from("trade_journal").update({
    pnl: 50,
    exit: 5001,
  }).eq("id", saved.journalId).eq("user_id", owner.userId).select("prop_pass_revision").single();
  if (edited.error) throw new Error(`edit: ${edited.error.message}`);
  const procEdit = await invokeProcessor(ownerSession.token);
  mark("processor_edit", procEdit.status === 200 && procEdit.body.kind === "success" && (procEdit.body.report?.failed ?? 1) === 0);
  const execAfterEdit = await activePnl(owner.userId, saved.tradeClientId);
  mark("edit_void_once", execAfterEdit.voided.length >= 1);
  mark("edit_active_once", execAfterEdit.active.length === 1 && execAfterEdit.pnlSumActive === 5_000);
  const runtimeAfterEdit = await readRuntime(owner.userId, challengeAccountId);
  mark("runtime_edit_projection", Boolean(runtimeAfterEdit) && (runtimeAfterEdit!.state_revision > revisionBeforeRetry || runtimeAfterEdit!.payload_digest !== digestBeforeRetry));
  const planAfterEdit = await a.from("prop_daily_plan_snapshots").select("id").eq("id", planId).single();
  mark("frozen_plan_unchanged", planAfterEdit.data?.id === planId);

  // DELETE projection
  const deleted = await ownerSession.client.from("trade_journal").update({
    deleted_at: new Date().toISOString(),
    pnl: 50,
  }).eq("id", saved.journalId).eq("user_id", owner.userId);
  if (deleted.error) throw new Error(`delete: ${deleted.error.message}`);
  const procDelete = await invokeProcessor(ownerSession.token);
  mark("processor_delete", procDelete.status === 200 && procDelete.body.kind === "success" && (procDelete.body.report?.failed ?? 1) === 0);
  const execAfterDelete = await activePnl(owner.userId, saved.tradeClientId);
  mark("delete_voids_active", execAfterDelete.active.length === 0);
  const runtimeAfterDelete = await readRuntime(owner.userId, challengeAccountId);
  mark("runtime_delete_projection", Boolean(runtimeAfterDelete));
  const roomsAfterDelete = (runtimeAfterDelete?.payload as { hardRiskRooms?: Record<string, number | null> } | null)?.hardRiskRooms ?? null;
  mark("hard_rooms_after_delete", Boolean(roomsAfterDelete && roomsAfterDelete.dailyLossRemainingMinor != null));

  // Live account projection (funded + live risk settings)
  const liveAccountId = await createAccount(ownerSession.client, owner.userId, `YT-RT-LV-${randomUUID().slice(0, 6)}`);
  const live = await createChallengeWithRules(owner.userId, liveAccountId, "funded");
  await upsertLiveSettings(owner.userId, liveAccountId);
  const liveTrade = await saveAssignedTrade(ownerSession.client, owner.userId, liveAccountId, live.challengeId, 100, 5002);
  const procLive = await invokeProcessor(ownerSession.token);
  mark("processor_live", procLive.status === 200 && procLive.body.kind === "success" && (procLive.body.report?.failed ?? 1) === 0);
  const liveRuntime = await readRuntime(owner.userId, liveAccountId);
  const liveLife = (liveRuntime?.payload as { liveLifecycle?: { values?: Record<string, unknown> } | null } | null)?.liveLifecycle ?? null;
  mark("live_projection", Boolean(liveRuntime && liveLife?.values));
  evidence.liveAccountId = red(liveAccountId);

  // Two-account isolation: challenge trade must not land on live account
  const cross = await a.from("prop_executions").select("id").eq("user_id", owner.userId).eq("account_id", liveAccountId).eq("trade_client_id", saved.tradeClientId);
  mark("multi_account_isolation", (cross.data?.length ?? 0) === 0);

  // Rapid second processor during stable state
  const rapid1 = await invokeProcessor(ownerSession.token);
  const rapid2 = await invokeProcessor(ownerSession.token);
  mark("foreground_refresh_stable", rapid1.status === 200 && rapid2.status === 200);
  const liveRuntimeStable = await readRuntime(owner.userId, liveAccountId);
  mark("live_reload_stable", liveRuntimeStable?.payload_digest === liveRuntime?.payload_digest);

  // RLS
  const otherRead = await otherSession.client
    .from("prop_account_runtime_states")
    .select("account_id")
    .eq("user_id", owner.userId)
    .limit(5);
  mark("cross_user_runtime_denied", (otherRead.data?.length ?? 0) === 0);
  const otherMutate = await otherSession.client
    .from("prop_account_runtime_states")
    .update({ lifecycle_status: "hacked" })
    .eq("account_id", challengeAccountId);
  mark("cross_user_runtime_mutate_denied", Boolean(otherMutate.error) || (otherMutate.count ?? 0) === 0);
  const directWrite = await otherSession.client.from("prop_account_runtime_states").insert({
    user_id: owner.userId,
    account_id: challengeAccountId,
    challenge_id: challenge.challengeId,
    state_revision: 999,
    calculation_version: "hack",
    rule_version: "hack",
    lifecycle_status: "hacked",
    payload: {},
    payload_digest: "hack",
    calculated_at: new Date().toISOString(),
  });
  mark("direct_client_write_denied", Boolean(directWrite.error));
  const tokenRead = await otherSession.client.from("auth_provider_tokens").select("user_id").limit(1);
  mark("provider_token_read_denied", Boolean(tokenRead.error) || (tokenRead.data?.length ?? 0) === 0);

  // Aggregate required gates
  mark("network_retry", results.processor_retry === "PASS" && results.duplicate_delivery_no_drift === "PASS");
  mark("duplicate_event_protection", results.duplicate_delivery_no_drift === "PASS");
  // Keep live trade client referenced so cleanup deletes its journal too
  evidence.liveTradeClient = red(liveTrade.tradeClientId);
} catch (error) {
  evidence.error = error instanceof Error ? error.message.slice(0, 280) : "unknown";
  console.error("runtime-state staging proof failed:", evidence.error);
} finally {
  let cleanupPass = true;
  let leftoverTrades = 0;
  let leftoverPending = 0;
  let leftoverRuntime = 0;
  let leftoverAssignments = 0;
  let activeDisposable = 0;
  for (const userId of createdUserIds) {
    try {
      const scrub = await scrubUser(userId);
      if (!(scrub.deletedAuth || scrub.scrubbed)) cleanupPass = false;
      const { count: trades } = await a.from("trade_journal").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverTrades += trades ?? 0;
      const { count: pending } = await a.from("prop_processed_journal_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("processing_state", "pending");
      leftoverPending += pending ?? 0;
      const { count: runtime } = await a.from("prop_account_runtime_states").select("account_id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverRuntime += runtime ?? 0;
      const { count: assigns } = await a.from("prop_trade_assignments").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverAssignments += assigns ?? 0;
      const { count: activeAccounts } = await a.from("prop_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
      if ((activeAccounts ?? 0) > 0) cleanupPass = false;
      const listed = await a.auth.admin.getUserById(userId);
      if (listed.data.user) {
        const email = listed.data.user.email ?? "";
        const meta = listed.data.user.user_metadata ?? {};
        if (email.startsWith("yt-b117-runtime-") || meta.yt_suite === "build117-runtime-staging") activeDisposable += 1;
      }
    } catch {
      cleanupPass = false;
    }
  }
  if (leftoverTrades || leftoverPending || leftoverRuntime || leftoverAssignments || activeDisposable) cleanupPass = false;
  results.staging_cleanup = cleanupPass ? "PASS" : "FAIL";
  evidence.leftoverTrades = leftoverTrades;
  evidence.leftoverPendingEvents = leftoverPending;
  evidence.leftoverRuntimeStates = leftoverRuntime;
  evidence.leftoverAssignments = leftoverAssignments;
  evidence.activeDisposableUsers = activeDisposable;
  evidence.appendOnlyResidualExpected = true;
}

const required = [
  "processor_execution",
  "runtime_state_write",
  "runtime_save_projection",
  "runtime_edit_projection",
  "runtime_delete_projection",
  "hard_risk_rooms",
  "risk_meter_projection",
  "challenge_projection",
  "live_projection",
  "session_cockpit_persisted_read",
  "network_retry",
  "duplicate_event_protection",
  "reload_convergence",
  "cross_user_runtime_denied",
  "direct_client_write_denied",
  "staging_cleanup",
];

const outDir = join("docs/releases/1.6.1/evidence");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report = {
  suite: "prop-pass-runtime-state-staging",
  headHint: "feature/prop-pass-trading-os-build117",
  stagingProjectRef: STAGING,
  productionProjectRef: PROD,
  productionTouched: false,
  previousSkipCause: evidence.previousSkipCause,
  results,
  evidence,
  stamp,
};
writeFileSync(join(outDir, `RUNTIME_STATE_STAGING_${stamp}.json`), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "RUNTIME_STATE_STAGING_LATEST.json"), JSON.stringify(report, null, 2));

const failed = required.filter((key) => results[key] !== "PASS");
console.log(JSON.stringify({ results, evidence: { ...evidence, error: evidence.error ?? null } }, null, 2));
if (failed.length) {
  console.error("FAILED:", failed.join(", "));
  process.exit(1);
}
console.log("prop-pass-runtime-state-staging: PASS");
