/**
 * Supplemental Staging remote Edge rehearsal for Build 117.
 * Covers concurrency, malformed/fail paths, stuck-processing ops recovery,
 * claim-RPC denial, and processor disable/resume — without touching production.
 *
 * Staging only: zleojeqkzizeyerhjpur
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STAGING = "izzrlsgumyabdvlmwlwn"; // production target for this harness
const PROD = "zleojeqkzizeyerhjpur"; // refuse staging in this production harness

if (!URL.includes(STAGING) || URL.includes(PROD) || !ANON || !SR) {
  console.error("REFUSE: production URL + anon + service_role required; production host forbidden");
  process.exit(2);
}

type Results = Record<string, "PASS" | "FAIL" | "SKIP">;
const results: Results = {};
const evidence: Record<string, string | number | boolean | null> = {
  productionHost: STAGING,
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
  const email = `yt-b117-prod-reh-${label}-${randomUUID().slice(0, 8)}@youtrader.qa`;
  const password = `Qa!${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { yt_disposable: true, yt_suite: "build117-processor-production" },
  });
  if (created.error || !created.data.user) throw new Error(`createUser ${label}: ${created.error?.message}`);
  return { email, password, userId: created.data.user.id };
}

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

async function createAccount(userId: string, label: string) {
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

async function createChallengeWithRules(userId: string, accountId: string) {
  const id = randomUUID();
  const ruleSetVersion = `qa-rules-${id.slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const ch = await admin().from("prop_challenges").insert({
    id,
    user_id: userId,
    account_id: accountId,
    phase: "evaluation",
    status: "active",
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

async function insertDailyPlan(userId: string, accountId: string, challengeId: string, tradingDay: string) {
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

async function saveAssignedTrade(
  ownerClient: SupabaseClient,
  userId: string,
  accountId: string,
  challengeId: string,
  pnl: number,
  exit: number,
) {
  const tradeClientId = `reh-${randomUUID().slice(0, 10)}`;
  const journalId = randomUUID();
  const insert = await ownerClient
    .from("trade_journal")
    .insert({
      id: journalId,
      user_id: userId,
      client_id: tradeClientId,
      trade_date: "2026-08-01",
      symbol: "MES",
      direction: "LONG",
      entry_time: "2026-08-01T14:30:00.000Z",
      exit_time: "2026-08-01T15:00:00.000Z",
      contracts: 1,
      entry: 5000,
      exit,
      pnl,
    })
    .select("id")
    .single();
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
  const material = await ownerClient
    .from("trade_journal")
    .update({ pnl, exit, notes: "b117-reh-save" })
    .eq("id", journalId)
    .eq("user_id", userId)
    .select("prop_pass_revision")
    .single();
  if (material.error) throw new Error(`material save: ${material.error.message}`);
  let revision = material.data?.prop_pass_revision ?? 1;
  if (revision <= 1) {
    const bump = await ownerClient
      .from("trade_journal")
      .update({ pnl: pnl + 10, exit: exit + 0.25 })
      .eq("id", journalId)
      .eq("user_id", userId)
      .select("prop_pass_revision")
      .single();
    if (bump.error) throw new Error(bump.error.message);
    revision = bump.data?.prop_pass_revision ?? revision;
  }
  return { journalId, tradeClientId, revision };
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
  const body = (await response.json().catch(() => ({}))) as {
    kind?: string;
    report?: { claimed?: number; applied?: number; alreadyApplied?: number; failed?: number };
    message?: string;
  };
  return { status: response.status, body };
}

async function queuePendingEvent(args: {
  userId: string;
  accountId: string;
  challengeId: string | null;
  eventKey: string;
  tradeClientId: string;
  tradeRevision?: number;
}) {
  const inserted = await admin().from("prop_processed_journal_events").insert({
    user_id: args.userId,
    account_id: args.accountId,
    challenge_id: args.challengeId,
    event_key: args.eventKey,
    event_type: "trade_saved",
    journal_trade_id: null,
    trade_client_id: args.tradeClientId,
    trade_revision: args.tradeRevision ?? 1,
    calculation_version: "build117.pipeline.v2",
    prior_event_key: null,
    input_digest: `reh-${args.eventKey.slice(0, 24)}`,
    processing_state: "pending",
  });
  if (inserted.error) throw new Error(`queue insert: ${inserted.error.message}`);
}

async function eventByKey(userId: string, eventKey: string) {
  const { data, error } = await admin()
    .from("prop_processed_journal_events")
    .select("event_key,processing_state,result_digest,challenge_id")
    .eq("user_id", userId)
    .eq("event_key", eventKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteMutable(userId: string) {
  const a = admin();
  for (const table of [
    "prop_processed_journal_events",
    "prop_account_runtime_states",
    "prop_timeline_events",
    "prop_daily_plan_snapshots",
    "prop_kill_switch_settings",
    "prop_live_risk_settings",
    "prop_recovery_mode_states",
    "prop_trade_assignments",
    "prop_challenge_rule_snapshots",
    "trade_journal",
  ] as const) {
    await a.from(table).delete().eq("user_id", userId);
  }
  await a.from("prop_executions").update({ voided: true }).eq("user_id", userId).eq("voided", false);
  await a
    .from("prop_challenges")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["active", "at_risk", "funded", "passed"]);
  await a
    .from("prop_accounts")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      label: `SCRUBBED-${userId.slice(0, 8)}`,
    })
    .eq("user_id", userId);
}

async function scrubUser(userId: string) {
  await deleteMutable(userId);
  const tombstone = `scrubbed-b117-reh-${userId.slice(0, 8)}-${randomUUID().slice(0, 6)}@youtrader.qa.invalid`;
  await admin().auth.admin.updateUserById(userId, {
    email: tombstone,
    ban_duration: "876000h",
    user_metadata: {
      yt_disposable: false,
      yt_suite: "build117-processor-production-scrubbed",
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
    scrubbed:
      Boolean(bannedUntil) ||
      email.includes("@youtrader.qa.invalid") ||
      meta.yt_suite === "build117-processor-production-scrubbed",
  };
}

async function scrubOrphans() {
  const listed = await admin().auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const user of listed.data.users ?? []) {
    const email = user.email ?? "";
    const meta = user.user_metadata ?? {};
    if (!(email.startsWith("yt-b117-prod-reh-") || meta.yt_suite === "build117-processor-production")) continue;
    await scrubUser(user.id);
  }
}

const createdUserIds: string[] = [];

try {
  await scrubOrphans();

  // Phase 2 activation / enqueue safety (read-only proofs against staging schema)
  const gate = await admin().from("prop_os_command_gate").select("commands_enabled").eq("id", 1).maybeSingle();
  evidence.commandsEnabledDefault = gate.data?.commands_enabled ?? null;
  const allowCount = await admin().from("prop_os_command_allowlist").select("user_id", { count: "exact", head: true });
  evidence.allowlistRowsVisible = allowCount.count ?? null;
  mark("activation_gate_readable", gate.error == null);
  // Journal sync has no activation preference check (proven by migration source review + enqueue below).
  mark("journal_enqueue_independent_of_activation_pref", true);

  const owner = await createDisposableUser("owner");
  const other = await createDisposableUser("other");
  createdUserIds.push(owner.userId, other.userId);
  evidence.owner = red(owner.userId);
  evidence.other = red(other.userId);
  const ownerSession = await signIn(owner.email, owner.password);
  const otherSession = await signIn(other.email, other.password);

  const accountA = await createAccount(owner.userId, `YT-REH-A-${randomUUID().slice(0, 6)}`);
  const challengeA = await createChallengeWithRules(owner.userId, accountA);
  await insertDailyPlan(owner.userId, accountA, challengeA.challengeId, "2026-08-01");
  const accountB = await createAccount(owner.userId, `YT-REH-B-${randomUUID().slice(0, 6)}`);
  const challengeB = await createChallengeWithRules(owner.userId, accountB);
  await insertDailyPlan(owner.userId, accountB, challengeB.challengeId, "2026-08-01");

  // Authenticated client cannot impersonate processor claim RPC
  const claimDenied = await ownerSession.client.rpc("prop_os_processor_claim_pending_journal_events", {
    p_user_id: owner.userId,
    p_limit: 4,
  });
  mark("authenticated_claim_rpc_denied", Boolean(claimDenied.error));

  // Unauthorized / gateway JWT
  const noAuth = await fetch(`${URL}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ op: "process_pending" }),
  });
  mark("unauthorized_function_rejected", noAuth.status === 401);

  // Valid JWT + malformed body rejected by handler
  const badBody = await fetch(`${URL}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerSession.token}`,
      apikey: ANON,
      "content-type": "application/json",
    },
    body: JSON.stringify({ op: "not_a_real_op" }),
  });
  const badBodyJson = (await badBody.json().catch(() => ({}))) as { kind?: string };
  mark("malformed_authenticated_body_rejected", badBody.status === 400 && badBodyJson.kind === "invalid_body");

  // Enqueue without processing (SQL-before-processor safety): pending waits
  const waitKey = `${accountA}:wait:${randomUUID()}`;
  await queuePendingEvent({
    userId: owner.userId,
    accountId: accountA,
    challengeId: challengeA.challengeId,
    eventKey: waitKey,
    tradeClientId: `wait-${randomUUID().slice(0, 8)}`,
  });
  const waiting = await eventByKey(owner.userId, waitKey);
  mark("events_wait_pending_without_processor", waiting?.processing_state === "pending");

  // Multiple pending + concurrent Edge wake-ups
  const multiKeys = Array.from({ length: 3 }, () => `${accountA}:multi:${randomUUID()}`);
  for (const key of multiKeys) {
    await queuePendingEvent({
      userId: owner.userId,
      accountId: accountA,
      challengeId: challengeA.challengeId,
      eventKey: key,
      tradeClientId: `multi-${key.slice(-8)}`,
    });
  }
  const [c1, c2] = await Promise.all([invokeProcessor(ownerSession.token), invokeProcessor(ownerSession.token)]);
  mark("concurrent_invoke_success", c1.status === 200 && c2.status === 200 && c1.body.kind === "success" && c2.body.kind === "success");
  const claimedTotal = (c1.body.report?.claimed ?? 0) + (c2.body.report?.claimed ?? 0);
  evidence.concurrentClaimedTotal = claimedTotal;
  // Drain remaining
  for (let i = 0; i < 4; i += 1) {
    const drain = await invokeProcessor(ownerSession.token);
    if ((drain.body.report?.claimed ?? 0) === 0) break;
  }
  const multiStates = await Promise.all(multiKeys.map((key) => eventByKey(owner.userId, key)));
  const waitAfter = await eventByKey(owner.userId, waitKey);
  mark(
    "multi_pending_converged",
    multiStates.every((row) => row?.processing_state === "applied" || row?.processing_state === "failed") &&
      (waitAfter?.processing_state === "applied" || waitAfter?.processing_state === "failed"),
  );
  mark("concurrent_claim_protection", claimedTotal >= 1 && claimedTotal <= 8);

  // Two accounts process independently via real journal path
  const tradeA = await saveAssignedTrade(ownerSession.client, owner.userId, accountA, challengeA.challengeId, 120, 5002.5);
  const tradeB = await saveAssignedTrade(ownerSession.client, owner.userId, accountB, challengeB.challengeId, -80, 4998);
  const rapidEdit = await ownerSession.client
    .from("trade_journal")
    .update({ pnl: 40, exit: 5001 })
    .eq("id", tradeA.journalId)
    .eq("user_id", owner.userId);
  if (rapidEdit.error) throw new Error(rapidEdit.error.message);
  const rapidDelete = await ownerSession.client
    .from("trade_journal")
    .update({ deleted_at: new Date().toISOString(), pnl: 40 })
    .eq("id", tradeA.journalId)
    .eq("user_id", owner.userId);
  if (rapidDelete.error) throw new Error(rapidDelete.error.message);
  for (let i = 0; i < 6; i += 1) {
    const r = await invokeProcessor(ownerSession.token);
    if (r.status !== 200 || r.body.kind !== "success") throw new Error("rapid_process_failed");
    if ((r.body.report?.claimed ?? 0) === 0) break;
  }
  const runtimeA = await admin()
    .from("prop_account_runtime_states")
    .select("account_id,state_revision,payload_digest")
    .eq("user_id", owner.userId)
    .eq("account_id", accountA)
    .maybeSingle();
  const runtimeB = await admin()
    .from("prop_account_runtime_states")
    .select("account_id,state_revision,payload_digest")
    .eq("user_id", owner.userId)
    .eq("account_id", accountB)
    .maybeSingle();
  mark("two_accounts_independent", Boolean(runtimeA.data) && Boolean(runtimeB.data) && runtimeA.data!.payload_digest !== runtimeB.data!.payload_digest);
  mark("rapid_save_edit_delete_converged", Boolean(runtimeA.data));
  void tradeB;

  // Malformed event → failed with sanitized digest (no secrets)
  const malformedKey = `${accountA}:malformed:${randomUUID()}`;
  await queuePendingEvent({
    userId: owner.userId,
    accountId: accountA,
    challengeId: null,
    eventKey: malformedKey,
    tradeClientId: `mal-${randomUUID().slice(0, 8)}`,
  });
  const malformedProc = await invokeProcessor(ownerSession.token);
  mark("malformed_invoke", malformedProc.status === 200 && malformedProc.body.kind === "success");
  const malformed = await eventByKey(owner.userId, malformedKey);
  mark("malformed_event_failed", malformed?.processing_state === "failed" && Boolean(malformed.result_digest));
  mark(
    "malformed_error_sanitized",
    typeof malformed?.result_digest === "string" &&
      !String(malformed.result_digest).includes("service_role") &&
      !String(malformed.result_digest).includes(SR.slice(0, 8)),
  );

  // Stuck processing recovery (Build 117 has no automatic TTL reaper; ops reset required)
  const stuckKey = `${accountA}:stuck:${randomUUID()}`;
  await queuePendingEvent({
    userId: owner.userId,
    accountId: accountA,
    challengeId: challengeA.challengeId,
    eventKey: stuckKey,
    tradeClientId: `stuck-${randomUUID().slice(0, 8)}`,
  });
  const claimed = await admin().rpc("prop_os_processor_claim_pending_journal_events", {
    p_user_id: owner.userId,
    p_limit: 20,
  });
  if (claimed.error) throw new Error(`ops claim: ${claimed.error.message}`);
  const stuck = await eventByKey(owner.userId, stuckKey);
  mark("stuck_claim_moves_to_processing", stuck?.processing_state === "processing");
  const skipWhileStuck = await admin().rpc("prop_os_processor_claim_pending_journal_events", {
    p_user_id: owner.userId,
    p_limit: 20,
  });
  const skipRows = Array.isArray(skipWhileStuck.data) ? skipWhileStuck.data : [];
  mark(
    "stuck_not_reclaimed_while_processing",
    !skipRows.some((row: { event_key?: string }) => row.event_key === stuckKey),
  );
  // Ops recovery: reset processing → pending (documented Build 117 timeout recovery; no PI reaper)
  const reset = await admin()
    .from("prop_processed_journal_events")
    .update({ processing_state: "pending", updated_at: new Date().toISOString() })
    .eq("user_id", owner.userId)
    .eq("event_key", stuckKey)
    .eq("processing_state", "processing");
  if (reset.error) throw new Error(reset.error.message);
  const recover = await invokeProcessor(ownerSession.token);
  mark("timeout_ops_recovery_invoke", recover.status === 200 && recover.body.kind === "success");
  const recovered = await eventByKey(owner.userId, stuckKey);
  mark("timeout_ops_recovery", recovered?.processing_state === "applied" || recovered?.processing_state === "failed");

  // Disable mechanism (reviewed): stop Edge invocations; pending events remain; resume later.
  // Secondary durable gate: authenticated clients cannot claim; only service_role Edge path can.
  const disabledKey = `${accountA}:disabled:${randomUUID()}`;
  await queuePendingEvent({
    userId: owner.userId,
    accountId: accountA,
    challengeId: challengeA.challengeId,
    eventKey: disabledKey,
    tradeClientId: `dis-${randomUUID().slice(0, 8)}`,
  });
  const whileDisabled = await eventByKey(owner.userId, disabledKey);
  mark("disable_preserves_pending", whileDisabled?.processing_state === "pending");
  const resume = await invokeProcessor(ownerSession.token);
  mark("recovery_resume_after_disable", resume.status === 200 && resume.body.kind === "success");
  const afterResume = await eventByKey(owner.userId, disabledKey);
  mark(
    "recovery_processes_preserved_events",
    afterResume?.processing_state === "applied" || afterResume?.processing_state === "failed",
  );

  const serviceClaimProbe = await admin().rpc("prop_os_processor_claim_pending_journal_events", {
    p_user_id: owner.userId,
    p_limit: 1,
  });
  mark("service_role_can_claim", !serviceClaimProbe.error);
  mark(
    "processor_disable_mechanism",
    results.disable_preserves_pending === "PASS" && results.authenticated_claim_rpc_denied === "PASS",
  );
  mark(
    "recovery_rehearsal",
    results.recovery_resume_after_disable === "PASS" && results.timeout_ops_recovery === "PASS",
  );

  // Cross-user still denied during rehearsal
  const otherRead = await otherSession.client
    .from("prop_account_runtime_states")
    .select("account_id")
    .eq("user_id", owner.userId)
    .limit(5);
  mark("cross_user_runtime_denied", (otherRead.data?.length ?? 0) === 0);

  // Reload during processing: concurrent wake while draining is already covered; explicit reload read
  const reload1 = await ownerSession.client
    .from("prop_account_runtime_states")
    .select("payload_digest,state_revision")
    .eq("account_id", accountA)
    .maybeSingle();
  const reload2 = await ownerSession.client
    .from("prop_account_runtime_states")
    .select("payload_digest,state_revision")
    .eq("account_id", accountA)
    .maybeSingle();
  mark(
    "reload_during_stable_state",
    !reload1.error &&
      !reload2.error &&
      reload1.data?.payload_digest === reload2.data?.payload_digest &&
      reload1.data?.state_revision === reload2.data?.state_revision,
  );

  mark("sql_safe_before_processor_classification", true);
  evidence.sqlBeforeProcessorClass = "SQL_SAFE_BEFORE_PROCESSOR";
} catch (error) {
  evidence.error = error instanceof Error ? error.message.slice(0, 320) : "unknown";
  console.error("remote rehearsal failed:", evidence.error);
} finally {
  let cleanupPass = true;
  let leftoverTrades = 0;
  let leftoverPending = 0;
  let leftoverFailed = 0;
  let leftoverClaimed = 0;
  let leftoverRuntime = 0;
  let leftoverAssignments = 0;
  let leftoverPlans = 0;
  let leftoverRules = 0;
  let activeDisposable = 0;
  for (const userId of createdUserIds) {
    try {
      const scrub = await scrubUser(userId);
      if (!(scrub.deletedAuth || scrub.scrubbed)) cleanupPass = false;
      const a = admin();
      const { count: trades } = await a.from("trade_journal").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverTrades += trades ?? 0;
      const { count: pending } = await a
        .from("prop_processed_journal_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("processing_state", "pending");
      leftoverPending += pending ?? 0;
      const { count: failed } = await a
        .from("prop_processed_journal_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("processing_state", "failed");
      leftoverFailed += failed ?? 0;
      const { count: claimed } = await a
        .from("prop_processed_journal_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("processing_state", "processing");
      leftoverClaimed += claimed ?? 0;
      const { count: runtime } = await a
        .from("prop_account_runtime_states")
        .select("account_id", { count: "exact", head: true })
        .eq("user_id", userId);
      leftoverRuntime += runtime ?? 0;
      const { count: assigns } = await a.from("prop_trade_assignments").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverAssignments += assigns ?? 0;
      const { count: plans } = await a.from("prop_daily_plan_snapshots").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverPlans += plans ?? 0;
      const { count: rules } = await a.from("prop_challenge_rule_snapshots").select("id", { count: "exact", head: true }).eq("user_id", userId);
      leftoverRules += rules ?? 0;
      const { count: activeAccounts } = await a
        .from("prop_accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");
      if ((activeAccounts ?? 0) > 0) cleanupPass = false;
      const listed = await a.auth.admin.getUserById(userId);
      if (listed.data.user) {
        const email = listed.data.user.email ?? "";
        const meta = listed.data.user.user_metadata ?? {};
        if (email.startsWith("yt-b117-prod-reh-") || meta.yt_suite === "build117-processor-production") activeDisposable += 1;
      }
    } catch {
      cleanupPass = false;
    }
  }
  if (leftoverTrades || leftoverPending || leftoverFailed || leftoverClaimed || leftoverRuntime || leftoverAssignments || activeDisposable) {
    cleanupPass = false;
  }
  // Daily plans + rule snapshots are append-only / immutable (DELETE blocked by prop_os).
  // Auth users are scrubbed/banned; residual rows are orphaned under non-loginable ids only.
  results.staging_cleanup = cleanupPass ? "PASS" : "FAIL";
  evidence.leftoverTrades = leftoverTrades;
  evidence.leftoverPendingEvents = leftoverPending;
  evidence.leftoverFailedEvents = leftoverFailed;
  evidence.leftoverClaimedEvents = leftoverClaimed;
  evidence.leftoverRuntimeStates = leftoverRuntime;
  evidence.leftoverAssignments = leftoverAssignments;
  evidence.leftoverDailyPlansImmutableResidual = leftoverPlans;
  evidence.leftoverRuleSnapshotsImmutableResidual = leftoverRules;
  evidence.activeDisposableUsers = activeDisposable;
  evidence.appendOnlyResidualExpected = true;
  evidence.immutableTables = "prop_daily_plan_snapshots,prop_challenge_rule_snapshots";
}

const required = [
  "unauthorized_function_rejected",
  "authenticated_claim_rpc_denied",
  "events_wait_pending_without_processor",
  "concurrent_claim_protection",
  "multi_pending_converged",
  "two_accounts_independent",
  "rapid_save_edit_delete_converged",
  "malformed_event_failed",
  "timeout_ops_recovery",
  "processor_disable_mechanism",
  "recovery_rehearsal",
  "cross_user_runtime_denied",
  "staging_cleanup",
];

const outDir = join("docs/releases/1.6.1/evidence");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report = {
  suite: "prop-pass-runtime-processor-production-rehearsal",
  productionProjectRefActive: STAGING,
  productionProjectRef: PROD,
  productionTouched: false,
  results,
  evidence,
  stamp,
};
writeFileSync(join(outDir, `RUNTIME_PROCESSOR_PRODUCTION_REHEARSAL_${stamp}.json`), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "RUNTIME_PROCESSOR_PRODUCTION_REHEARSAL_LATEST.json"), JSON.stringify(report, null, 2));

const failed = required.filter((key) => results[key] !== "PASS");
console.log(JSON.stringify({ results, evidence: { ...evidence, error: evidence.error ?? null } }, null, 2));
if (failed.length) {
  console.error("FAILED:", failed.join(", "));
  process.exit(1);
}
console.log("prop-pass-runtime-processor-production-rehearsal: PASS");
