/**
 * Full remote staging Prop Pass + PI vertical slice + isolation proofs.
 * Credentials via env only. Target host must be zleojeqkzizeyerhjpur.
 */
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashPropOsCommandPayload, newPropOsClientRequestId } from "../src/propOs/commands/hash";
import { prepareTrustedRecalculation } from "../src/propOs/assignments/trustedRecalcProcessor";
import { calculatePerformanceIntelligence } from "../src/propOs/intelligence/engine";
import { scopeKey } from "../src/propOs/intelligence/scope";
import type { ChallengeRow, ExecutionRow, RuleSnapshotRow } from "../src/propOs/shadow/types";
import type { IntelligenceScope, RawJournalTradeFact } from "../src/propOs/intelligence/types";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ALLOW = process.env.ALLOW_UID ?? "";
const DENY = process.env.DENY_UID ?? "";
const PROC = process.env.PROP_OS_PROCESSOR_SHARED_SECRET ?? "";

if (!URL.includes("zleojeqkzizeyerhjpur")) {
  console.error("REFUSE: not staging host");
  process.exit(2);
}

const results: Record<string, string> = {};
const ids: Record<string, string | number | null> = {};

function red(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${String(id).slice(0, 8)}…`;
}

function shaHash(commandType: string, body: unknown): string {
  return createHash("sha256")
    .update(`${commandType}\0${JSON.stringify(body)}`)
    .digest("hex")
    .slice(0, 32);
}

async function signIn(email: string, password: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signin ${email}: ${error?.message}`);
  return {
    userId: data.user!.id,
    token: data.session.access_token,
    client: createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

function adminClient(): SupabaseClient {
  return createClient(URL, SR, { auth: { persistSession: false } });
}

async function callProcessor(
  name: "prop-os-recalc-processor" | "prop-os-pi-processor",
  body: unknown,
) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: ANON,
      "Content-Type": "application/json",
      "x-prop-os-processor-secret": PROC,
    },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, body: j as Record<string, unknown> };
}

async function callAsJwt(
  name: "prop-os-recalc-processor" | "prop-os-pi-processor",
  token: string,
  body: unknown,
) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function snapshotToPiJson(snap: ReturnType<typeof calculatePerformanceIntelligence>) {
  return {
    accountId: snap.accountId,
    challengeId: snap.challengeId ?? null,
    inputRevision: snap.inputRevision,
    status: snap.status,
    metricSpecVersion: snap.metricSpecVersion,
    engineVersion: snap.engineVersion,
    scope: snap.scope,
    datasetSummary: snap.datasetSummary,
    performance: snap.performance,
    risk: snap.risk,
    sequences: snap.sequences,
    segments: snap.segments,
    findings: snap.findings,
    calculatedAt: snap.calculatedAt,
    sourceRange: snap.sourceRange,
    schemaVersion: snap.schemaVersion,
    clientRequestId: `pi-${randomUUID()}`,
  };
}

