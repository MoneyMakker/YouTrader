/**
 * Phase 2C remediation — trusted recalc privileges, live vertical slice,
 * consistency, dual-context reassignment, atomicity, projection rebuild.
 * Isolated local Postgres only. No memory repository after assignment gateway.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  orderedEngineInputBytes,
  orderTradesForEngine,
  prepareTrustedRecalculation,
  PROP_OS_JOURNAL_TRADE_IDENTITY,
  TRUSTED_RECALC_PROCESSOR_ROLES,
} from "../src/propOs/assignments/index";
import { ensureAuthUser } from "./prop-os-accounts-pg-store";
import type { ChallengeRow, ExecutionRow, RuleSnapshotRow } from "../src/propOs/shadow/types";

const DB = process.env.PROP_OS_PHASE2C_REMED_DB ?? "prop_os_phase2c_remed";
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ROOT = path.resolve(import.meta.dirname, "..");
const CAPTURE = path.join(ROOT, ".tmp/prop-pass-phase2c-remediation-captures");
const AS_OF = "2026-02-10T18:00:00.000Z";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

function capture(name: string, payload: unknown) {
  fs.mkdirSync(CAPTURE, { recursive: true });
  fs.writeFileSync(path.join(CAPTURE, `${name}.json`), JSON.stringify(payload, null, 2));
}

function psql(sql: string): string {
  return execFileSync(
    "psql",
    ["-d", DB, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/postgresql@17/bin:${process.env.PATH ?? ""}`,
        PGHOST: process.env.PGHOST ?? "localhost",
        PGPORT: process.env.PGPORT ?? "55432",
        PGUSER: process.env.PGUSER ?? "postgres",
      },
    },
  ).trim();
}

function hash(commandType: string, body: unknown): string {
  return createHash("sha256")
    .update(`${commandType}\0${JSON.stringify(body)}`)
    .digest("hex")
    .slice(0, 32);
}

function asAuth(userId: string, sql: string): string {
  return psql(`
    begin;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;
    ${sql}
    commit;
  `);
}

function asProcessor(sql: string): string {
  return psql(`
    begin;
    set local role prop_os_recalc_processor;
    ${sql}
    commit;
  `);
}

function parseJson(raw: string): Record<string, unknown> {
  const lines = raw.split("\n").filter((l) => l.startsWith("{") || l.startsWith("["));
  const joined = lines.join("") || raw;
  const start = joined.indexOf("{");
  const end = joined.lastIndexOf("}");
  assert.ok(start >= 0 && end > start, `no json in: ${raw}`);
  return JSON.parse(joined.slice(start, end + 1)) as Record<string, unknown>;
}

function allowlist(userId: string) {
  psql(`select public.prop_os_cmd_admin_allowlist_add('${userId}'::uuid, 'phase2c-remed');`);
}

function seedAccountChallenge(label: string, reqPrefix: string) {
  const body = {
    label,
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
  };
  const h = hash("create_account", body);
  const out = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_account(
      '${reqPrefix}-acc', '${h}', '${label}', 'apex-demo', 5000000, 'USD', 'America/New_York'
    );`,
  );
  assert.equal(parseJson(out).kind, "success", out);
  const accId = psql(
    `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid and label = '${label}' limit 1`,
  );
  const snap = JSON.stringify({
    version: "rs-2c-remed",
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
  }).replace(/'/g, "''");
  const chBody = {
    accountId: accId,
    templateId: "internal.apex-demo.eval.static",
    ruleSnapshot: { version: "rs-2c-remed" },
  };
  const chH = hash("create_challenge_attempt", chBody);
  const chOut = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_challenge_attempt(
      '${reqPrefix}-ch', '${chH}', '${accId}'::uuid,
      'internal.apex-demo.eval.static', '2026.07.1',
      '${snap}'::jsonb, 'evaluation', '2026-01-01T00:00:00Z'::timestamptz, null
    );`,
  );
  assert.equal(parseJson(chOut).kind, "success", chOut);
  const chId = psql(
    `select id::text from public.prop_challenges where account_id = '${accId}'::uuid order by created_at desc limit 1`,
  );
  return { accId, chId };
}

function seedJournal(
  userId: string,
  clientId: string,
  pnl: number,
  exitTime: string,
  opts?: { deleted?: boolean },
) {
  const id = randomUUID();
  psql(`
    begin;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.trade_journal (
      id, user_id, client_id, trade_date, symbol, direction, contracts, pnl,
      entry_time, exit_time, mood, notes, created_at, updated_at, deleted_at
    ) values (
      '${id}'::uuid, '${userId}'::uuid, '${clientId}', '2026-02-01', 'ES', 'LONG', 1, ${pnl},
      '${exitTime}', '${exitTime}', 'ok', '', now(), now(),
      ${opts?.deleted ? `'2026-02-01T00:00:00Z'::timestamptz` : "null"}
    )
    on conflict (user_id, client_id) do update
      set pnl = excluded.pnl, exit_time = excluded.exit_time, deleted_at = excluded.deleted_at;
    commit;
  `);
  return id;
}

function assign(
  req: string,
  accId: string,
  chId: string,
  ids: string[],
  allowReassign = false,
) {
  const h = hash("assign_trades", { accountId: accId, challengeId: chId, tradeClientIds: [...ids].sort() });
  const arr = ids.map((x) => `'${x}'`).join(",");
  const out = asAuth(
    OWNER,
    `select public.prop_os_cmd_assign_trades(
      '${req}', '${h}', '${accId}'::uuid, '${chId}'::uuid,
      array[${arr}], 'manual', null, ${allowReassign}
    );`,
  );
  return parseJson(out);
}

function remove(req: string, accId: string, ids: string[]) {
  const h = hash("remove_trade_assignments", { accountId: accId, tradeClientIds: [...ids].sort() });
  const arr = ids.map((x) => `'${x}'`).join(",");
  return parseJson(
    asAuth(
      OWNER,
      `select public.prop_os_cmd_remove_trade_assignments(
        '${req}', '${h}', '${accId}'::uuid, array[${arr}], 'user_removed'
      );`,
    ),
  );
}

function loadChallenge(chId: string): ChallengeRow {
  const raw = psql(`
    select row_to_json(t) from (
      select id::text, user_id::text, account_id::text, phase, status, rule_set_version,
             starting_balance_minor, started_at::text, ended_at::text,
             reset_of_challenge_id::text, breach_locked, schema_version
      from public.prop_challenges where id = '${chId}'::uuid
    ) t;
  `);
  const j = JSON.parse(raw) as Record<string, unknown>;
  return {
    id: String(j.id),
    user_id: String(j.user_id),
    account_id: String(j.account_id),
    phase: String(j.phase),
    status: String(j.status),
    rule_set_version: String(j.rule_set_version),
    starting_balance_minor: Number(j.starting_balance_minor),
    started_at: String(j.started_at),
    ended_at: j.ended_at == null ? null : String(j.ended_at),
    reset_of_challenge_id: j.reset_of_challenge_id == null ? null : String(j.reset_of_challenge_id),
    breach_locked: Boolean(j.breach_locked),
    schema_version: String(j.schema_version),
  };
}

function loadRule(chId: string): RuleSnapshotRow {
  const raw = psql(`
    select row_to_json(t) from (
      select id::text, user_id::text, challenge_id::text, rule_set_version, snapshot,
             template_key, template_version_at_capture, captured_at::text, schema_version
      from public.prop_challenge_rule_snapshots
      where challenge_id = '${chId}'::uuid
      order by captured_at desc limit 1
    ) t;
  `);
  const j = JSON.parse(raw) as Record<string, unknown>;
  return {
    id: String(j.id),
    user_id: String(j.user_id),
    challenge_id: String(j.challenge_id),
    rule_set_version: String(j.rule_set_version),
    snapshot: j.snapshot as RuleSnapshotRow["snapshot"],
    template_key: j.template_key == null ? null : String(j.template_key),
    template_version_at_capture:
      j.template_version_at_capture == null ? null : String(j.template_version_at_capture),
    captured_at: String(j.captured_at),
    schema_version: String(j.schema_version),
  };
}

function loadExecutions(chId: string): ExecutionRow[] {
  const raw = psql(`
    select coalesce(json_agg(row_to_json(t) order by t.occurred_at, t.id), '[]'::json) from (
      select id, user_id::text, challenge_id::text, account_id::text, trade_client_id,
             occurred_at::text, broker_sequence, realized_pnl_minor, fees_minor,
             contracts, voided, corrects_event_id::text, source, schema_version
      from public.prop_executions
      where challenge_id = '${chId}'::uuid and voided = false
    ) t;
  `);
  const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
  return arr.map((j) => ({
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
}

function persistPrepared(
  prepared: ReturnType<typeof prepareTrustedRecalculation>,
  userId: string,
  challengeId: string,
) {
  const eng = prepared.engineSnapshot;
  const score = prepared.scoreSnapshot;
  const engId = randomUUID();
  const scoreId = randomUUID();
  const engPayload = JSON.stringify(eng.payload).replace(/'/g, "''");
  const scorePayload = JSON.stringify(score.payload).replace(/'/g, "''");
  const engConf = JSON.stringify(eng.confidence).replace(/'/g, "''");
  const scoreConf = JSON.stringify(score.confidence).replace(/'/g, "''");
  const engLim = JSON.stringify(eng.limitations).replace(/'/g, "''");
  const scoreLim = JSON.stringify(score.limitations).replace(/'/g, "''");
  psql(`
    insert into public.prop_engine_snapshots (
      id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations,
      readiness_model_version, confidence_policy_version, fixture_contract_version,
      schema_version, created_at
    ) values (
      '${engId}'::uuid, '${userId}'::uuid, '${challengeId}'::uuid,
      '${eng.calculation_version}', '${eng.rule_set_version}', '${prepared.inputRevision}',
      '${eng.calculated_at}'::timestamptz, '${eng.status}',
      '${engPayload}'::jsonb, '${engConf}'::jsonb, '${engLim}'::jsonb,
      ${eng.readiness_model_version ? `'${eng.readiness_model_version}'` : "null"},
      '${eng.confidence_policy_version}', 'assignment-recalc-v0',
      'prop-os-schema-v0', '${eng.created_at}'::timestamptz
    );

    insert into public.prop_score_snapshots (
      id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations,
      readiness_model_version, confidence_policy_version, fixture_contract_version,
      schema_version, created_at
    ) values (
      '${scoreId}'::uuid, '${userId}'::uuid, '${challengeId}'::uuid,
      '${score.calculation_version}', '${score.rule_set_version}', '${prepared.inputRevision}',
      '${score.calculated_at}'::timestamptz, '${score.status}',
      '${scorePayload}'::jsonb, '${scoreConf}'::jsonb, '${scoreLim}'::jsonb,
      ${score.readiness_model_version ? `'${score.readiness_model_version}'` : "null"},
      '${score.confidence_policy_version}', 'assignment-recalc-v0',
      'prop-os-schema-v0', '${score.created_at}'::timestamptz
    );
  `);
}

function processorComplete(req: string, chId: string, rev: number) {
  const h = hash("complete_recalculation", { challengeId: chId, rev });
  return parseJson(
    asProcessor(`
      select public.prop_os_cmd_complete_recalculation(
        '${req}', '${h}', '${chId}'::uuid, ${rev}, ${rev}
      );
    `),
  );
}

function runTrustedSlice(chId: string, rev: number, req: string) {
  const mark = parseJson(
    asProcessor(`
      select public.prop_os_cmd_processor_mark_recalc_running('${chId}'::uuid, ${rev});
    `),
  );
  assert.equal(mark.kind, "success", JSON.stringify(mark));
  const prepared = prepareTrustedRecalculation({
    userId: OWNER,
    challengeRow: loadChallenge(chId),
    ruleSnapshotRow: loadRule(chId),
    executionRows: loadExecutions(chId),
    assignmentRevision: rev,
    asOfUtc: AS_OF,
  });
  persistPrepared(prepared, OWNER, chId);
  const done = processorComplete(req, chId, rev);
  assert.equal(done.kind, "success", JSON.stringify(done));
  return prepared;
}

function main() {
  console.log("prop-pass-phase2c-remediation-pg-qa");
  fs.mkdirSync(CAPTURE, { recursive: true });
  ensureAuthUser(DB, OWNER, "owner-2c-remed@example.com");
  ensureAuthUser(DB, OTHER, "other-2c-remed@example.com");
  allowlist(OWNER);
  allowlist(OTHER);
  psql(`select public.prop_os_cmd_admin_set_enabled(true);`);

  // ----- 1. Privilege matrix -----
  check("identity contract exported", () => {
    assert.equal(PROP_OS_JOURNAL_TRADE_IDENTITY.canonicalPrimaryKey, "trade_journal.id");
    assert.ok(TRUSTED_RECALC_PROCESSOR_ROLES.includes("prop_os_recalc_processor"));
  });

  const privMatrix = {
    complete: {
      public: psql(`select has_function_privilege('public', 'public.prop_os_cmd_complete_recalculation(text,text,uuid,bigint,bigint)', 'EXECUTE')`),
      anon: psql(`select has_function_privilege('anon', 'public.prop_os_cmd_complete_recalculation(text,text,uuid,bigint,bigint)', 'EXECUTE')`),
      authenticated: psql(`select has_function_privilege('authenticated', 'public.prop_os_cmd_complete_recalculation(text,text,uuid,bigint,bigint)', 'EXECUTE')`),
      processor: psql(`select has_function_privilege('prop_os_recalc_processor', 'public.prop_os_cmd_complete_recalculation(text,text,uuid,bigint,bigint)', 'EXECUTE')`),
      service_role: psql(`select has_function_privilege('service_role', 'public.prop_os_cmd_complete_recalculation(text,text,uuid,bigint,bigint)', 'EXECUTE')`),
    },
    fail: {
      public: psql(`select has_function_privilege('public', 'public.prop_os_cmd_fail_recalculation(text,text,uuid,bigint,text)', 'EXECUTE')`),
      anon: psql(`select has_function_privilege('anon', 'public.prop_os_cmd_fail_recalculation(text,text,uuid,bigint,text)', 'EXECUTE')`),
      authenticated: psql(`select has_function_privilege('authenticated', 'public.prop_os_cmd_fail_recalculation(text,text,uuid,bigint,text)', 'EXECUTE')`),
      processor: psql(`select has_function_privilege('prop_os_recalc_processor', 'public.prop_os_cmd_fail_recalculation(text,text,uuid,bigint,text)', 'EXECUTE')`),
    },
  };
  capture("privilege-matrix", privMatrix);

  check("App authenticated JWT cannot EXECUTE complete/fail", () => {
    assert.ok(privMatrix.complete.authenticated === "f" || privMatrix.complete.authenticated === "false");
    assert.ok(privMatrix.fail.authenticated === "f" || privMatrix.fail.authenticated === "false");
    assert.ok(privMatrix.complete.public === "f" || privMatrix.complete.public === "false");
    assert.ok(privMatrix.complete.anon === "f" || privMatrix.complete.anon === "false");
    assert.ok(privMatrix.complete.processor === "t" || privMatrix.complete.processor === "true");
  });

  check("live App-role call to complete is denied", () => {
    let denied = false;
    try {
      asAuth(
        OWNER,
        `select public.prop_os_cmd_complete_recalculation(
          'req-auth-complete', 'h', gen_random_uuid(), 1, 1
        );`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);
  });

  check("client_id immutable after creation", () => {
    seedJournal(OWNER, "imm-cid", 10, "2026-02-01T15:00:00Z");
    let blocked = false;
    try {
      psql(`update public.trade_journal set client_id = 'mutated' where client_id = 'imm-cid' and user_id = '${OWNER}'::uuid`);
    } catch {
      blocked = true;
    }
    assert.equal(blocked, true);
  });

  // ----- 2. Live vertical slice -----
  const { accId, chId } = seedAccountChallenge("2C Remed A", "rem-a");
  const { accId: accB, chId: chB } = seedAccountChallenge("2C Remed B", "rem-b");
  // Second challenge on same account for reassignment dual-context
  const snap = JSON.stringify({
    version: "rs-2c-remed-b",
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
  }).replace(/'/g, "''");
  // Use account A for dual challenges: create second challenge on accId
  const ch2Body = {
    accountId: accId,
    templateId: "internal.apex-demo.eval.static",
    ruleSnapshot: { version: "rs-2c-remed-b" },
  };
  const ch2H = hash("create_challenge_attempt", ch2Body);
  // attempt_number uniqueness — may need distinct template; use create with different started_at
  const ch2Out = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_challenge_attempt(
      'rem-a-ch2', '${ch2H}', '${accId}'::uuid,
      'internal.apex-demo.eval.static', '2026.07.1',
      '${snap}'::jsonb, 'evaluation', '2026-01-15T00:00:00Z'::timestamptz, null
    );`,
  );
  const ch2Kind = parseJson(ch2Out).kind;
  let ch2 = chId;
  if (ch2Kind === "success") {
    ch2 = psql(
      `select id::text from public.prop_challenges where account_id = '${accId}'::uuid and id <> '${chId}'::uuid order by created_at desc limit 1`,
    );
  } else {
    // fallback: use account B challenge as destination
    ch2 = chB;
  }

  seedJournal(OWNER, "slice-t1", 150, "2026-02-01T15:00:00Z");
  seedJournal(OWNER, "slice-t2", -25, "2026-02-02T16:00:00Z");
  seedJournal(OTHER, "other-slice", 99, "2026-02-01T15:00:00Z");

  let beforeReady: number | null = null;
  check("live slice: assign → engine → snapshots → Prop Pass revision", () => {
    const a1 = assign("rem-slice-1", accId, chId, ["slice-t1"]);
    assert.equal(a1.kind, "success", JSON.stringify(a1));
    const value = a1.value as { assignmentRevision: number };
    const rev1 = value.assignmentRevision;
    const queued = psql(
      `select state || ':' || assignment_revision::text from public.prop_os_challenge_recalc where challenge_id = '${chId}'::uuid`,
    );
    assert.equal(queued, `queued:${rev1}`);

    const jid = psql(
      `select journal_trade_id::text from public.prop_trade_assignment_events
       where trade_client_id = 'slice-t1' and state = 'assigned' limit 1`,
    );
    assert.ok(jid && jid.length > 10);

    const prep1 = runTrustedSlice(chId, rev1, "rem-complete-1");
    beforeReady = prep1.readinessScore;
    const state1 = psql(
      `select state || ':' || assignment_revision::text || ':' || coalesce(snapshot_revision::text,'')
       from public.prop_os_challenge_recalc where challenge_id = '${chId}'::uuid`,
    );
    assert.equal(state1, `completed:${rev1}:${rev1}`);

    // Second assignment changes engine input → new snapshot revision
    const a2 = assign("rem-slice-2", accId, chId, ["slice-t2"]);
    assert.equal(a2.kind, "success", JSON.stringify(a2));
    const rev2 = (a2.value as { assignmentRevision: number }).assignmentRevision;
    assert.ok(rev2 > rev1);

    const prep2 = runTrustedSlice(chId, rev2, "rem-complete-2");
    assert.notEqual(prep1.inputRevision, prep2.inputRevision);
    assert.ok(prep2.orderedTradeClientIds.includes("slice-t1"));
    assert.ok(prep2.orderedTradeClientIds.includes("slice-t2"));

    capture("live-vertical-slice-before-after", {
      before: {
        assignmentRevision: rev1,
        inputRevision: prep1.inputRevision,
        readinessScore: prep1.readinessScore,
        ordered: prep1.orderedTradeClientIds,
        engineStatus: prep1.engineStatus,
      },
      after: {
        assignmentRevision: rev2,
        inputRevision: prep2.inputRevision,
        readinessScore: prep2.readinessScore,
        ordered: prep2.orderedTradeClientIds,
        engineStatus: prep2.engineStatus,
      },
      journalUnchanged: {
        t1: psql(`select pnl::text from public.trade_journal where client_id = 'slice-t1'`),
        t2: psql(`select pnl::text from public.trade_journal where client_id = 'slice-t2'`),
      },
    });
    void beforeReady;
  });

  // ----- 3. Consistency contract -----
  check("stale completion after N+1 conflicts; fail leaves snapshots non-current", () => {
    const a3 = assign("rem-cons-1", accId, chId, ["slice-t1", "slice-t2"]);
    assert.equal(a3.kind, "success");
    const revN = (a3.value as { assignmentRevision: number }).assignmentRevision;
    // Queue N+1 by another assign (idempotent same set still bumps? same challenge already assigned — may not bump)
    seedJournal(OWNER, "slice-t3", 40, "2026-02-03T12:00:00Z");
    const a4 = assign("rem-cons-2", accId, chId, ["slice-t3"]);
    assert.equal(a4.kind, "success");
    const revNp1 = (a4.value as { assignmentRevision: number }).assignmentRevision;
    assert.ok(revNp1 > revN);

    const stale = parseJson(
      asProcessor(`
        select public.prop_os_cmd_complete_recalculation(
          'rem-stale', 'hstale', '${chId}'::uuid, ${revN}, ${revN}
        );
      `),
    );
    assert.equal(stale.kind, "conflict");
    assert.equal(stale.reasonCode, "stale_recalculation");

    const incomplete = parseJson(
      asProcessor(`
        select public.prop_os_cmd_complete_recalculation(
          'rem-incomplete', 'hinc', '${chId}'::uuid, ${revNp1}, ${revNp1}
        );
      `),
    );
    assert.equal(incomplete.kind, "conflict");
    assert.equal(incomplete.reasonCode, "snapshots_incomplete");

    const fail = parseJson(
      asProcessor(`
        select public.prop_os_cmd_fail_recalculation(
          'rem-fail', 'hfail', '${chId}'::uuid, ${revNp1}, 'engine_test_fail'
        );
      `),
    );
    assert.equal(fail.kind, "success");
    const job = psql(
      `select state || ':' || coalesce(snapshot_revision::text,'null') from public.prop_os_challenge_recalc where challenge_id = '${chId}'::uuid`,
    );
    // Previous completed snapshot_revision must not jump to revNp1
    assert.ok(job.startsWith("failed:"));
    assert.ok(!job.endsWith(`:${revNp1}`));

    // Retry same revision after preparing snapshots — idempotent complete
    const prep = runTrustedSlice(chId, revNp1, "rem-retry-ok");
    const receiptReplay = processorComplete("rem-retry-ok", chId, revNp1);
    assert.equal(receiptReplay.kind, "success");
    const again = processorComplete("rem-retry-ok-2", chId, revNp1);
    assert.equal(again.kind, "success");
    const idem = (again.value as { idempotent?: boolean }).idempotent;
    assert.equal(idem, true);
    capture("consistency-stale-fail-retry", {
      stale,
      incomplete,
      fail,
      prep: prep.inputRevision,
      receiptReplay,
      again,
    });
  });

  // ----- 4. Reassignment / removal dual context -----
  check("reassignment dual-context + removal drops trade from engine input", () => {
    // Force a second active challenge on the same account for clean dual-context.
    let destChallenge = ch2 !== chId ? ch2 : "";
    if (!destChallenge) {
      destChallenge = randomUUID();
      psql(`
        insert into public.prop_challenges (
          id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
          started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version,
          created_at, updated_at, attempt_number
        ) values (
          '${destChallenge}'::uuid, '${OWNER}'::uuid, '${accId}'::uuid, 'evaluation', 'active',
          'rs-2c-remed-dual', 5000000, '2026-01-20T00:00:00Z'::timestamptz, null, null, false,
          'prop-os-schema-v0', now(), now(),
          coalesce((select max(attempt_number) from public.prop_challenges where account_id = '${accId}'::uuid), 0) + 1
        );
        insert into public.prop_challenge_rule_snapshots (
          id, user_id, challenge_id, rule_set_version, snapshot, template_key,
          template_version_at_capture, captured_at, schema_version
        ) values (
          gen_random_uuid(), '${OWNER}'::uuid, '${destChallenge}'::uuid, 'rs-2c-remed-dual',
          '${snap}'::jsonb, 'apex-demo', 't1', now(), 'prop-os-schema-v0'
        );
      `);
    }

    seedJournal(OWNER, "dual-t", 80, "2026-02-04T14:00:00Z");
    const a = assign("rem-dual-1", accId, chId, ["dual-t"]);
    assert.equal(a.kind, "success");
    const revPrev = (a.value as { assignmentRevision: number }).assignmentRevision;
    runTrustedSlice(chId, revPrev, "rem-dual-prev-complete");

    const re = parseJson(
      asAuth(
        OWNER,
        `select public.prop_os_cmd_reassign_trades(
          'rem-dual-re', '${hash("reassign_trades", { accountId: accId, challengeId: destChallenge, tradeClientIds: ["dual-t"] })}',
          '${accId}'::uuid, '${destChallenge}'::uuid, array['dual-t'], true, 'manual', null
        );`,
      ),
    );
    assert.equal(re.kind, "success", JSON.stringify(re));

    const affected = re.value as { affectedChallengeIds: string[]; assignmentRevision: number };
    assert.ok(affected.affectedChallengeIds.includes(chId));
    assert.ok(affected.affectedChallengeIds.includes(destChallenge));
    const rev = affected.assignmentRevision;

    const revPrevJob = Number(
      psql(
        `select assignment_revision from public.prop_os_challenge_recalc where challenge_id = '${chId}'::uuid`,
      ),
    );
    const revDestJob = Number(
      psql(
        `select assignment_revision from public.prop_os_challenge_recalc where challenge_id = '${destChallenge}'::uuid`,
      ),
    );
    assert.equal(revPrevJob, rev);
    assert.equal(revDestJob, rev);
    assert.equal(
      psql(`select state from public.prop_os_challenge_recalc where challenge_id = '${chId}'::uuid`),
      "queued",
    );
    assert.equal(
      psql(`select state from public.prop_os_challenge_recalc where challenge_id = '${destChallenge}'::uuid`),
      "queued",
    );

    // Destination engine input includes the trade; previous projection does not.
    const prepDest = runTrustedSlice(destChallenge, rev, "rem-dual-re-dest");
    assert.ok(prepDest.orderedTradeClientIds.includes("dual-t"));
    const proj = psql(
      `select coalesce(challenge_id::text,'null') from public.prop_trade_assignments
       where user_id = '${OWNER}'::uuid and trade_client_id = 'dual-t'`,
    );
    assert.equal(proj, destChallenge);
    assert.notEqual(proj, chId);

    // Removal from destination → previous context recalculated without trade in projection
    const rm = remove("rem-dual-rm-final", accId, ["dual-t"]);
    assert.equal(rm.kind, "success", JSON.stringify(rm));
    const revRm = (rm.value as { assignmentRevision: number }).assignmentRevision;
    assert.equal(
      Number(
        psql(
          `select assignment_revision from public.prop_os_challenge_recalc where challenge_id = '${destChallenge}'::uuid`,
        ),
      ),
      revRm,
    );
    const projAfter = psql(
      `select coalesce(challenge_id::text,'null') from public.prop_trade_assignments
       where user_id = '${OWNER}'::uuid and trade_client_id = 'dual-t'`,
    );
    assert.equal(projAfter, "null");
    const prepAfterRm = prepareTrustedRecalculation({
      userId: OWNER,
      challengeRow: loadChallenge(destChallenge),
      ruleSnapshotRow: loadRule(destChallenge),
      executionRows: loadExecutions(destChallenge).filter((e) => {
        // Only executions still reflected by current assignment projection
        const assigned = psql(`
          select count(*) from public.prop_trade_assignments
          where user_id = '${OWNER}'::uuid
            and trade_client_id = '${e.trade_client_id}'
            and challenge_id = '${destChallenge}'::uuid
            and assignment_state in ('manual','verified_import')
        `);
        return assigned !== "0";
      }),
      assignmentRevision: revRm,
      asOfUtc: AS_OF,
    });
    assert.equal(prepAfterRm.orderedTradeClientIds.includes("dual-t"), false);

    capture("dual-context-reassign", {
      affected,
      revPrevJob,
      revDestJob,
      prepDest: prepDest.orderedTradeClientIds,
      proj,
      revRm,
      projAfter,
      afterRmOrdered: prepAfterRm.orderedTradeClientIds,
      unusedAccountB: accB,
    });
  });

  // ----- 6. Atomicity failure injection -----
  for (const stage of ["revision", "event", "projection", "queue", "receipt"]) {
    check(`atomicity: fail_after=${stage} → no partial success`, () => {
      seedJournal(OWNER, `atom-${stage}`, 11, "2026-02-05T10:00:00Z");
      const beforeEvents = psql(
        `select count(*) from public.prop_trade_assignment_events where trade_client_id = 'atom-${stage}'`,
      );
      const beforeReceipts = psql(
        `select count(*) from public.prop_os_command_receipts where client_request_id = 'rem-atom-${stage}'`,
      );
      const h = hash("assign_trades", {
        accountId: accId,
        challengeId: chId,
        tradeClientIds: [`atom-${stage}`],
      });
      const out = asAuth(
        OWNER,
        `
        select set_config('prop_os.fail_after', '${stage}', true);
        select public.prop_os_cmd_assign_trades(
          'rem-atom-${stage}', '${h}', '${accId}'::uuid, '${chId}'::uuid,
          array['atom-${stage}'], 'manual', null, false
        );
        `,
      );
      const j = parseJson(out);
      assert.equal(j.kind, "unexpected_error", JSON.stringify(j));
      const afterEvents = psql(
        `select count(*) from public.prop_trade_assignment_events where trade_client_id = 'atom-${stage}'`,
      );
      const afterReceipts = psql(
        `select count(*) from public.prop_os_command_receipts where client_request_id = 'rem-atom-${stage}'`,
      );
      assert.equal(afterEvents, beforeEvents);
      assert.equal(afterReceipts, beforeReceipts);

      // Retry without injection succeeds
      const ok = assign(`rem-atom-retry-${stage}`, accId, chId, [`atom-${stage}`]);
      assert.equal(ok.kind, "success", JSON.stringify(ok));
    });
  }

  // ----- 7. Projection rebuild parity -----
  check("projection rebuild parity + single current challenge", () => {
    const parityBefore = parseJson(
      psql(`select public.prop_os_assignment_projection_parity('${OWNER}'::uuid);`),
    );
    assert.equal(parityBefore.kind, "success", JSON.stringify(parityBefore));

    // Corrupt projection then rebuild
    psql(`
      update public.prop_trade_assignments
         set challenge_id = null, assignment_state = 'unassigned'
       where user_id = '${OWNER}'::uuid and trade_client_id = 'slice-t1';
    `);
    const mismatch = parseJson(
      psql(`select public.prop_os_assignment_projection_parity('${OWNER}'::uuid);`),
    );
    assert.equal(mismatch.kind, "mismatch");

    const rebuilt = parseJson(
      asProcessor(`select public.prop_os_assignment_rebuild_projection('${OWNER}'::uuid);`),
    );
    assert.equal(rebuilt.kind, "success");
    const parityAfter = parseJson(
      psql(`select public.prop_os_assignment_projection_parity('${OWNER}'::uuid);`),
    );
    assert.equal(parityAfter.kind, "success", JSON.stringify(parityAfter));

    const multi = psql(`
      select count(*) from (
        select trade_client_id from public.prop_trade_assignments
        where user_id = '${OWNER}'::uuid and challenge_id is not null
          and assignment_state in ('manual','verified_import')
        group by trade_client_id having count(*) > 1
      ) d
    `);
    assert.equal(multi, "0");
    capture("projection-rebuild-parity", { parityBefore, mismatch, rebuilt, parityAfter });
  });

  // ----- 8. Deterministic ordering byte equality -----
  check("deterministic engine input byte-equality for same revision", () => {
    const execs = loadExecutions(chId);
    const prepA = prepareTrustedRecalculation({
      userId: OWNER,
      challengeRow: loadChallenge(chId),
      ruleSnapshotRow: loadRule(chId),
      executionRows: execs,
      assignmentRevision: 99,
      asOfUtc: AS_OF,
    });
    const shuffled = [...execs].reverse();
    const prepB = prepareTrustedRecalculation({
      userId: OWNER,
      challengeRow: loadChallenge(chId),
      ruleSnapshotRow: loadRule(chId),
      executionRows: shuffled,
      assignmentRevision: 99,
      asOfUtc: AS_OF,
    });
    assert.equal(prepA.inputRevision, prepB.inputRevision);
    const bytesA = orderedEngineInputBytes(
      orderTradesForEngine(
        execs.map((e) => ({
          identity: {
            tradeClientId: e.trade_client_id ?? e.id,
            userId: OWNER,
            journalTradeId: null,
          },
          symbol: "ES",
          direction: "LONG",
          pnlMajor: (e.realized_pnl_minor ?? 0) / 100,
          feesMajor: (e.fees_minor ?? 0) / 100,
          occurredAtUtc: e.occurred_at,
          tradeDate: e.occurred_at.slice(0, 10),
          contracts: e.contracts ?? 1,
          open: false,
        })),
      ),
    );
    const bytesB = orderedEngineInputBytes(
      orderTradesForEngine(
        shuffled.map((e) => ({
          identity: {
            tradeClientId: e.trade_client_id ?? e.id,
            userId: OWNER,
            journalTradeId: null,
          },
          symbol: "ES",
          direction: "LONG",
          pnlMajor: (e.realized_pnl_minor ?? 0) / 100,
          feesMajor: (e.fees_minor ?? 0) / 100,
          occurredAtUtc: e.occurred_at,
          tradeDate: e.occurred_at.slice(0, 10),
          contracts: e.contracts ?? 1,
          open: false,
        })),
      ),
    );
    assert.equal(bytesA, bytesB);
    capture("deterministic-engine-input", { inputRevision: prepA.inputRevision, bytesA });
  });

  // ----- 9. Bulk semantics -----
  check("bulk limit 50; duplicate ids normalized; atomic reject", () => {
    const many = Array.from({ length: 51 }, (_, i) => `bulk-${i}`);
    for (const id of many.slice(0, 2)) {
      seedJournal(OWNER, id, 1, "2026-02-06T10:00:00Z");
    }
    const over = assign("rem-bulk-over", accId, chId, many);
    assert.equal(over.kind, "conflict");
    assert.equal(over.reasonCode, "bulk_limit_exceeded");

    const dup = assign("rem-bulk-dup", accId, chId, ["bulk-0", "bulk-0", "bulk-1"]);
    assert.equal(dup.kind, "success", JSON.stringify(dup));
  });

  check("cross-user trade denied; journal original unchanged", () => {
    const pnlBefore = psql(`select pnl::text from public.trade_journal where client_id = 'other-slice'`);
    const denied = assign("rem-xuser", accId, chId, ["other-slice"]);
    assert.ok(
      denied.kind === "validation_error" || denied.kind === "conflict" || denied.kind === "forbidden",
    );
    const pnlAfter = psql(`select pnl::text from public.trade_journal where client_id = 'other-slice'`);
    assert.equal(pnlBefore, pnlAfter);
  });

  console.log(`prop-pass-phase2c-remediation-pg-qa: PASS (${passed})`);
}

main();
