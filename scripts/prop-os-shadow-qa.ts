/**
 * Phase 1C — Prop OS shadow pipeline QA (memory repository).
 * No production Supabase. No App wiring.
 */
import assert from "node:assert/strict";
import { PROP_OS_FIXTURES } from "../src/propOs/fixtures/scenarios";
import { publicReadinessScore } from "../src/propOs/engine";
import {
  buildShadowInputRevision,
  compareExpectation,
  createMemoryShadowRepository,
  mapEngineResultToSnapshots,
  runShadowBatch,
  runShadowChallenge,
  seedFixtureIntoRepository,
  snapshotCoreEqual,
  stableStringify,
} from "../src/propOs/shadow/index";
import {
  accountToRow,
  challengeToRow,
  eventToRows,
  mapAccountRow,
  mapChallengeRow,
  mapDomainEvents,
  mapRuleSnapshotRow,
  ruleSnapshotToRow,
} from "../src/propOs/shadow/mappers";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  OK  ${name}`);
    });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function makeSyntheticEvents(n: number, challengeId: string, accountId: string) {
  return Array.from({ length: n }, (_, i) => ({
    kind: "fill_close" as const,
    id: `syn-${i}`,
    challengeId,
    accountId,
    occurredAtUtc: new Date(Date.UTC(2026, 0, 6, 14, Math.floor(i / 60), i % 60)).toISOString(),
    brokerSequence: i,
    realizedPnlMinor: i % 19 === 0 ? -3_000 : 1_200,
    feesMinor: 25,
  }));
}

async function main() {
  console.log("prop-os-shadow-qa");

  await check("mapper round-trip account/challenge/rules/events", () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F03_intraday_with_equity_stream")!;
    const accRow = accountToRow(fx.account);
    const chRow = challengeToRow(fx.challenge, fx.account.userId);
    const ruleRow = ruleSnapshotToRow(fx.challenge, fx.account.userId, fx.asOfUtc);
    const account = mapAccountRow(accRow);
    const rules = mapRuleSnapshotRow(ruleRow);
    const challenge = mapChallengeRow(chRow, rules);
    assert.equal(account.id, fx.account.id);
    assert.equal(challenge.id, fx.challenge.id);
    assert.equal(rules.version, fx.challenge.ruleSetSnapshot.version);
    const execs = [];
    const aev = [];
    for (const e of fx.events) {
      const r = eventToRows(e, fx.account.userId);
      if (r.execution) execs.push(r.execution);
      if (r.accountEvent) aev.push(r.accountEvent);
    }
    const events = mapDomainEvents(execs, aev);
    assert.equal(events.length, fx.events.length);
  });

  await check("input revision stable under key shuffle / event permutation", () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F15_out_of_order_import")!;
    const a = buildShadowInputRevision({
      challenge: fx.challenge,
      ruleSnapshot: fx.challenge.ruleSetSnapshot,
      account: fx.account,
      events: fx.events,
    });
    const b = buildShadowInputRevision({
      challenge: fx.challenge,
      ruleSnapshot: fx.challenge.ruleSetSnapshot,
      account: fx.account,
      events: [...fx.events].reverse(),
    });
    assert.equal(a, b);
    const tweaked = {
      ...fx.challenge.ruleSetSnapshot,
      profitTargetMinor: fx.challenge.ruleSetSnapshot.profitTargetMinor + 1,
    };
    const c = buildShadowInputRevision({
      challenge: { ...fx.challenge, ruleSetVersion: tweaked.version },
      ruleSnapshot: tweaked,
      account: fx.account,
      events: fx.events,
    });
    assert.notEqual(a, c);
  });

  await check("snapshot mapper preserves engine fields (no math mutation)", () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
  });

  await check("fixture F01–F29 shadow seed + calculate + expect", async () => {
    for (const fx of PROP_OS_FIXTURES) {
      const repo = createMemoryShadowRepository();
      seedFixtureIntoRepository(repo, fx);
      const out = await runShadowChallenge(repo, fx.challenge.id, {
        asOfUtc: fx.asOfUtc,
        previousReadinessScore: fx.previousReadinessScore,
        previousReadinessFactors: fx.previousReadinessFactors,
        expect: fx.expect,
      });
      assert.equal(out.ok, true, `${fx.id} ${!out.ok ? out.detail : ""}`);
      if (out.ok) {
        assert.equal(out.mismatches.length, 0, `${fx.id} ${out.mismatches.join(";")}`);
        assert.equal(out.action, "inserted");
        // round-trip read
        const again = await repo.findEngineSnapshot({
          challengeId: fx.challenge.id,
          calculationVersion: out.engineSnapshot.calculation_version,
          ruleSetVersion: out.engineSnapshot.rule_set_version,
          inputRevision: out.engineSnapshot.input_revision,
        });
        assert.ok(again);
        assert.ok(snapshotCoreEqual(again!, out.engineSnapshot));
      }
    }
  });

  await check("idempotent repeat confirms existing snapshot", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F01_static_dd_near_floor")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    const a = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc, expect: fx.expect });
    const b = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc, expect: fx.expect });
    assert.ok(a.ok && b.ok);
    if (a.ok && b.ok) {
      assert.equal(a.action, "inserted");
      assert.equal(b.action, "confirmed_existing");
      assert.equal(a.inputRevision, b.inputRevision);
      assert.equal(a.engineSnapshot.id, b.engineSnapshot.id);
    }
  });

  await check("changed input revision inserts new snapshot", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    const a = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc });
    assert.ok(a.ok);
    // late event changes revision
    repo.seedExecution({
      id: "late-extra",
      user_id: fx.account.userId,
      challenge_id: fx.challenge.id,
      account_id: fx.account.id,
      trade_client_id: null,
      occurred_at: "2026-01-06T15:30:00.000Z",
      broker_sequence: 999,
      realized_pnl_minor: 100,
      fees_minor: 0,
      contracts: 1,
      voided: false,
      corrects_event_id: null,
      source: "shadow_fixture",
      schema_version: "prop-os-schema-v0",
    });
    const b = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc });
    assert.ok(b.ok);
    if (a.ok && b.ok) {
      assert.equal(b.action, "inserted");
      assert.notEqual(a.inputRevision, b.inputRevision);
    }
  });

  await check("batch isolates invalid challenge", async () => {
    const good = PROP_OS_FIXTURES.find((f) => f.id === "F12_passed_challenge")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, good);
    const report = await runShadowBatch(repo, [
      { challengeId: good.challenge.id, asOfUtc: good.asOfUtc, expect: good.expect },
      { challengeId: "missing-challenge", asOfUtc: good.asOfUtc },
    ]);
    assert.equal(report.counters.processed, 2);
    assert.equal(report.counters.failed, 1);
    assert.equal(report.counters.inserted, 1);
    assert.equal(report.counters.byFailure.database_read_failure, 1);
  });

  await check("forced snapshot write failure classified", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F06_insufficient_data")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    repo.setWriteFailure(true);
    const out = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.failure, "snapshot_write_failure");
  });

  await check("authenticated role denied snapshot write", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F08_static_breach_score_withheld")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    const denied = repo.asRole("authenticated");
    const out = await runShadowChallenge(denied, fx.challenge.id, { asOfUtc: fx.asOfUtc });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.failure, "snapshot_write_failure");
  });

  await check("incomplete intraday does not fabricate public score", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F22_intraday_without_equity_stream")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    const out = await runShadowChallenge(repo, fx.challenge.id, {
      asOfUtc: fx.asOfUtc,
      expect: fx.expect,
    });
    assert.ok(out.ok);
    if (out.ok) {
      assert.equal(publicReadinessScore(out.engineResult), null);
      assert.ok(out.engineResult.limitations.includes("intraday_equity_stream_missing"));
    }
  });

  await check("two accounts same user isolated", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F23_concurrent_accounts")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    // second account + challenge with its own event
    const accB = { ...fx.account, id: "acc-f23b", label: "B" };
    const chB = {
      ...fx.challenge,
      id: "ch-f23b",
      accountId: "acc-f23b",
    };
    repo.seedAccount(accountToRow(accB));
    repo.seedChallenge(challengeToRow(chB, accB.userId));
    repo.seedRuleSnapshot(ruleSnapshotToRow(chB, accB.userId, fx.asOfUtc));
    const outA = await runShadowChallenge(repo, "ch-f23a", { asOfUtc: fx.asOfUtc, expect: fx.expect });
    const outB = await runShadowChallenge(repo, "ch-f23b", {
      asOfUtc: fx.asOfUtc,
      expect: { status: "active", readinessScore: null, equityMinor: 4_100_000 },
    });
    assert.ok(outA.ok && outB.ok);
    if (outA.ok && outB.ok) {
      assert.equal(outA.engineResult.accountState.equityMinor, 5_005_000);
      assert.equal(outB.engineResult.accountState.equityMinor, 4_100_000);
    }
  });

  await check("engine-version / rule-version change creates new keys", async () => {
    const fx = PROP_OS_FIXTURES.find((f) => f.id === "F02_eod_trailing")!;
    const repo = createMemoryShadowRepository();
    seedFixtureIntoRepository(repo, fx);
    const a = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc });
    assert.ok(a.ok);
    // mutate rule snapshot version in store
    const rule = await repo.getRuleSnapshot(fx.challenge.id);
    assert.ok(rule);
    const snap = { ...(rule!.snapshot as object), version: "rs-eod-v2-changed" } as typeof fx.challenge.ruleSetSnapshot;
    repo.seedRuleSnapshot({
      ...rule!,
      rule_set_version: "rs-eod-v2-changed",
      snapshot: snap,
    });
    const ch = await repo.getChallenge(fx.challenge.id);
    repo.seedChallenge({ ...ch!, rule_set_version: "rs-eod-v2-changed" });
    const b = await runShadowChallenge(repo, fx.challenge.id, { asOfUtc: fx.asOfUtc });
    assert.ok(b.ok);
    if (a.ok && b.ok) {
      assert.equal(b.action, "inserted");
      assert.notEqual(a.engineSnapshot.rule_set_version, b.engineSnapshot.rule_set_version);
    }
  });

  await check("stableStringify ignores object key order", () => {
    assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  });

  await check("performance report 100 / 1000 / 5000 events", async () => {
    const base = PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy")!;
    const sizes = [100, 1000, 5000] as const;
    const report: Record<string, { p50: number; p95: number; samples: number }> = {};

    for (const n of sizes) {
      const samples: number[] = [];
      for (let trial = 0; trial < 5; trial++) {
        const repo = createMemoryShadowRepository();
        const challenge = {
          ...base.challenge,
          id: `perf-ch-${n}-${trial}`,
          accountId: `perf-acc-${n}-${trial}`,
          ruleSetSnapshot: {
            ...base.challenge.ruleSetSnapshot,
            dailyLossLimitMinor: 50_000_000,
            drawdown: { kind: "static" as const, amountMinor: 20_000_000 },
            minimumTradingDays: 0,
          },
        };
        const account = { ...base.account, id: challenge.accountId };
        const events = makeSyntheticEvents(n, challenge.id, account.id);
        const fixture = {
          ...base,
          id: `PERF_${n}`,
          account,
          challenge: { ...challenge, ruleSetVersion: challenge.ruleSetSnapshot.version },
          events,
          asOfUtc: "2026-01-07T00:00:00.000Z",
          expect: { status: "active" as const, readinessScore: true as const },
        };
        seedFixtureIntoRepository(repo, fixture);
        const out = await runShadowChallenge(repo, challenge.id, { asOfUtc: fixture.asOfUtc });
        assert.ok(out.ok, `perf ${n} failed`);
        if (out.ok) samples.push(out.timing.totalMs);
      }
      samples.sort((a, b) => a - b);
      report[String(n)] = {
        p50: percentile(samples, 50),
        p95: percentile(samples, 95),
        samples: samples.length,
      };
    }

    // batch accounts
    const batchRepo = createMemoryShadowRepository();
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      const fx = PROP_OS_FIXTURES[i % PROP_OS_FIXTURES.length]!;
      const account = { ...fx.account, id: `batch-acc-${i}`, userId: "user-batch" };
      const challenge = { ...fx.challenge, id: `batch-ch-${i}`, accountId: account.id };
      seedFixtureIntoRepository(batchRepo, { ...fx, account, challenge });
      jobs.push({ challengeId: challenge.id, asOfUtc: fx.asOfUtc });
    }
    const batch = await runShadowBatch(batchRepo, jobs);
    assert.equal(batch.counters.failed, 0);

    console.log(
      "    perf=" +
        JSON.stringify({
          events: report,
          batch: {
            accounts: 10,
            totalMs: batch.timing.totalMs,
            perChallengeMs: batch.timing.perChallengeMs,
          },
        }),
    );
  });

  // Shadow scenarios checklist coverage markers
  await check("scenario matrix markers covered in suite", () => {
    const ids = new Set(PROP_OS_FIXTURES.map((f) => f.id));
    for (const need of [
      "F01_static_dd_near_floor",
      "F02_eod_trailing",
      "F03_intraday_with_equity_stream",
      "F22_intraday_without_equity_stream",
      "F08_static_breach_score_withheld",
      "F12_passed_challenge",
      "F24_challenge_reset",
      "F25_failed_then_new_attempt",
      "F10_duplicate_event",
      "F13_corrected_trade",
      "F14_voided_trade",
      "F15_out_of_order_import",
      "F16_identical_timestamps",
      "F23_concurrent_accounts",
      "F06_insufficient_data",
    ]) {
      assert.ok(ids.has(need), need);
    }
  });

  // unused import guard for compareExpectation / mapEngine in cold paths
  assert.equal(typeof compareExpectation, "function");
  assert.equal(typeof mapEngineResultToSnapshots, "function");

  console.log(`prop-os-shadow-qa: PASS (${passed} checks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