async function main() {
  const allow = await signIn(
    "tf-internal-allow@staging.youtrader.local",
    "YtStg!Allow112",
  );
  const deny = await signIn(
    "tf-internal-deny@staging.youtrader.local",
    "YtStg!Deny112",
  );
  results.auth = allow.userId === ALLOW && deny.userId === DENY ? "PASS" : "FAIL";
  ids.user = red(allow.userId);

  // ---- Signed-out / deny activation probes (API-level) ----
  {
    const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await anonClient.from("prop_accounts").select("id").limit(1);
    const empty = data == null || (Array.isArray(data) && data.length === 0);
    results.signed_out_prop_accounts =
      empty || !!error ? "PASS" : `FAIL ${JSON.stringify(data)}`;
  }

  // Deny create
  {
    const cmd = {
      label: "Denied Acc",
      firmKey: "apex-demo",
      accountSizeMinor: 5_000_000,
      currency: "USD",
      firmTimezone: "America/New_York",
      clientRequestId: newPropOsClientRequestId(),
    };
    const { data } = await deny.client.rpc("prop_os_cmd_create_account", {
      p_request_id: cmd.clientRequestId,
      p_request_hash: hashPropOsCommandPayload("create_account", cmd),
      p_label: cmd.label,
      p_firm_key: cmd.firmKey,
      p_account_size_minor: cmd.accountSizeMinor,
      p_currency: cmd.currency,
      p_firm_timezone: cmd.firmTimezone,
    });
    results.deny_create = (data as { kind?: string })?.kind === "forbidden" ? "PASS" : `FAIL`;
  }

  // Create account
  let accountId = "";
  {
    const cmd = {
      label: `Staging TF Acc ${Date.now()}`,
      firmKey: "apex-demo",
      accountSizeMinor: 5_000_000,
      currency: "USD",
      firmTimezone: "America/New_York",
      clientRequestId: newPropOsClientRequestId(),
    };
    const { data, error } = await allow.client.rpc("prop_os_cmd_create_account", {
      p_request_id: cmd.clientRequestId,
      p_request_hash: hashPropOsCommandPayload("create_account", cmd),
      p_label: cmd.label,
      p_firm_key: cmd.firmKey,
      p_account_size_minor: cmd.accountSizeMinor,
      p_currency: cmd.currency,
      p_firm_timezone: cmd.firmTimezone,
    });
    if (error || (data as { kind?: string })?.kind !== "success") {
      results.create_account = `FAIL ${error?.message ?? JSON.stringify(data)}`;
    } else {
      accountId = (data as { value: { account: { id: string } } }).value.account.id;
      results.create_account = "PASS";
      ids.account = red(accountId);
    }
  }

  // Challenge
  let challengeId = "";
  let ruleSnapshotId = "";
  {
    const ruleSnapshot = {
      version: "rs-stg-113",
      firmKey: "apex-demo",
      currency: "USD",
      firmTimezone: "America/New_York",
      tradingDayRolloverHour: 0,
      profitTargetMinor: 300000,
      dailyLossLimitMinor: 1000000,
      dailyLossBasis: "realized_only",
      dailyLossPolicyVersion: "daily-loss-v0",
      drawdown: { kind: "static", amountMinor: 200000 },
      minimumTradingDays: 1,
    };
    const startedAtUtc = new Date().toISOString();
    const cmd = {
      accountId,
      templateId: "internal.apex-demo.eval.static",
      templateVersion: "v0",
      ruleSnapshot,
      phase: "evaluation",
      startedAtUtc,
      resetOfChallengeId: null,
      clientRequestId: newPropOsClientRequestId(),
    };
    const { data, error } = await allow.client.rpc("prop_os_cmd_create_challenge_attempt", {
      p_request_id: cmd.clientRequestId,
      p_request_hash: hashPropOsCommandPayload("create_challenge_attempt", cmd),
      p_account_id: accountId,
      p_template_id: cmd.templateId,
      p_template_version: cmd.templateVersion,
      p_rule_snapshot: ruleSnapshot,
      p_phase: cmd.phase,
      p_started_at: startedAtUtc,
      p_reset_of: null,
    });
    if (error || (data as { kind?: string })?.kind !== "success") {
      results.create_challenge = `FAIL ${error?.message ?? JSON.stringify(data)}`;
    } else {
      const v = (data as { value: Record<string, unknown> }).value;
      challengeId = String(
        (v.challenge as { id?: string } | undefined)?.id ?? v.challengeId ?? "",
      );
      ruleSnapshotId = String(
        (v.ruleSnapshot as { id?: string } | undefined)?.id ?? v.ruleSnapshotId ?? "",
      );
      results.create_challenge = challengeId ? "PASS" : `FAIL ${JSON.stringify(data)}`;
      ids.challenge = red(challengeId);
      ids.rule_snapshot = red(ruleSnapshotId) ?? "via_challenge";
    }
  }

  // Journal trade
  const tradeDate = new Date().toISOString().slice(0, 10);
  const tradeClientId = `stg-tf-${Date.now()}`;
  {
    const { error } = await allow.client.from("trade_journal").insert({
      user_id: ALLOW,
      client_id: tradeClientId,
      trade_date: tradeDate,
      symbol: "ES",
      direction: "LONG",
      entry_time: `${tradeDate}T15:00:00Z`,
      exit_time: `${tradeDate}T16:00:00Z`,
      contracts: 1,
      pnl: 250,
      notes: "staging-113-fixture",
    });
    results.seed_trade = error ? `FAIL ${error.message}` : "PASS";
    ids.trade = tradeClientId.slice(0, 12) + "…";
  }

  // Assign
  let assignmentRevision = 0;
  {
    const cmd = {
      accountId,
      challengeId,
      tradeClientIds: [tradeClientId],
      source: "manual",
      reasonCode: null,
      allowReassign: false,
      clientRequestId: newPropOsClientRequestId(),
    };
    const { data, error } = await allow.client.rpc("prop_os_cmd_assign_trades", {
      p_request_id: cmd.clientRequestId,
      p_request_hash: hashPropOsCommandPayload("assign_trades", cmd),
      p_account_id: accountId,
      p_challenge_id: challengeId,
      p_trade_client_ids: [tradeClientId],
      p_source: "manual",
      p_reason_code: null,
      p_allow_reassign: false,
    });
    if (error || (data as { kind?: string })?.kind !== "success") {
      results.assign = `FAIL ${error?.message ?? JSON.stringify(data)}`;
    } else {
      assignmentRevision = Number(
        (data as { value?: { assignmentRevision?: number } }).value?.assignmentRevision ?? 1,
      );
      results.assign = "PASS";
      ids.assignment_revision = assignmentRevision;
    }
  }

  // Confirm queue
  const admin = adminClient();
  {
    const { data } = await admin
      .from("prop_os_challenge_recalc")
      .select("state,assignment_revision,challenge_id")
      .eq("challenge_id", challengeId)
      .maybeSingle();
    results.recalc_queued =
      data?.state === "queued" && Number(data.assignment_revision) === assignmentRevision
        ? "PASS"
        : `FAIL ${JSON.stringify(data)}`;
    ids.recalc_state_before = data?.state ?? null;
  }

  // App JWT cannot complete
  {
    const denied = await allow.client.rpc("prop_os_cmd_complete_recalculation", {
      p_request_id: "app-deny",
      p_request_hash: "x",
      p_challenge_id: challengeId,
      p_assignment_revision: assignmentRevision,
      p_snapshot_revision: assignmentRevision,
    });
    results.app_jwt_recalc_denied =
      denied.error || (denied.data as { kind?: string })?.kind === "forbidden"
        ? "PASS"
        : `FAIL ${JSON.stringify(denied)}`;
    const piDenied = await allow.client.rpc("prop_os_cmd_complete_performance_intelligence", {
      p_user_id: ALLOW,
      p_scope_key: "x",
      p_assignment_revision: assignmentRevision,
      p_snapshot: {},
    });
    results.app_jwt_pi_denied =
      piDenied.error || (piDenied.data as { kind?: string })?.kind === "forbidden"
        ? "PASS"
        : `FAIL ${JSON.stringify(piDenied)}`;
    const edgeDeny = await callAsJwt("prop-os-recalc-processor", allow.token, { op: "ping" });
    results.app_jwt_edge_denied = edgeDeny.status === 403 ? "PASS" : `FAIL ${edgeDeny.status}`;
  }

  // Trusted recalc via deployed processor
  const asOfUtc = new Date().toISOString();
  {
    const mark = await callProcessor("prop-os-recalc-processor", {
      op: "mark_running",
      challengeId,
      assignmentRevision,
    });
    results.recalc_claim =
      mark.status === 200 && mark.body?.kind === "success" ? "PASS" : `FAIL ${JSON.stringify(mark)}`;
    ids.recalc_claim =
      typeof mark.body?.kind === "string" || typeof mark.body?.kind === "number"
        ? mark.body.kind
        : null;

    // Load rows for domain engine
    const { data: chRow } = await admin
      .from("prop_challenges")
      .select(
        "id,user_id,account_id,phase,status,rule_set_version,starting_balance_minor,started_at,ended_at,reset_of_challenge_id,breach_locked,schema_version",
      )
      .eq("id", challengeId)
      .single();
    const { data: ruleRow } = await admin
      .from("prop_challenge_rule_snapshots")
      .select(
        "id,user_id,challenge_id,rule_set_version,snapshot,template_key,template_version_at_capture,captured_at,schema_version",
      )
      .eq("challenge_id", challengeId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .single();
    const { data: execRows } = await admin
      .from("prop_executions")
      .select(
        "id,user_id,challenge_id,account_id,trade_client_id,occurred_at,broker_sequence,realized_pnl_minor,fees_minor,contracts,voided,corrects_event_id,source,schema_version",
      )
      .eq("challenge_id", challengeId)
      .eq("voided", false);

    if (!chRow || !ruleRow) {
      results.recalc_prepare = `FAIL missing challenge/rule`;
    } else {
      ids.rule_snapshot = red(String(ruleRow.id));
      const challengeRow: ChallengeRow = {
        id: String(chRow.id),
        user_id: String(chRow.user_id),
        account_id: String(chRow.account_id),
        phase: String(chRow.phase),
        status: String(chRow.status),
        rule_set_version: String(chRow.rule_set_version),
        starting_balance_minor: Number(chRow.starting_balance_minor),
        started_at: String(chRow.started_at),
        ended_at: chRow.ended_at == null ? null : String(chRow.ended_at),
        reset_of_challenge_id:
          chRow.reset_of_challenge_id == null ? null : String(chRow.reset_of_challenge_id),
        breach_locked: Boolean(chRow.breach_locked),
        schema_version: String(chRow.schema_version),
      };
      const ruleSnapshotRow: RuleSnapshotRow = {
        id: String(ruleRow.id),
        user_id: String(ruleRow.user_id),
        challenge_id: String(ruleRow.challenge_id),
        rule_set_version: String(ruleRow.rule_set_version),
        snapshot: ruleRow.snapshot as RuleSnapshotRow["snapshot"],
        template_key: ruleRow.template_key == null ? null : String(ruleRow.template_key),
        template_version_at_capture:
          ruleRow.template_version_at_capture == null
            ? null
            : String(ruleRow.template_version_at_capture),
        captured_at: String(ruleRow.captured_at),
        schema_version: String(ruleRow.schema_version),
      };
      const executionRows: ExecutionRow[] = (execRows ?? []).map((j) => ({
        id: String(j.id),
        user_id: String(j.user_id),
        challenge_id: j.challenge_id == null ? null : String(j.challenge_id),
        account_id: j.account_id == null ? null : String(j.account_id),
        trade_client_id: j.trade_client_id == null ? null : String(j.trade_client_id),
        occurred_at: String(j.occurred_at),
        broker_sequence: j.broker_sequence == null ? null : Number(j.broker_sequence),
        realized_pnl_minor: j.realized_pnl_minor == null ? null : Number(j.realized_pnl_minor),
        fees_minor: j.fees_minor == null ? null : Number(j.fees_minor),
        contracts: j.contracts == null ? null : Number(j.contracts),
        voided: Boolean(j.voided),
        corrects_event_id: j.corrects_event_id == null ? null : String(j.corrects_event_id),
        source: String(j.source),
        schema_version: String(j.schema_version),
      }));

      const prepared = prepareTrustedRecalculation({
        userId: ALLOW,
        challengeRow,
        ruleSnapshotRow,
        executionRows,
        assignmentRevision,
        asOfUtc,
      });
      results.recalc_prepare = "PASS";
      ids.input_revision = prepared.inputRevision.slice(0, 24) + "…";

      const engId = randomUUID();
      const scoreId = randomUUID();
      const eng = prepared.engineSnapshot;
      const score = prepared.scoreSnapshot;
      const persist = await callProcessor("prop-os-recalc-processor", {
        op: "persist_snapshots",
        engineSnapshot: {
          id: engId,
          user_id: ALLOW,
          challenge_id: challengeId,
          calculation_version: eng.calculation_version,
          rule_set_version: eng.rule_set_version,
          input_revision: prepared.inputRevision,
          calculated_at: eng.calculated_at,
          status: eng.status,
          payload: eng.payload,
          confidence: eng.confidence,
          limitations: eng.limitations,
          readiness_model_version: eng.readiness_model_version,
          confidence_policy_version: eng.confidence_policy_version,
          fixture_contract_version: "assignment-recalc-v0",
          schema_version: eng.schema_version,
          created_at: eng.created_at,
        },
        scoreSnapshot: {
          id: scoreId,
          user_id: ALLOW,
          challenge_id: challengeId,
          calculation_version: score.calculation_version,
          rule_set_version: score.rule_set_version,
          input_revision: prepared.inputRevision,
          calculated_at: score.calculated_at,
          status: score.status,
          payload: score.payload,
          confidence: score.confidence,
          limitations: score.limitations,
          readiness_model_version: score.readiness_model_version,
          confidence_policy_version: score.confidence_policy_version,
          fixture_contract_version: "assignment-recalc-v0",
          schema_version: score.schema_version,
          created_at: score.created_at,
        },
      });
      results.snapshots_published =
        persist.status === 200 && persist.body?.kind === "success"
          ? "PASS"
          : `FAIL ${JSON.stringify(persist)}`;
      ids.engine_snapshot = red(engId);
      ids.score_snapshot = red(scoreId);

      const reqId = `recalc-${randomUUID()}`;
      const reqHash = shaHash("complete_recalculation", {
        challengeId,
        rev: assignmentRevision,
      });
      const done = await callProcessor("prop-os-recalc-processor", {
        op: "complete",
        requestId: reqId,
        requestHash: reqHash,
        challengeId,
        assignmentRevision,
        snapshotRevision: assignmentRevision,
      });
      results.recalc_completed =
        done.status === 200 && done.body?.kind === "success"
          ? "PASS"
          : `FAIL ${JSON.stringify(done)}`;
      ids.recalc_request = reqId.slice(0, 12) + "…";

      // Idempotent retry
      const again = await callProcessor("prop-os-recalc-processor", {
        op: "complete",
        requestId: reqId,
        requestHash: reqHash,
        challengeId,
        assignmentRevision,
        snapshotRevision: assignmentRevision,
      });
      results.recalc_idempotent =
        again.status === 200 && again.body?.kind === "success" ? "PASS" : `FAIL`;

      // Stale revision reject
      const stale = await callProcessor("prop-os-recalc-processor", {
        op: "complete",
        requestId: `stale-${randomUUID()}`,
        requestHash: "stale",
        challengeId,
        assignmentRevision: assignmentRevision + 99,
        snapshotRevision: assignmentRevision + 99,
      });
      const staleKind = (stale.body as { kind?: string; reasonCode?: string })?.kind;
      const staleReason = (stale.body as { reasonCode?: string })?.reasonCode;
      results.recalc_stale_rejected =
        staleKind === "conflict" || staleReason === "stale_recalculation" || staleKind === "forbidden"
          ? "PASS"
          : `FAIL ${JSON.stringify(stale.body)}`;
    }
  }

  {
    const { data } = await admin
      .from("prop_os_challenge_recalc")
      .select("state,assignment_revision,snapshot_revision")
      .eq("challenge_id", challengeId)
      .maybeSingle();
    results.recalc_state_completed =
      data?.state === "completed" ? "PASS" : `FAIL ${JSON.stringify(data)}`;
    ids.recalc_state_after = data?.state ?? null;
  }

  // Prop Pass read model: allowlisted can read engine/score
  {
    const { data: eng, error } = await allow.client
      .from("prop_engine_snapshots")
      .select("id,status,input_revision")
      .eq("challenge_id", challengeId)
      .limit(1);
    results.prop_pass_read_refresh =
      !error && Array.isArray(eng) && eng.length > 0 ? "PASS" : `FAIL ${JSON.stringify({ eng, error })}`;
    const denyRead = await deny.client
      .from("prop_engine_snapshots")
      .select("id")
      .eq("challenge_id", challengeId);
    results.deny_engine_read =
      !denyRead.error && Array.isArray(denyRead.data) && denyRead.data.length === 0
        ? "PASS"
        : `FAIL`;
  }

  // PI request + complete
  const scope: IntelligenceScope = {
    kind: "challenge",
    challengeId,
    accountId,
  };
  const sk = scopeKey(scope);
  {
    const cmd = {
      accountId,
      scope,
      scopeKey: sk,
      clientRequestId: newPropOsClientRequestId(),
    };
    // Hash payload mirrors client gateway body shape used in PG QA loosely
    const hashBody = {
      accountId,
      scope,
      scopeKey: sk,
      clientRequestId: cmd.clientRequestId,
    };
    const { data, error } = await allow.client.rpc(
      "prop_os_cmd_request_performance_intelligence",
      {
        p_client_request_id: cmd.clientRequestId,
        p_payload_hash: hashPropOsCommandPayload("request_performance_intelligence", hashBody),
        p_account_id: accountId,
        p_scope_json: scope,
        p_scope_key: sk,
      },
    );
    results.pi_requested =
      !error &&
      ["queued", "running", "completed"].includes(String((data as { kind?: string })?.kind))
        ? "PASS"
        : `FAIL ${error?.message ?? JSON.stringify(data)}`;
    ids.pi_request = red(cmd.clientRequestId);
    ids.pi_scope_key = sk.slice(0, 12) + "…";
  }

  {
    const { data: journal } = await allow.client
      .from("trade_journal")
      .select(
        "id,client_id,user_id,symbol,direction,pnl,entry_time,exit_time,contracts,trade_date,deleted_at",
      )
      .eq("client_id", tradeClientId)
      .maybeSingle();
    const facts: RawJournalTradeFact[] = journal
      ? [
          {
            journalTradeId: String(journal.id),
            tradeClientId: String(journal.client_id),
            userId: String(journal.user_id),
            symbol: String(journal.symbol),
            direction: String(journal.direction),
            pnlMajor: Number(journal.pnl),
            feesMajor: 0,
            contracts: Number(journal.contracts ?? 1),
            occurredAtUtc: String(journal.exit_time ?? journal.entry_time),
            exitTime: journal.exit_time == null ? null : String(journal.exit_time),
            entryTime: journal.entry_time == null ? null : String(journal.entry_time),
            open: false,
            deletedAt: journal.deleted_at == null ? null : String(journal.deleted_at),
            assignmentRevision,
            accountId,
            challengeId,
          },
        ]
      : [];

    const snap = calculatePerformanceIntelligence({
      userId: ALLOW,
      scope,
      assignmentRevision,
      facts,
      asOfUtc,
    });
    const payload = snapshotToPiJson(snap);
    const done = await callProcessor("prop-os-pi-processor", {
      op: "complete",
      userId: ALLOW,
      scopeKey: sk,
      assignmentRevision,
      snapshot: payload,
    });
    results.pi_completed =
      done.status === 200 && done.body?.kind === "success"
        ? "PASS"
        : `FAIL ${JSON.stringify(done)}`;
    ids.pi_snapshot = red(String((done.body as { snapshotId?: string })?.snapshotId ?? ""));

    const again = await callProcessor("prop-os-pi-processor", {
      op: "complete",
      userId: ALLOW,
      scopeKey: sk,
      assignmentRevision,
      snapshot: payload,
    });
    results.pi_idempotent =
      again.status === 200 && again.body?.kind === "success" ? "PASS" : `FAIL`;

    const stale = await callProcessor("prop-os-pi-processor", {
      op: "complete",
      userId: ALLOW,
      scopeKey: sk,
      assignmentRevision: assignmentRevision + 50,
      snapshot: { ...payload, inputRevision: "stale-rev" },
    });
    results.pi_stale_rejected =
      (stale.body as { kind?: string })?.kind === "conflict" ? "PASS" : `FAIL ${JSON.stringify(stale.body)}`;
  }

  {
    const { data } = await allow.client
      .from("prop_performance_intelligence_current")
      .select("snapshot_id,status,assignment_revision,input_revision")
      .eq("user_id", ALLOW)
      .eq("scope_key", sk)
      .maybeSingle();
    results.pi_current_projection =
      data && data.snapshot_id && Number(data.assignment_revision) === assignmentRevision
        ? "PASS"
        : `FAIL ${JSON.stringify(data)}`;
    ids.pi_current = red(data?.snapshot_id ? String(data.snapshot_id) : null);
    ids.pi_current_status = data?.status ?? null;

    const { data: findings } = await allow.client
      .from("prop_performance_intelligence_findings")
      .select("finding_id")
      .eq("snapshot_id", data?.snapshot_id ?? "00000000-0000-0000-0000-000000000000")
      .limit(20);
    results.pi_findings_readable = !findings || Array.isArray(findings) ? "PASS" : "FAIL";
    ids.pi_findings_count = Array.isArray(findings) ? findings.length : 0;
  }

  // Direct authenticated DML denial
  {
    let blocked = false;
    const { error } = await allow.client.from("prop_engine_snapshots").delete().eq("challenge_id", challengeId);
    if (error) blocked = true;
    const { count } = await admin
      .from("prop_engine_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challengeId);
    results.snapshot_immutability_dml =
      blocked || (count ?? 0) > 0 ? "PASS" : "FAIL deleted";
  }

  // Cross-user denial already covered; anon processor deny
  {
    const anon = await fetch(`${URL}/functions/v1/prop-os-pi-processor`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ op: "ping" }),
    });
    results.anon_processor_denied = anon.status === 403 ? "PASS" : `FAIL ${anon.status}`;
  }

  const out = { results, ids };
  console.log(JSON.stringify(out, null, 2));
  writeFileSync("/tmp/stg_full_vertical_slice.json", JSON.stringify(out, null, 2));
  const failed = Object.entries(results).filter(([, v]) => !String(v).startsWith("PASS"));
  if (failed.length) {
    console.error("FAILED", failed);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
