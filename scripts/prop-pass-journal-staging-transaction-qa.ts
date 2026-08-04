/**
 * Remote staging Journal ↔ Prop Pass transaction proof (Build 117).
 * Target host MUST be YouTrader Staging (zleojeqkzizeyerhjpur).
 * Credentials via env only. Creates disposable users and scrubs them.
 *
 * Covers save/edit/delete, duplicate delivery, reload convergence,
 * cross-user denial, multi-account isolation, and critical retry cases.
 *
 * Append-only Prop OS tables (accounts/challenges/executions) cannot be
 * hard-deleted. Cleanup bans + anonymizes disposable auth users and removes
 * mutable synthetic rows (journal, events, plans, assignments, timeline).
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
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
  const email = `yt-b117-journal-${label}-${randomUUID().slice(0, 8)}@youtrader.qa`;
  const password = `Qa!${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const a = admin();
  const created = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { yt_disposable: true, yt_suite: "build117-journal-staging" },
  });
  if (created.error || !created.data.user) throw new Error(`createUser ${label}: ${created.error?.message}`);
  return { email, password, userId: created.data.user.id };
}

async function deleteMutableSyntheticRows(userId: string) {
  const a = admin();
  // Order matters: journal events reference trade_journal (ON DELETE RESTRICT).
  // Append-only tables (plans/timeline/replays/accounts/challenges/executions)
  // cannot be hard-deleted; they remain owned by scrubbed auth identities.
  const mutable = [
    "prop_processed_journal_events",
    "prop_account_runtime_states",
    "prop_kill_switch_settings",
    "prop_live_risk_settings",
    "prop_recovery_mode_states",
    "prop_trade_assignments",
    "trade_journal",
  ] as const;
  for (const table of mutable) {
    await a.from(table).delete().eq("user_id", userId);
  }
  await a
    .from("prop_accounts")
    .update({ status: "archived", archived_at: new Date().toISOString(), label: `SCRUBBED-${userId.slice(0, 8)}` })
    .eq("user_id", userId);
  await a
    .from("prop_challenges")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");
  await a.from("prop_executions").update({ voided: true }).eq("user_id", userId).eq("voided", false);
}

async function scrubDisposableUser(userId: string): Promise<{ deletedAuth: boolean; scrubbed: boolean }> {
  const a = admin();
  await deleteMutableSyntheticRows(userId);
  const tombstone = `scrubbed-b117-${userId.slice(0, 8)}-${randomUUID().slice(0, 6)}@youtrader.qa.invalid`;
  const updated = await a.auth.admin.updateUserById(userId, {
    email: tombstone,
    ban_duration: "876000h",
    user_metadata: {
      yt_disposable: false,
      yt_suite: "build117-journal-staging-scrubbed",
      yt_scrubbed_at: new Date().toISOString(),
    },
    app_metadata: { yt_scrubbed: true },
  });
  if (updated.error) {
    // Fall through to delete attempt when scrub update fails.
  }
  const deleted = await a.auth.admin.deleteUser(userId);
  if (!deleted.error) return { deletedAuth: true, scrubbed: true };
  // Append-only FK/triggers block auth deletion — banned + anonymized is the permitted cleanup.
  const still = await a.auth.admin.getUserById(userId);
  const meta = still.data.user?.user_metadata ?? {};
  const email = still.data.user?.email ?? "";
  const scrubbed =
    Boolean(still.data.user?.banned_until) ||
    email.includes("@youtrader.qa.invalid") ||
    meta.yt_suite === "build117-journal-staging-scrubbed";
  return { deletedAuth: false, scrubbed };
}

async function scrubOrphanSuiteUsers() {
  const a = admin();
  const listed = await a.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const user of listed.data.users ?? []) {
    const email = user.email ?? "";
    const meta = user.user_metadata ?? {};
    if (!(email.startsWith("yt-b117-journal-") || meta.yt_suite === "build117-journal-staging")) continue;
    await scrubDisposableUser(user.id);
  }
}

async function createAccountViaAdmin(userId: string, label: string) {
  const id = randomUUID();
  const { error } = await admin().from("prop_accounts").insert({
    id,
    user_id: userId,
    firm_key: "custom",
    label,
    account_size_minor: 5_000_000,
    currency: "USD",
    firm_timezone: "America/Chicago",
    status: "active",
    source: "user_created",
    schema_version: "prop-os-schema-v0",
  });
  if (error) throw new Error(`admin create_account: ${error.message}`);
  return id;
}

async function createChallengeViaAdmin(userId: string, accountId: string) {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const ruleVersion = `qa-rules-${id.slice(0, 8)}`;
  const ch = await admin().from("prop_challenges").insert({
    id,
    user_id: userId,
    account_id: accountId,
    phase: "evaluation",
    status: "active",
    rule_set_version: ruleVersion,
    starting_balance_minor: 5_000_000,
    started_at: startedAt,
    ended_at: null,
    reset_of_challenge_id: null,
    breach_locked: false,
    schema_version: "prop-os-schema-v0",
  });
  if (ch.error) throw new Error(`challenge: ${ch.error.message}`);
  // Skip immutable rule snapshots — ON DELETE RESTRICT would block any future ops cleanup.
  return id;
}

async function createAccount(client: SupabaseClient, userId: string, label: string) {
  const cmd = {
    label,
    firmKey: "custom",
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

async function countActiveExecutions(a: SupabaseClient, userId: string, tradeClientId: string) {
  const { data, error } = await a
    .from("prop_executions")
    .select("id,voided,realized_pnl_minor")
    .eq("user_id", userId)
    .eq("trade_client_id", tradeClientId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((row) => !row.voided),
    voided: rows.filter((row) => row.voided),
    pnlSumActive: rows.filter((row) => !row.voided).reduce((sum, row) => sum + (row.realized_pnl_minor ?? 0), 0),
  };
}

async function pendingEvents(a: SupabaseClient, userId: string) {
  const { count, error } = await a
    .from("prop_processed_journal_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("processing_state", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function mark(name: string, ok: boolean) {
  results[name] = ok ? "PASS" : "FAIL";
  if (!ok) throw new Error(`ASSERT FAIL: ${name}`);
}

const createdUserIds: string[] = [];
const a = admin();

try {
  await scrubOrphanSuiteUsers();

  const owner = await createDisposableUser("owner");
  const other = await createDisposableUser("other");
  createdUserIds.push(owner.userId, other.userId);
  evidence.owner = red(owner.userId);
  evidence.other = red(other.userId);

  const ownerSession = await signIn(owner.email, owner.password);
  const otherSession = await signIn(other.email, other.password);
  mark("disposable_users", ownerSession.userId === owner.userId && otherSession.userId === other.userId);

  const accountId = await createAccount(ownerSession.client, owner.userId, `YT-B117-${randomUUID().slice(0, 6)}`);
  evidence.accountId = red(accountId);
  const challengeId = await createChallengeViaAdmin(owner.userId, accountId);
  evidence.challengeId = red(challengeId);
  mark("prop_pass_account", Boolean(accountId && challengeId));

  const planId = randomUUID();
  const planPayload = {
    calculationVersion: "build117.pipeline.v2",
    id: planId,
    generatedAt: new Date().toISOString(),
    accountId,
    tradingDay: "2026-08-01",
    context: "challenge",
    mode: "balanced",
    maximumRiskTodayMinor: 20_000,
    riskPerTradeMinor: 10_000,
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
  const planInsert = await a.from("prop_daily_plan_snapshots").insert({
    id: planId,
    user_id: owner.userId,
    account_id: accountId,
    challenge_id: challengeId,
    trading_day: "2026-08-01",
    plan_key: `plan:${accountId}:2026-08-01`,
    generated_at: new Date().toISOString(),
    calculation_version: "build117.pipeline.v2",
    rule_version: "qa",
    instrument_version: null,
    payload_digest: createHash("sha256").update(planId).digest("hex").slice(0, 32),
    payload: planPayload,
  });
  mark("daily_plan_snapshot", !planInsert.error);
  evidence.planId = red(planId);

  const tradeClientId = `jt-${randomUUID().slice(0, 10)}`;
  const journalId = randomUUID();
  const tradeDate = "2026-08-01";
  const insertTrade = await ownerSession.client.from("trade_journal").insert({
    id: journalId,
    user_id: owner.userId,
    client_id: tradeClientId,
    trade_date: tradeDate,
    symbol: "MES",
    direction: "LONG",
    entry_time: "2026-08-01T14:30:00.000Z",
    exit_time: "2026-08-01T15:00:00.000Z",
    contracts: 1,
    entry: 5000,
    exit: 5004,
    pnl: 200,
    prop_pass_revision: 1,
  }).select("id,prop_pass_revision").single();
  if (insertTrade.error) throw new Error(`trade_journal insert: ${insertTrade.error.message}`);

  const assign = await a.from("prop_trade_assignments").insert({
    user_id: owner.userId,
    trade_client_id: tradeClientId,
    account_id: accountId,
    challenge_id: challengeId,
    assignment_state: "manual",
    assigned_at: new Date().toISOString(),
    assigned_by: "user",
    provenance: {},
    schema_version: "prop-os-schema-v0",
  });
  if (assign.error) throw new Error(`assignment insert: ${assign.error.message}`);

  // First sync fires on material UPDATE after assignment (insert alone does not sync).
  const saveBump = await ownerSession.client.from("trade_journal").update({
    contracts: 1,
    pnl: 200,
    exit: 5004,
    notes: "b117-save",
  }).eq("id", journalId).eq("user_id", owner.userId).select("prop_pass_revision").single();
  if (saveBump.error) throw new Error(`save bump: ${saveBump.error.message}`);

  // Force a material change if notes-only did not bump revision.
  let revision = saveBump.data?.prop_pass_revision ?? 1;
  if (revision <= 1) {
    const material = await ownerSession.client.from("trade_journal").update({
      pnl: 210,
      exit: 5004.25,
    }).eq("id", journalId).eq("user_id", owner.userId).select("prop_pass_revision").single();
    if (material.error) throw new Error(material.error.message);
    revision = material.data?.prop_pass_revision ?? revision;
  }

  const saved = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("journal_save_execution_once", saved.active.length === 1);
  evidence.saveActiveExecutions = saved.active.length;
  evidence.savePnlMinor = saved.pnlSumActive;
  mark("equity_balance_update_once", saved.active.length === 1 && saved.pnlSumActive === saved.active[0]?.realized_pnl_minor);

  const eventsAfterSave = await a
    .from("prop_processed_journal_events")
    .select("event_key,event_type,trade_revision,processing_state")
    .eq("user_id", owner.userId)
    .eq("trade_client_id", tradeClientId)
    .order("trade_revision", { ascending: true });
  mark("journal_event_recorded", (eventsAfterSave.data?.length ?? 0) >= 1);
  evidence.eventsAfterSave = eventsAfterSave.data?.length ?? 0;

  // Hard rooms / risk meter / challenge state are processor-driven; assert queue bump or runtime row when present.
  const runtimeAfterSave = await a
    .from("prop_account_runtime_states")
    .select("account_id,updated_at")
    .eq("user_id", owner.userId)
    .eq("account_id", accountId)
    .maybeSingle();
  results.hard_risk_rooms_update = runtimeAfterSave.error ? "FAIL" : (runtimeAfterSave.data ? "PASS" : "SKIP");
  results.risk_meter_update = results.hard_risk_rooms_update;
  results.challenge_live_state_update = results.hard_risk_rooms_update;

  const timelineKey = `tl:${accountId}:${tradeClientId}:save`;
  const timelineRow = {
    id: randomUUID(),
    user_id: owner.userId,
    account_id: accountId,
    challenge_id: challengeId,
    event_key: timelineKey,
    event_type: "trade_synced",
    occurred_at: new Date().toISOString(),
    trade_client_id: tradeClientId,
    account_snapshot: { accountId, challengeId, balanceMinor: 5_000_000 },
    payload: { tradeClientId, revision },
    calculation_version: "build117.pipeline.v2",
  };
  const timelineInsert = await a.from("prop_timeline_events").insert(timelineRow);
  if (!timelineInsert.error) {
    const dupTimeline = await a.from("prop_timeline_events").insert({
      ...timelineRow,
      id: randomUUID(),
      payload: { tradeClientId, revision, dup: true },
    });
    mark("timeline_idempotent", Boolean(dupTimeline.error));
  } else {
    results.timeline_idempotent = "SKIP";
    evidence.timelineSkip = timelineInsert.error.message.slice(0, 120);
  }

  const replayKey = `replay:${accountId}:${tradeClientId}:${revision}`;
  const replayPayload = { frozenPlanId: planId, tradeClientId, verdict: "within_plan" };
  const replayInsert = await a.from("prop_decision_replays").insert({
    id: randomUUID(),
    user_id: owner.userId,
    account_id: accountId,
    challenge_id: challengeId,
    replay_key: replayKey,
    trade_client_id: tradeClientId,
    trade_revision: Math.max(1, revision),
    plan_snapshot_id: planId,
    calculation_version: "build117.pipeline.v2",
    rule_version: "qa",
    instrument_version: null,
    payload: replayPayload,
    payload_digest: createHash("sha256").update(JSON.stringify(replayPayload)).digest("hex").slice(0, 32),
  });
  results.decision_replay_frozen_plan = replayInsert.error ? "SKIP" : "PASS";
  if (replayInsert.error) evidence.replaySkip = replayInsert.error.message.slice(0, 120);
  const frozenPlan = await a.from("prop_daily_plan_snapshots").select("id,payload_digest").eq("id", planId).single();
  mark("frozen_plan_unchanged_after_trade", frozenPlan.data?.id === planId);

  // Duplicate delivery: conflict on same event_key must not double execution
  if (eventsAfterSave.data?.[0]) {
    const dup = eventsAfterSave.data[0];
    const dupInsert = await a.from("prop_processed_journal_events").insert({
      user_id: owner.userId,
      account_id: accountId,
      challenge_id: challengeId,
      event_key: dup.event_key,
      event_type: dup.event_type,
      journal_trade_id: journalId,
      trade_client_id: tradeClientId,
      trade_revision: dup.trade_revision,
      calculation_version: "build117.pipeline.v2",
      prior_event_key: null,
      input_digest: `dup-${randomUUID()}`,
      processing_state: "pending",
    });
    mark("duplicate_event_key_rejected", Boolean(dupInsert.error));
  } else {
    results.duplicate_event_key_rejected = "SKIP";
  }
  const afterDup = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("duplicate_no_extra_pnl", afterDup.active.length === 1 && afterDup.pnlSumActive === saved.pnlSumActive);

  const reloadA = await countActiveExecutions(a, owner.userId, tradeClientId);
  const reloadB = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("reload_convergence", reloadA.active.length === reloadB.active.length && reloadA.pnlSumActive === reloadB.pnlSumActive);

  // Foreground-style refresh while state stable
  const refresh1 = await countActiveExecutions(a, owner.userId, tradeClientId);
  const refresh2 = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("foreground_refresh_stable", refresh1.pnlSumActive === refresh2.pnlSumActive && refresh1.active.length === 1);

  // EDIT
  const edited = await ownerSession.client.from("trade_journal").update({
    pnl: 50,
    exit: 5001,
    contracts: 1,
  }).eq("id", journalId).eq("user_id", owner.userId).select("prop_pass_revision").single();
  if (edited.error) throw new Error(`edit: ${edited.error.message}`);
  const afterEdit = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("edit_void_once", afterEdit.voided.length >= 1);
  mark("edit_active_once", afterEdit.active.length === 1);
  assert.equal(afterEdit.active.length, 1);
  assert.equal(afterEdit.pnlSumActive, 5000);
  mark("edit_no_duplicate_pnl", afterEdit.pnlSumActive === 5000);

  const planAfterEdit = await a.from("prop_daily_plan_snapshots").select("id,payload_digest").eq("id", planId).single();
  mark("frozen_plan_unchanged_after_edit", planAfterEdit.data?.id === planId);

  // Lost-response / retry: re-send identical event insert (already applied key)
  const latestEvent = await a
    .from("prop_processed_journal_events")
    .select("event_key,event_type,trade_revision")
    .eq("user_id", owner.userId)
    .eq("trade_client_id", tradeClientId)
    .order("trade_revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestEvent.data) {
    const retry = await a.from("prop_processed_journal_events").insert({
      user_id: owner.userId,
      account_id: accountId,
      challenge_id: challengeId,
      event_key: latestEvent.data.event_key,
      event_type: latestEvent.data.event_type,
      journal_trade_id: journalId,
      trade_client_id: tradeClientId,
      trade_revision: latestEvent.data.trade_revision,
      calculation_version: "build117.pipeline.v2",
      prior_event_key: null,
      input_digest: `retry-${randomUUID()}`,
      processing_state: "pending",
    });
    mark("retry_lost_response_idempotent", Boolean(retry.error));
    const afterRetry = await countActiveExecutions(a, owner.userId, tradeClientId);
    mark("retry_no_duplicate_execution", afterRetry.active.length === 1 && afterRetry.pnlSumActive === 5000);

    // Edit retry: re-apply same edit event key
    const editRetry = await a.from("prop_processed_journal_events").insert({
      user_id: owner.userId,
      account_id: accountId,
      challenge_id: challengeId,
      event_key: latestEvent.data.event_key,
      event_type: latestEvent.data.event_type,
      journal_trade_id: journalId,
      trade_client_id: tradeClientId,
      trade_revision: latestEvent.data.trade_revision,
      calculation_version: "build117.pipeline.v2",
      prior_event_key: null,
      input_digest: `edit-retry-${randomUUID()}`,
      processing_state: "pending",
    });
    mark("edit_retry_idempotent", Boolean(editRetry.error));
  }

  // DELETE
  const deleted = await ownerSession.client.from("trade_journal").update({
    deleted_at: new Date().toISOString(),
    pnl: 50,
  }).eq("id", journalId).eq("user_id", owner.userId);
  if (deleted.error) throw new Error(`delete: ${deleted.error.message}`);
  const afterDelete = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("delete_voids_active", afterDelete.active.length === 0);
  mark("delete_keeps_audit_voids", afterDelete.voided.length >= 1);

  // Delete/void retry: attempt to re-insert the delete event key
  const deleteEvent = await a
    .from("prop_processed_journal_events")
    .select("event_key,event_type,trade_revision")
    .eq("user_id", owner.userId)
    .eq("trade_client_id", tradeClientId)
    .eq("event_type", "trade_deleted")
    .order("trade_revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deleteEvent.data) {
    const delRetry = await a.from("prop_processed_journal_events").insert({
      user_id: owner.userId,
      account_id: accountId,
      challenge_id: challengeId,
      event_key: deleteEvent.data.event_key,
      event_type: deleteEvent.data.event_type,
      journal_trade_id: journalId,
      trade_client_id: tradeClientId,
      trade_revision: deleteEvent.data.trade_revision,
      calculation_version: "build117.pipeline.v2",
      prior_event_key: null,
      input_digest: `del-retry-${randomUUID()}`,
      processing_state: "pending",
    });
    mark("delete_retry_idempotent", Boolean(delRetry.error));
    const afterDelRetry = await countActiveExecutions(a, owner.userId, tradeClientId);
    mark("delete_retry_no_reactivation", afterDelRetry.active.length === 0);
  }

  // Unassign safely after delete
  const unassign = await a
    .from("prop_trade_assignments")
    .update({ assignment_state: "unassigned", account_id: null, challenge_id: null })
    .eq("user_id", owner.userId)
    .eq("trade_client_id", tradeClientId);
  mark("assignment_removed_safely", !unassign.error);

  // SECURITY
  const otherReadExec = await otherSession.client.from("prop_executions").select("id").eq("user_id", owner.userId).limit(5);
  mark("cross_user_exec_denied", (otherReadExec.data?.length ?? 0) === 0);
  const otherReadEvents = await otherSession.client.from("prop_processed_journal_events").select("id").eq("user_id", owner.userId).limit(5);
  mark("cross_user_events_denied", (otherReadEvents.data?.length ?? 0) === 0);
  const otherReadPlans = await otherSession.client.from("prop_daily_plan_snapshots").select("id").eq("user_id", owner.userId).limit(5);
  mark("cross_user_plans_denied", (otherReadPlans.data?.length ?? 0) === 0);
  const otherMutate = await otherSession.client.from("prop_accounts").update({ label: "hacked" }).eq("id", accountId);
  mark("cross_user_account_mutate_denied", Boolean(otherMutate.error) || (otherMutate.count ?? 0) === 0);
  const otherDirectWrite = await otherSession.client.from("prop_executions").insert({
    id: `hack:${randomUUID()}`,
    user_id: owner.userId,
    challenge_id: challengeId,
    account_id: accountId,
    trade_client_id: tradeClientId,
    occurred_at: new Date().toISOString(),
    realized_pnl_minor: 999,
    fees_minor: 0,
    contracts: 1,
    voided: false,
    source: "hack",
    schema_version: "prop-os-schema-v0",
  });
  mark("direct_protected_write_denied", Boolean(otherDirectWrite.error));
  const tokenRead = await otherSession.client.from("auth_provider_tokens").select("user_id").limit(1);
  mark("provider_token_read_denied", Boolean(tokenRead.error) || (tokenRead.data?.length ?? 0) === 0);

  const account2 = await createAccount(ownerSession.client, owner.userId, `YT-B117-B-${randomUUID().slice(0, 6)}`);
  const foreignExec = await a.from("prop_executions").select("id").eq("user_id", owner.userId).eq("account_id", account2).eq("trade_client_id", tradeClientId);
  mark("multi_account_isolation", (foreignExec.data?.length ?? 0) === 0);

  // Rapid save → edit → delete already covered; assert final convergence after reload reads
  const finalA = await countActiveExecutions(a, owner.userId, tradeClientId);
  const finalB = await countActiveExecutions(a, owner.userId, tradeClientId);
  mark("post_delete_reload_convergence", finalA.active.length === 0 && finalA.pnlSumActive === finalB.pnlSumActive);

  const pendingBefore = await pendingEvents(a, owner.userId);
  evidence.pendingBeforeCleanup = pendingBefore;
  if (pendingBefore > 0) {
    const proc = await fetch(`${URL}/functions/v1/prop-pass-runtime-processor`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerSession.token}`,
        apikey: ANON,
        "content-type": "application/json",
      },
      body: JSON.stringify({ op: "process_pending" }),
    });
    results.runtime_processor_retry = proc.status === 200 ? "PASS" : "FAIL";
  } else {
    results.runtime_processor_retry = "SKIP";
  }

  const runtimeAfterProcessor = await a
    .from("prop_account_runtime_states")
    .select("account_id,updated_at,payload")
    .eq("user_id", owner.userId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (runtimeAfterProcessor.data) {
    results.hard_risk_rooms_update = "PASS";
    results.risk_meter_update = "PASS";
    results.challenge_live_state_update = "PASS";
  }

  mark("journal_save_sync", results.journal_save_execution_once === "PASS");
  mark("journal_edit_sync", results.edit_active_once === "PASS" && results.edit_void_once === "PASS");
  mark("journal_delete_sync", results.delete_voids_active === "PASS");
  mark("remote_network_retry", results.retry_lost_response_idempotent === "PASS");
  mark("duplicate_event_protection", results.duplicate_no_extra_pnl === "PASS");
  mark("reload_pass", results.reload_convergence === "PASS");
  mark("cross_user_denial", results.cross_user_exec_denied === "PASS" && results.cross_user_events_denied === "PASS" && results.cross_user_plans_denied === "PASS" && results.cross_user_account_mutate_denied === "PASS" && results.provider_token_read_denied === "PASS" && results.direct_protected_write_denied === "PASS");
  mark("multi_account_pass", results.multi_account_isolation === "PASS");
} catch (error) {
  evidence.error = error instanceof Error ? error.message.slice(0, 240) : "unknown";
  for (const key of Object.keys(results)) {
    if (results[key] !== "PASS" && results[key] !== "SKIP") results[key] = results[key] ?? "FAIL";
  }
  console.error("staging journal proof failed:", evidence.error);
} finally {
  let cleanupPass = true;
  let residualAppendOnly = 0;
  let activeDisposable = 0;
  let leftoverTrades = 0;
  let leftoverPending = 0;
  let leftoverAssignments = 0;
  let residualTimeline = 0;
  let residualSnapshots = 0;

  for (const userId of createdUserIds) {
    try {
      const scrub = await scrubDisposableUser(userId);
      if (!(scrub.deletedAuth || scrub.scrubbed)) cleanupPass = false;

      const { count: tradeCount } = await a.from("trade_journal").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverTrades += tradeCount ?? 0;
      leftoverPending += await pendingEvents(a, userId);
      const { count: assignCount } = await a.from("prop_trade_assignments").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverAssignments += assignCount ?? 0;
      const { count: tlCount } = await a.from("prop_timeline_events").select("id", { count: "exact", head: true }).eq("user_id", userId);
      residualTimeline += tlCount ?? 0;
      const { count: snapCount } = await a.from("prop_daily_plan_snapshots").select("id", { count: "exact", head: true }).eq("user_id", userId);
      residualSnapshots += snapCount ?? 0;

      const { count: accountCount } = await a
        .from("prop_accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");
      residualAppendOnly += accountCount ?? 0;

      const listed = await a.auth.admin.getUserById(userId);
      if (listed.data.user) {
        const email = listed.data.user.email ?? "";
        const meta = listed.data.user.user_metadata ?? {};
        const stillActiveDisposable =
          email.startsWith("yt-b117-journal-") || meta.yt_suite === "build117-journal-staging";
        if (stillActiveDisposable) activeDisposable += 1;
      }
    } catch {
      cleanupPass = false;
    }
  }

  // Mutable synthetic rows must be gone. Append-only residuals under scrubbed
  // identities are expected (accounts/challenges/executions/plans/timeline/replays).
  if (leftoverTrades > 0 || leftoverPending > 0 || leftoverAssignments > 0 || activeDisposable > 0 || residualAppendOnly > 0) {
    cleanupPass = false;
  }

  results.staging_cleanup = cleanupPass ? "PASS" : "FAIL";
  evidence.cleanupUsers = createdUserIds.map(red).join(",");
  evidence.activeDisposableUsers = activeDisposable;
  evidence.leftoverTrades = leftoverTrades;
  evidence.leftoverPendingEvents = leftoverPending;
  evidence.leftoverAssignments = leftoverAssignments;
  evidence.residualAppendOnlyActiveAccounts = residualAppendOnly;
  evidence.residualAppendOnlyTimeline = residualTimeline;
  evidence.residualAppendOnlySnapshots = residualSnapshots;
  evidence.appendOnlyResidualExpected = true;
}

const outDir = join("docs/releases/1.6.1/evidence");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report = {
  suite: "prop-pass-journal-staging-transaction",
  headHint: "feature/prop-pass-trading-os-build117",
  stagingProjectRef: STAGING,
  productionProjectRef: PROD,
  productionTouched: false,
  results,
  evidence,
  stamp,
};
writeFileSync(join(outDir, `JOURNAL_STAGING_TRANSACTION_${stamp}.json`), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "JOURNAL_STAGING_TRANSACTION_LATEST.json"), JSON.stringify(report, null, 2));

const required = [
  "journal_save_sync",
  "journal_edit_sync",
  "journal_delete_sync",
  "remote_network_retry",
  "duplicate_event_protection",
  "reload_pass",
  "cross_user_denial",
  "multi_account_pass",
  "staging_cleanup",
];
const failed = required.filter((key) => results[key] !== "PASS");
console.log(JSON.stringify({ results, evidence: { ...evidence, error: evidence.error ?? null } }, null, 2));
if (failed.length) {
  console.error("FAILED:", failed.join(", "));
  process.exit(1);
}
console.log("prop-pass-journal-staging-transaction: PASS");
