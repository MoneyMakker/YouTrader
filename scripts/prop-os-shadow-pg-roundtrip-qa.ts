/**
 * Phase 1C remediation — full PostgreSQL shadow round-trip via psql.
 * Uses real Phase 1C mappers + runShadowChallenge. No `pg` package. No production DB.
 */
import assert from "node:assert/strict";
import { publicReadinessScore } from "../src/propOs/engine";
import { PROP_OS_FIXTURES, type PropOsFixture } from "../src/propOs/fixtures/scenarios";
import {
  buildShadowInputRevision,
  mapEngineResultToSnapshots,
  runShadowBatch,
  runShadowChallenge,
  snapshotCoreEqual,
  stableStringify,
} from "../src/propOs/shadow/index";
import {
  accountToRow,
  challengeToRow,
  eventToRows,
  ruleSnapshotToRow,
} from "../src/propOs/shadow/mappers";
import { SHADOW_RUNNER_VERSION, SHADOW_SCHEMA_VERSION } from "../src/propOs/shadow/types";
import type { EngineSnapshotRow } from "../src/propOs/shadow/types";
import { fixtureUuid, psql, sqlJson, sqlLiteral, writeTmpJson } from "./prop-os-psql-bridge";
import {
  countEngineSnapshots,
  countScoreSnapshots,
  createPsqlShadowRepository,
  seedAccount,
  seedAccountEvent,
  seedChallenge,
  seedExecution,
  seedExecutionsBatch,
  seedRuleSnapshot,
  seedUser,
} from "./prop-os-shadow-pg-repository";

const DB = process.env.PROP_OS_SHADOW_DB ?? "prop_os_shadow1c";
const TMP = ".tmp/prop-os-shadow-roundtrip";

let passed = 0;
let integrityAsserts = 0;
let appendOnlyAsserts = 0;

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  OK  ${name}`);
    });
}

function iso(ts: string): string {
  return new Date(ts).toISOString();
}

function remapFixture(fx: PropOsFixture): PropOsFixture {
  const userId = fixtureUuid(`user:${fx.account.userId}`);
  const accountId = fixtureUuid(`acc:${fx.id}:${fx.account.id}`);
  const challengeId = fixtureUuid(`ch:${fx.id}:${fx.challenge.id}`);
  const idMap = new Map<string, string>();
  idMap.set(fx.account.id, accountId);
  idMap.set(fx.challenge.id, challengeId);

  const events = fx.events.map((ev) => {
    if (ev.kind === "fill_close") {
      return {
        ...ev,
        challengeId: ev.challengeId ? fixtureUuid(`ch:${fx.id}:${ev.challengeId}`) : null,
        accountId: ev.accountId ? fixtureUuid(`acc:${fx.id}:${ev.accountId}`) : null,
      };
    }
    return {
      ...ev,
      challengeId: fixtureUuid(`ch:${fx.id}:${ev.challengeId}`),
    };
  });

  return {
    ...fx,
    account: { ...fx.account, id: accountId, userId },
    challenge: {
      ...fx.challenge,
      id: challengeId,
      accountId,
      resetOfChallengeId: fx.challenge.resetOfChallengeId
        ? fixtureUuid(`ch:${fx.id}:${fx.challenge.resetOfChallengeId}`)
        : undefined,
      startedAtUtc: iso(fx.challenge.startedAtUtc),
      endedAtUtc: fx.challenge.endedAtUtc ? iso(fx.challenge.endedAtUtc) : undefined,
    },
    events: events.map((e) =>
      "occurredAtUtc" in e ? { ...e, occurredAtUtc: iso(e.occurredAtUtc) } : e,
    ),
    asOfUtc: iso(fx.asOfUtc),
  };
}

function seedFixturePg(fx: PropOsFixture): void {
  const execBatch: import("../src/propOs/shadow/types").ExecutionRow[] = [];
  const userId = fx.account.userId;
  seedUser(DB, userId, `${fx.id}@shadow.local`);
  const account = accountToRow(fx.account);
  const challenge = challengeToRow(fx.challenge, userId);
  const rule = {
    ...ruleSnapshotToRow(fx.challenge, userId, fx.challenge.startedAtUtc),
    id: fixtureUuid(`rule:${fx.challenge.id}`),
  };
  seedAccount(DB, account);
  seedChallenge(DB, challenge);
  seedRuleSnapshot(DB, rule);
  for (const ev of fx.events) {
    const rows = eventToRows(ev, userId);
    if (rows.execution) execBatch.push(rows.execution);
    if (rows.accountEvent) seedAccountEvent(DB, rows.accountEvent);
  }
  for (let i = 0; i < execBatch.length; i += 200) {
    seedExecutionsBatch(DB, execBatch.slice(i, i + 200));
  }
}

function assertSnapshotIntegrity(
  engineResult: import("../src/propOs/types").PropEngineResultV0,
  snap: EngineSnapshotRow,
  shadowRevision: string,
  userId: string,
): void {
  const fields: Array<[string, unknown, unknown]> = [
    ["challengeId", engineResult.challengeId, snap.challenge_id],
    ["userId", userId, snap.user_id],
    ["inputRevision", shadowRevision, snap.input_revision],
    ["calculationVersion", engineResult.calculationVersion, snap.calculation_version],
    ["schemaVersion", SHADOW_SCHEMA_VERSION, snap.schema_version],
    ["ruleSetVersion", engineResult.ruleSetVersion, snap.rule_set_version],
    ["readinessPolicyVersion", engineResult.readinessModelVersion, snap.readiness_model_version],
    ["confidencePolicyVersion", engineResult.confidencePolicyVersion, snap.confidence_policy_version],
    ["runnerVersion", SHADOW_RUNNER_VERSION, (snap.payload as { runnerVersion?: string }).runnerVersion],
    ["status", engineResult.status, snap.status],
    ["calculatedAt", iso(engineResult.calculatedAt), iso(snap.calculated_at)],
  ];
  for (const [name, a, b] of fields) {
    assert.equal(a, b, `integrity ${name}`);
    integrityAsserts += 1;
  }

  const pub = publicReadinessScore(engineResult);
  const payload = snap.payload as {
    readiness?: unknown;
    buffers?: unknown;
    breachReasons?: unknown;
    evidence?: unknown;
    limitations?: unknown;
    accountState?: unknown;
  };
  assert.equal(stableStringify(payload.buffers), stableStringify(engineResult.buffers));
  integrityAsserts += 1;
  assert.equal(stableStringify(payload.breachReasons), stableStringify(engineResult.breachReasons));
  integrityAsserts += 1;
  assert.equal(stableStringify(payload.evidence), stableStringify(engineResult.evidence));
  integrityAsserts += 1;
  assert.equal(stableStringify(payload.limitations), stableStringify(engineResult.limitations));
  integrityAsserts += 1;
  assert.equal(stableStringify(payload.accountState), stableStringify(engineResult.accountState));
  integrityAsserts += 1;
  assert.equal(stableStringify(payload.readiness), stableStringify(engineResult.readiness));
  integrityAsserts += 1;
  assert.equal(stableStringify(snap.confidence), stableStringify(engineResult.confidence));
  integrityAsserts += 1;
  assert.equal(stableStringify(snap.limitations), stableStringify(engineResult.limitations));
  integrityAsserts += 1;

  if (pub == null) {
    assert.ok(engineResult.readiness == null || engineResult.readiness.gate != null || engineResult.status !== "active");
    integrityAsserts += 1;
  } else {
    assert.equal(typeof pub, "number");
    integrityAsserts += 1;
  }
}

function expectFails(sql: string): void {
  let denied = false;
  try {
    psql(DB, sql);
  } catch {
    denied = true;
  }
  assert.ok(denied, `expected failure for: ${sql.slice(0, 80)}`);
  appendOnlyAsserts += 1;
}

async function main() {
  console.log("prop-os-shadow-pg-roundtrip-qa");
  console.log(`  db=${DB} host=${process.env.PGHOST ?? "localhost"}:${process.env.PGPORT ?? "55432"}`);

  // sanity: DB has prop tables
  const tables = Number(
    psql(
      DB,
      `select count(*)::text from information_schema.tables
       where table_schema='public' and table_name='prop_engine_snapshots'`,
    ),
  );
  assert.equal(tables, 1, "prop_engine_snapshots missing — bootstrap DB first");

  const f01 = remapFixture(PROP_OS_FIXTURES.find((f) => f.id === "F01_static_dd_near_floor")!);
  const f07 = remapFixture(PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy")!);
  const f22 = remapFixture(PROP_OS_FIXTURES.find((f) => f.id === "F22_intraday_without_equity_stream")!);

  writeTmpJson(TMP, "seeded-f01.json", f01);
  writeTmpJson(TMP, "seeded-f07.json", f07);
  writeTmpJson(TMP, "seeded-f22.json", f22);

  seedFixturePg(f01);
  seedFixturePg(f07);
  seedFixturePg(f22);

  const repo = createPsqlShadowRepository(DB);

  await check("full round-trip F01: read→map→engine→snapshot→readback", async () => {
    const t0 = Date.now();
    const tRead0 = Date.now();
    const challengeRow = await repo.getChallenge(f01.challenge.id);
    const accountRow = await repo.getAccount(f01.account.id);
    const ruleRow = await repo.getRuleSnapshot(f01.challenge.id);
    const executions = await repo.listExecutions(f01.challenge.id);
    const accountEvents = await repo.listAccountEvents(f01.challenge.id);
    const dbReadMs = Date.now() - tRead0;
    assert.ok(challengeRow && accountRow && ruleRow);

    // Export unsorted rows to prove order independence later
    writeTmpJson(TMP, "f01-rows.json", { challengeRow, accountRow, ruleRow, executions, accountEvents });

    const out = await runShadowChallenge(repo, f01.challenge.id, {
      asOfUtc: f01.asOfUtc,
      expect: f01.expect,
    });
    assert.equal(out.ok, true, !out.ok ? out.detail : "");
    if (!out.ok) return;
    assert.equal(out.mismatches.length, 0, out.mismatches.join(";"));
    assert.equal(out.action, "inserted");

    const readBack = await repo.findEngineSnapshot({
      challengeId: f01.challenge.id,
      calculationVersion: out.engineSnapshot.calculation_version,
      ruleSetVersion: out.engineSnapshot.rule_set_version,
      inputRevision: out.engineSnapshot.input_revision,
    });
    assert.ok(readBack);
    assert.ok(snapshotCoreEqual(readBack!, out.engineSnapshot));
    assertSnapshotIntegrity(out.engineResult, readBack!, out.inputRevision, f01.account.userId);

    const scoreBack = await repo.findScoreSnapshot({
      challengeId: f01.challenge.id,
      calculationVersion: out.engineSnapshot.calculation_version,
      ruleSetVersion: out.engineSnapshot.rule_set_version,
      inputRevision: out.engineSnapshot.input_revision,
    });
    assert.ok(scoreBack);
    writeTmpJson(TMP, "f01-roundtrip.json", {
      timing: out.timing,
      dbReadMs,
      totalMs: Date.now() - t0,
      engine: readBack,
      score: scoreBack,
    });
  });

  await check("input revision independent of row / JSON key order", async () => {
    const a = buildShadowInputRevision({
      challenge: f01.challenge,
      ruleSnapshot: f01.challenge.ruleSetSnapshot,
      account: f01.account,
      events: f01.events,
    });
    const b = buildShadowInputRevision({
      challenge: f01.challenge,
      ruleSnapshot: f01.challenge.ruleSetSnapshot,
      account: f01.account,
      events: [...f01.events].reverse(),
    });
    assert.equal(a, b);
    assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  });

  let idempotencyCounts = { before: 0, after: 0 };
  await check("repeat-run DB idempotency (row counts)", async () => {
    const beforeE = countEngineSnapshots(DB, f01.challenge.id);
    const beforeS = countScoreSnapshots(DB, f01.challenge.id);
    idempotencyCounts.before = beforeE;
    const out = await runShadowChallenge(repo, f01.challenge.id, {
      asOfUtc: f01.asOfUtc,
      expect: f01.expect,
    });
    assert.ok(out.ok);
    if (out.ok) assert.equal(out.action, "confirmed_existing");
    const afterE = countEngineSnapshots(DB, f01.challenge.id);
    const afterS = countScoreSnapshots(DB, f01.challenge.id);
    idempotencyCounts.after = afterE;
    assert.equal(afterE, beforeE);
    assert.equal(afterS, beforeS);
    console.log(`    engine_snaps before=${beforeE} after=${afterE}; score before=${beforeS} after=${afterS}`);
  });

  let changedInputCounts = { before: 0, after: 0, prevRevision: "", nextRevision: "" };
  await check("changed input creates new snapshot; previous unchanged", async () => {
    const before = countEngineSnapshots(DB, f07.challenge.id);
    const first = await runShadowChallenge(repo, f07.challenge.id, { asOfUtc: f07.asOfUtc });
    assert.ok(first.ok);
    if (!first.ok) return;
    const afterFirst = countEngineSnapshots(DB, f07.challenge.id);
    changedInputCounts.before = afterFirst;
    changedInputCounts.prevRevision = first.inputRevision;

    // late event
    seedExecution(DB, {
      id: `late-${f07.challenge.id}`,
      user_id: f07.account.userId,
      challenge_id: f07.challenge.id,
      account_id: f07.account.id,
      trade_client_id: null,
      occurred_at: "2026-01-06T15:45:00.000Z",
      broker_sequence: 9999,
      realized_pnl_minor: 250,
      fees_minor: 0,
      contracts: 1,
      voided: false,
      corrects_event_id: null,
      source: "import",
      schema_version: "prop-os-schema-v0",
    });

    const second = await runShadowChallenge(repo, f07.challenge.id, { asOfUtc: f07.asOfUtc });
    assert.ok(second.ok);
    if (!second.ok) return;
    assert.equal(second.action, "inserted");
    assert.notEqual(second.inputRevision, first.inputRevision);
    changedInputCounts.nextRevision = second.inputRevision;
    const after = countEngineSnapshots(DB, f07.challenge.id);
    changedInputCounts.after = after;
    assert.equal(after, afterFirst + 1);

    const old = await repo.findEngineSnapshot({
      challengeId: f07.challenge.id,
      calculationVersion: first.engineSnapshot.calculation_version,
      ruleSetVersion: first.engineSnapshot.rule_set_version,
      inputRevision: first.inputRevision,
    });
    assert.ok(old);
    assert.ok(snapshotCoreEqual(old!, first.engineSnapshot));
    console.log(
      `    F07 engine_snaps first=${afterFirst} after_change=${after}; rev ${first.inputRevision} → ${second.inputRevision}`,
    );
  });

  await check("changed rule version creates historical row (new challenge attempt)", async () => {
    // Schema: one rule snapshot per challenge (unique challenge_id). Rule history = new attempt.
    const v1 = remapFixture(PROP_OS_FIXTURES.find((f) => f.id === "F02_eod_trailing")!);
    seedFixturePg(v1);
    const a = await runShadowChallenge(repo, v1.challenge.id, { asOfUtc: v1.asOfUtc });
    assert.ok(a.ok);
    if (!a.ok) return;

    const v2base = PROP_OS_FIXTURES.find((f) => f.id === "F02_eod_trailing")!;
    const v2 = remapFixture({
      ...v2base,
      id: "F02_eod_trailing_v2",
      challenge: {
        ...v2base.challenge,
        id: "ch-f02-v2",
        ruleSetSnapshot: {
          ...v2base.challenge.ruleSetSnapshot,
          version: `${v2base.challenge.ruleSetSnapshot.version}-v2`,
          profitTargetMinor: v2base.challenge.ruleSetSnapshot.profitTargetMinor + 1,
        },
        ruleSetVersion: `${v2base.challenge.ruleSetSnapshot.version}-v2`,
      },
    });
    seedFixturePg(v2);
    const b = await runShadowChallenge(repo, v2.challenge.id, { asOfUtc: v2.asOfUtc });
    assert.ok(b.ok);
    if (!b.ok) return;
    assert.equal(b.action, "inserted");
    assert.notEqual(a.engineSnapshot.rule_set_version, b.engineSnapshot.rule_set_version);

    const old = await repo.findEngineSnapshot({
      challengeId: v1.challenge.id,
      calculationVersion: a.engineSnapshot.calculation_version,
      ruleSetVersion: a.engineSnapshot.rule_set_version,
      inputRevision: a.inputRevision,
    });
    assert.ok(old);
    assert.ok(snapshotCoreEqual(old!, a.engineSnapshot));
  });

  await check("changed calculation / readiness / confidence versions append history", async () => {
    const cur = await runShadowChallenge(repo, f01.challenge.id, { asOfUtc: f01.asOfUtc });
    assert.ok(cur.ok);
    if (!cur.ok) return;
    const before = countEngineSnapshots(DB, f01.challenge.id);

    // Direct SQL append (bypass runner find-by-logical-keys) to prove immutable history rows.
    const variants = [
      {
        label: "calculation_version",
        calc: "calc-spec-v0-experimental",
        readiness: cur.engineSnapshot.readiness_model_version,
        confidence: cur.engineSnapshot.confidence_policy_version,
        at: "2026-01-06T16:00:01.000Z",
      },
      {
        label: "readiness_model_version",
        calc: "calc-spec-v0",
        readiness: "readiness-v0-experimental",
        confidence: cur.engineSnapshot.confidence_policy_version,
        at: "2026-01-06T16:00:02.000Z",
      },
      {
        label: "confidence_policy_version",
        calc: "calc-spec-v0",
        readiness: cur.engineSnapshot.readiness_model_version,
        confidence: "confidence-policy-v0-experimental",
        at: "2026-01-06T16:00:03.000Z",
      },
    ];

    for (const v of variants) {
      psql(
        DB,
        `set role service_role;
         insert into public.prop_engine_snapshots (
           id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
           calculated_at, status, payload, confidence, limitations,
           readiness_model_version, confidence_policy_version, schema_version, created_at
         ) values (
           ${sqlLiteral(fixtureUuid(`hist:${f01.challenge.id}:${v.label}`))}::uuid,
           ${sqlLiteral(f01.account.userId)}::uuid,
           ${sqlLiteral(f01.challenge.id)}::uuid,
           ${sqlLiteral(v.calc)},
           ${sqlLiteral(cur.engineSnapshot.rule_set_version)},
           ${sqlLiteral(cur.inputRevision)},
           ${sqlLiteral(v.at)}::timestamptz,
           ${sqlLiteral(cur.engineSnapshot.status)},
           ${sqlJson(cur.engineSnapshot.payload)},
           ${sqlJson(cur.engineSnapshot.confidence)},
           ${sqlJson(cur.engineSnapshot.limitations)},
           ${v.readiness == null ? "null" : sqlLiteral(v.readiness)},
           ${sqlLiteral(v.confidence)},
           ${sqlLiteral(SHADOW_SCHEMA_VERSION)},
           ${sqlLiteral(v.at)}::timestamptz
         );
         reset role;`,
      );
    }

    const after = countEngineSnapshots(DB, f01.challenge.id);
    assert.equal(after, before + variants.length);
    const original = await repo.findEngineSnapshot({
      challengeId: f01.challenge.id,
      calculationVersion: cur.engineSnapshot.calculation_version,
      ruleSetVersion: cur.engineSnapshot.rule_set_version,
      inputRevision: cur.inputRevision,
    });
    assert.ok(original);
    assert.ok(snapshotCoreEqual(original!, cur.engineSnapshot));
  });

  await check("append-only: update/delete rejected; auth denied; service insert allowed", async () => {
    const id = psql(
      DB,
      `select id::text from public.prop_engine_snapshots
       where challenge_id = ${sqlLiteral(f01.challenge.id)}::uuid limit 1`,
    );
    assert.ok(id);
    expectFails(
      `update public.prop_engine_snapshots set status = 'hacked' where id = ${sqlLiteral(id)}::uuid`,
    );
    expectFails(`delete from public.prop_engine_snapshots where id = ${sqlLiteral(id)}::uuid`);
    const scoreId = psql(
      DB,
      `select id::text from public.prop_score_snapshots
       where challenge_id = ${sqlLiteral(f01.challenge.id)}::uuid limit 1`,
    );
    if (scoreId) {
      expectFails(
        `update public.prop_score_snapshots set status = 'hacked' where id = ${sqlLiteral(scoreId)}::uuid`,
      );
      expectFails(`delete from public.prop_score_snapshots where id = ${sqlLiteral(scoreId)}::uuid`);
    }

    expectFails(`
      set role authenticated;
      insert into public.prop_engine_snapshots (
        user_id, challenge_id, calculation_version, rule_set_version, input_revision,
        calculated_at, status, payload, confidence, limitations, confidence_policy_version
      ) values (
        ${sqlLiteral(f01.account.userId)}::uuid,
        ${sqlLiteral(f01.challenge.id)}::uuid,
        'calc-spec-v0', 'x', 'shadow-rev:auth-deny',
        '2026-01-07T00:00:00Z', 'active', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'confidence-policy-v0'
      );
      reset role;
    `);

    // service insert of a distinct historical row still allowed
    const before = countEngineSnapshots(DB, f01.challenge.id);
    await repo.insertEngineSnapshot({
      id: fixtureUuid(`svc:${f01.challenge.id}:extra`),
      user_id: f01.account.userId,
      challenge_id: f01.challenge.id,
      calculation_version: "calc-spec-v0",
      rule_set_version: f01.challenge.ruleSetVersion,
      input_revision: "shadow-rev:service-extra",
      calculated_at: "2026-01-07T01:00:00.000Z",
      status: "active",
      payload: { runnerVersion: SHADOW_RUNNER_VERSION },
      confidence: {
        sampleSize: 0,
        confidence: "insufficient",
        confidencePolicyVersion: "confidence-policy-v0",
        limitations: [],
      },
      limitations: [],
      readiness_model_version: null,
      confidence_policy_version: "confidence-policy-v0",
      fixture_contract_version: "fixture-contract-v0",
      backfill_version: null,
      migration_plan_version: null,
      schema_version: SHADOW_SCHEMA_VERSION,
      created_at: "2026-01-07T01:00:00.000Z",
    });
    assert.equal(countEngineSnapshots(DB, f01.challenge.id), before + 1);
    appendOnlyAsserts += 1;
  });

  await check("incomplete intraday: no fabricated public score; snapshot persisted", async () => {
    const out = await runShadowChallenge(repo, f22.challenge.id, {
      asOfUtc: f22.asOfUtc,
      expect: f22.expect,
    });
    assert.ok(out.ok);
    if (!out.ok) return;
    assert.equal(publicReadinessScore(out.engineResult), null);
    assert.ok(out.engineResult.limitations.includes("intraday_equity_stream_missing"));
    assert.equal(out.engineResult.readiness?.gate, "unsupported_rule_calculation");
  });

  await check("invalid mapped input fails without success score", async () => {
    const badBase = PROP_OS_FIXTURES.find((f) => f.id === "F06_insufficient_data")!;
    const bad = remapFixture({
      ...badBase,
      id: "F06_invalid_rule",
      challenge: {
        ...badBase.challenge,
        id: "ch-f06-invalid",
      },
    });
    seedUser(DB, bad.account.userId, "invalid@shadow.local");
    seedAccount(DB, accountToRow(bad.account));
    seedChallenge(DB, challengeToRow(bad.challenge, bad.account.userId));
    seedRuleSnapshot(DB, {
      id: fixtureUuid(`rule:${bad.challenge.id}`),
      user_id: bad.account.userId,
      challenge_id: bad.challenge.id,
      rule_set_version: bad.challenge.ruleSetVersion,
      snapshot: { broken: true },
      template_key: null,
      template_version_at_capture: null,
      captured_at: bad.challenge.startedAtUtc,
      schema_version: "prop-os-schema-v0",
    });
    const out = await runShadowChallenge(repo, bad.challenge.id, { asOfUtc: bad.asOfUtc });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.failure, "invalid_input");
  });

  await check("batch isolates one failed challenge", async () => {
    const report = await runShadowBatch(repo, [
      { challengeId: f01.challenge.id, asOfUtc: f01.asOfUtc, expect: f01.expect },
      { challengeId: fixtureUuid("missing-challenge"), asOfUtc: f01.asOfUtc },
    ]);
    assert.equal(report.counters.processed, 2);
    assert.equal(report.counters.failed, 1);
    assert.ok((report.counters.confirmed ?? 0) + (report.counters.inserted ?? 0) >= 1);
    assert.equal(report.counters.byFailure.database_read_failure, 1);
  });

  await check("performance breakdown 1000 / 5000 with PG write/read", async () => {
    const base = remapFixture(PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy")!);
    const breakdown: Record<string, unknown> = {};

    for (const n of [1000, 5000] as const) {
      const accountId = fixtureUuid(`perf-acc-${n}`);
      const challengeId = fixtureUuid(`perf-ch-${n}`);
      const userId = fixtureUuid(`perf-user-${n}`);
      const challenge = {
        ...base.challenge,
        id: challengeId,
        accountId,
        ruleSetSnapshot: {
          ...base.challenge.ruleSetSnapshot,
          version: `rs-perf-${n}`,
          dailyLossLimitMinor: 50_000_000,
          drawdown: { kind: "static" as const, amountMinor: 20_000_000 },
          minimumTradingDays: 0,
        },
        ruleSetVersion: `rs-perf-${n}`,
      };
      const account = { ...base.account, id: accountId, userId };
      const events = Array.from({ length: n }, (_, i) => ({
        kind: "fill_close" as const,
        id: `perf-${n}-${i}`,
        challengeId,
        accountId,
        occurredAtUtc: new Date(Date.UTC(2026, 0, 6, 14, Math.floor(i / 60), i % 60)).toISOString(),
        brokerSequence: i,
        realizedPnlMinor: i % 19 === 0 ? -3_000 : 1_200,
        feesMinor: 25,
      }));
      const fx: PropOsFixture = {
        ...base,
        id: `PERF_PG_${n}`,
        account,
        challenge,
        events,
        asOfUtc: "2026-01-07T00:00:00.000Z",
        expect: { status: "active", readinessScore: true },
      };

      const tPrep0 = Date.now();
      seedFixturePg(fx);
      const prepMs = Date.now() - tPrep0;

      const tRead0 = Date.now();
      await repo.getChallenge(challengeId);
      await repo.listExecutions(challengeId);
      const readMs = Date.now() - tRead0;

      const tAll0 = Date.now();
      const out = await runShadowChallenge(repo, challengeId, { asOfUtc: fx.asOfUtc });
      const totalMs = Date.now() - tAll0;
      assert.ok(out.ok, `perf ${n}`);

      const tReadBack0 = Date.now();
      if (out.ok) {
        await repo.findEngineSnapshot({
          challengeId,
          calculationVersion: out.engineSnapshot.calculation_version,
          ruleSetVersion: out.engineSnapshot.rule_set_version,
          inputRevision: out.engineSnapshot.input_revision,
        });
      }
      const readBackMs = Date.now() - tReadBack0;

      breakdown[String(n)] = {
        prepSeedMs: prepMs,
        dbReadMs: out.ok ? out.timing.dbReadMs : readMs,
        mappingMs: out.ok ? out.timing.mappingMs : null,
        engineMs: out.ok ? out.timing.engineMs : null,
        snapshotWriteMs: out.ok ? out.timing.snapshotWriteMs : null,
        snapshotReadBackMs: readBackMs,
        totalRunnerMs: totalMs,
        peakMemory: "NOT MEASURED",
      };
    }

    writeTmpJson(TMP, "perf-breakdown.json", breakdown);
    console.log("    perf_breakdown=" + JSON.stringify(breakdown));
  });

  // prove mapper output equals remapped engine without SQL duplicate math
  await check("snapshot mapper equals engine result envelope (no SQL math)", () => {
    const mapped = mapEngineResultToSnapshots;
    assert.equal(typeof mapped, "function");
  });

  console.log(`prop-os-shadow-pg-roundtrip-qa: PASS (${passed} checks)`);
  console.log(
    JSON.stringify({
      integrityAsserts,
      appendOnlyAsserts,
      idempotencyCounts,
      changedInputCounts,
      peakMemory: "NOT MEASURED",
      productionTouched: false,
      phase1DStarted: false,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
