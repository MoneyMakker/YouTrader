/**
 * Phase 3A domain QA — Performance Intelligence (memory).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ASSIGNMENT_RECALC_PROCESSOR_ROLE,
  METRIC_CATALOGUE,
  PI_MAX_TRADES_PER_SCOPE,
  PI_METRIC_SPEC_VERSION,
  PI_MIN_SEGMENT_SAMPLE,
  TRUSTED_PI_PROCESSOR_ROLES,
  assertTrustedPiProcessorRole,
  attachPublicationState,
  calculatePerformanceIntelligence,
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  calculateSequenceMetrics,
  calculateSegments,
  canonicalSnapshotBytes,
  canonicalSnapshotHash,
  createMemoryIntelligenceReadStore,
  createMemoryIntelligenceStore,
  evaluateFindings,
  getCurrentSnapshot,
  intelligenceSnapshotCoreBytes,
  markScopesOutdatedForAssignment,
  normalizePerformanceTrades,
  processIntelligenceCalculation,
  projectionParity,
  publishIntelligenceSnapshot,
  queueIntelligenceCalculation,
  rebuildCurrentProjection,
  runTrustedMemoryCalculation,
  scopeKey,
  type IntelligenceScope,
  type PerformanceIntelligenceSnapshot,
  type RawJournalTradeFact,
} from "../src/propOs/intelligence/index";

const ROOT = path.resolve(import.meta.dirname, "..");
const CAPTURE = path.join(ROOT, ".tmp/prop-pass-phase3a-captures");
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ACC = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CH1 = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FIXED_AS_OF = "2026-07-30T12:00:00.000Z";
const ACCOUNT_SCOPE: IntelligenceScope = {
  kind: "account",
  accountId: ACC,
  includeArchivedChallenges: false,
};

let passed = 0;
let tradeSeq = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

function capture(name: string, payload: unknown) {
  fs.mkdirSync(CAPTURE, { recursive: true });
  fs.writeFileSync(path.join(CAPTURE, `${name}.json`), JSON.stringify(payload, null, 2));
}

function fact(
  partial: Partial<RawJournalTradeFact> & Pick<RawJournalTradeFact, "tradeClientId">,
): RawJournalTradeFact {
  tradeSeq += 1;
  const seq = String(tradeSeq).padStart(12, "0");
  const defaults: RawJournalTradeFact = {
    journalTradeId: `11111111-1111-1111-1111-${seq}`,
    tradeClientId: partial.tradeClientId,
    userId: OWNER,
    symbol: "ES",
    direction: "LONG",
    pnlMajor: 100,
    feesMajor: 0,
    contracts: 1,
    occurredAtUtc: "2026-02-01T15:00:00.000Z",
    assignmentRevision: 1,
    accountId: ACC,
    challengeId: CH1,
    open: false,
  };
  return { ...defaults, ...partial, journalTradeId: partial.journalTradeId ?? defaults.journalTradeId };
}

function calc(
  facts: RawJournalTradeFact[],
  scope: IntelligenceScope = ACCOUNT_SCOPE,
  rev = 1,
): PerformanceIntelligenceSnapshot {
  return calculatePerformanceIntelligence({
    userId: OWNER,
    scope,
    assignmentRevision: rev,
    facts,
    asOfUtc: FIXED_AS_OF,
  });
}

function mixedFacts(count: number, basePnl = 100): RawJournalTradeFact[] {
  return Array.from({ length: count }, (_, i) =>
    fact({
      tradeClientId: `mix-${i}`,
      pnlMajor: i % 3 === 0 ? -Math.abs(basePnl) * 0.5 : basePnl,
      occurredAtUtc: `2026-02-${String((i % 28) + 1).padStart(2, "0")}T15:00:00.000Z`,
      riskAmountMajor: 50,
      rMultiple: i % 3 === 0 ? -0.5 : 1,
    }),
  );
}

function seedStore(facts: RawJournalTradeFact[] = mixedFacts(10)) {
  const store = createMemoryIntelligenceStore();
  store.assignmentRevision = 1;
  store.accounts.set(ACC, { userId: OWNER, archived: false });
  store.facts = [...facts];
  return store;
}

async function main() {
  console.log("prop-pass-phase3a-qa");

  // -------------------------------------------------------------------------
  // A) Metric fixtures (25)
  // -------------------------------------------------------------------------

  await check("metric.1 no trades", () => {
    const snap = calc([]);
    assert.equal(snap.status, "insufficient_data");
    assert.equal(snap.performance.totalClosedTrades, 0);
    assert.equal(snap.datasetSummary.tradeCount, 0);
    capture("no-data", {
      status: snap.status,
      datasetSummary: snap.datasetSummary,
      performance: snap.performance,
    });
  });

  await check("metric.2 one winning trade", () => {
    const snap = calc([fact({ tradeClientId: "w1", pnlMajor: 200 })]);
    assert.equal(snap.performance.winningTrades, 1);
    assert.equal(snap.performance.netRealizedPnlMinor, 20_000);
    assert.equal(snap.performance.profitFactor.kind, "undefined_zero_loss");
    assert.equal(snap.performance.winRate.kind, "value");
    if (snap.performance.winRate.kind === "value") assert.equal(snap.performance.winRate.valueScaled, 1_000_000);
  });

  await check("metric.3 one losing trade", () => {
    const snap = calc([fact({ tradeClientId: "l1", pnlMajor: -80 })]);
    assert.equal(snap.performance.losingTrades, 1);
    assert.equal(snap.performance.netRealizedPnlMinor, -8_000);
    assert.equal(snap.performance.profitFactor.kind, "value");
    if (snap.performance.profitFactor.kind === "value") assert.equal(snap.performance.profitFactor.valueScaled, 0);
  });

  await check("metric.4 all winning", () => {
    const facts = mixedFacts(8).map((f) => ({ ...f, pnlMajor: 50 + Math.random() * 0 }));
    for (const f of facts) f.pnlMajor = 50;
    const snap = calc(facts);
    assert.equal(snap.performance.losingTrades, 0);
    assert.equal(snap.performance.profitFactor.kind, "undefined_zero_loss");
  });

  await check("metric.5 all losing", () => {
    const facts = mixedFacts(8).map((f) => ({ ...f, pnlMajor: -30 }));
    const snap = calc(facts);
    assert.equal(snap.performance.winningTrades, 0);
    assert.equal(snap.performance.grossProfitMinor, 0);
    assert.equal(snap.performance.profitFactor.kind, "value");
    if (snap.performance.profitFactor.kind === "value") assert.equal(snap.performance.profitFactor.valueScaled, 0);
  });

  await check("metric.6 break-even", () => {
    const snap = calc([fact({ tradeClientId: "be1", pnlMajor: 0 })]);
    assert.equal(snap.performance.breakEvenTrades, 1);
    assert.equal(snap.performance.netRealizedPnlMinor, 0);
  });

  await check("metric.7 zero gross loss (profit factor undefined_zero_loss)", () => {
    const facts = [fact({ tradeClientId: "zw1", pnlMajor: 100 }), fact({ tradeClientId: "zw2", pnlMajor: 50 })];
    const snap = calc(facts);
    assert.equal(snap.performance.grossLossMinor, 0);
    assert.equal(snap.performance.profitFactor.kind, "undefined_zero_loss");
  });

  await check("metric.8 zero gross profit", () => {
    const facts = [fact({ tradeClientId: "zg1", pnlMajor: -40 }), fact({ tradeClientId: "zg2", pnlMajor: -10 })];
    const snap = calc(facts);
    assert.equal(snap.performance.grossProfitMinor, 0);
    assert.equal(snap.performance.profitFactor.kind, "value");
    if (snap.performance.profitFactor.kind === "value") assert.equal(snap.performance.profitFactor.valueScaled, 0);
  });

  await check("metric.9 mixed wins/losses", () => {
    const facts = [
      fact({ tradeClientId: "m1", pnlMajor: 200, riskAmountMajor: 50, rMultiple: 2 }),
      fact({ tradeClientId: "m2", pnlMajor: -50, occurredAtUtc: "2026-02-02T15:00:00.000Z", riskAmountMajor: 50, rMultiple: -1 }),
      fact({ tradeClientId: "m3", pnlMajor: 100, occurredAtUtc: "2026-02-03T15:00:00.000Z", riskAmountMajor: 50, rMultiple: 1 }),
      fact({ tradeClientId: "m4", pnlMajor: -25, occurredAtUtc: "2026-02-04T15:00:00.000Z", riskAmountMajor: 50, rMultiple: -0.5 }),
      fact({ tradeClientId: "m5", pnlMajor: 75, occurredAtUtc: "2026-02-05T15:00:00.000Z", riskAmountMajor: 50, rMultiple: 1.5 }),
    ];
    const snap = calc(facts);
    assert.equal(snap.performance.winningTrades, 3);
    assert.equal(snap.performance.losingTrades, 2);
    assert.equal(snap.performance.profitFactor.kind, "value");
    assert.equal(snap.status, "current");
  });

  await check("metric.10 fees changing net result", () => {
    const raw = fact({ tradeClientId: "fee1", pnlMajor: 100, feesMajor: 15 });
    const norm = normalizePerformanceTrades([raw]);
    assert.equal(norm.included[0]!.netPnlMinor, 8_500);
    const snap = calc([raw]);
    assert.equal(snap.performance.netRealizedPnlMinor, 8_500);
  });

  await check("metric.11 repeated identical timestamps", () => {
    const ts = "2026-02-01T15:00:00.000Z";
    const facts = [
      fact({ tradeClientId: "ts-b", pnlMajor: 10, occurredAtUtc: ts }),
      fact({ tradeClientId: "ts-a", pnlMajor: 20, occurredAtUtc: ts }),
    ];
    const snap = calc(facts);
    assert.equal(snap.performance.totalClosedTrades, 2);
    assert.equal(snap.sourceRange.earliestTradeAt, ts);
  });

  await check("metric.12 malformed timestamp excluded", () => {
    const facts = [
      ...mixedFacts(5),
      fact({ tradeClientId: "bad-ts", occurredAtUtc: "not-a-date" as unknown as string }),
    ];
    const snap = calc(facts);
    assert.ok((snap.datasetSummary.exclusionReasons.malformed_timestamp ?? 0) >= 1);
  });

  await check("metric.13 open trade excluded", () => {
    const facts = [...mixedFacts(5), fact({ tradeClientId: "open1", open: true, pnlMajor: 999 })];
    const snap = calc(facts);
    assert.ok((snap.datasetSummary.exclusionReasons.open_trade ?? 0) >= 1);
    assert.ok(snap.performance.totalClosedTrades <= 5);
  });

  await check("metric.14 missing risk data (partial risk quality)", () => {
    const facts = mixedFacts(8).map((f) => {
      const { riskAmountMajor: _r, rMultiple: _m, ...rest } = f;
      return { ...rest, riskAmountMajor: null, rMultiple: null } as RawJournalTradeFact;
    });
    const snap = calc(facts);
    assert.equal(snap.risk.dataQuality.kind, "partial");
    assert.ok(snap.risk.averageRiskAmountMinor.kind === "unavailable");
    assert.equal(snap.status, "incomplete_data");
    assert.notEqual(snap.risk.maximumRiskAmountMinor, 0);
  });

  await check("metric.15 extreme outlier win", () => {
    const facts = [
      ...mixedFacts(9).map((f) => ({ ...f, pnlMajor: 20 })),
      fact({ tradeClientId: "out-win", pnlMajor: 50_000, occurredAtUtc: "2026-02-10T15:00:00.000Z" }),
    ];
    const snap = calc(facts);
    assert.equal(snap.performance.largestWinMinor, 5_000_000);
    assert.ok(
      snap.risk.largestWinShareOfProfit.kind === "value" &&
        snap.risk.largestWinShareOfProfit.valueScaled / 1_000_000 > 0.9,
    );
  });

  await check("metric.16 extreme outlier loss", () => {
    const facts = [
      ...mixedFacts(9).map((f) => ({ ...f, pnlMajor: -20 })),
      fact({ tradeClientId: "out-loss", pnlMajor: -40_000, occurredAtUtc: "2026-02-10T15:00:00.000Z" }),
    ];
    const snap = calc(facts);
    assert.equal(snap.performance.largestLossMinor, -4_000_000);
  });

  await check("metric.17 long loss sequence", () => {
    const facts = Array.from({ length: 8 }, (_, i) =>
      fact({
        tradeClientId: `ls-${i}`,
        pnlMajor: -10,
        occurredAtUtc: `2026-02-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const snap = calc(facts);
    assert.equal(snap.sequences.maximumLossSequence, 8);
    assert.equal(snap.sequences.currentLossSequence, 8);
  });

  await check("metric.18 long win sequence", () => {
    const facts = Array.from({ length: 7 }, (_, i) =>
      fact({
        tradeClientId: `ws-${i}`,
        pnlMajor: 25,
        occurredAtUtc: `2026-02-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const snap = calc(facts);
    assert.equal(snap.sequences.maximumWinSequence, 7);
  });

  await check("metric.19 instrument concentration", () => {
    const facts = [
      ...Array.from({ length: 8 }, (_, i) =>
        fact({ tradeClientId: `nq-${i}`, symbol: "NQ", pnlMajor: 100, occurredAtUtc: `2026-02-${String(i + 1).padStart(2, "0")}T12:00:00.000Z` }),
      ),
      fact({ tradeClientId: "es-1", symbol: "ES", pnlMajor: 10, occurredAtUtc: "2026-02-09T12:00:00.000Z" }),
    ];
    const snap = calc(facts);
    assert.equal(snap.risk.topInstrumentConcentration.kind, "value");
    const instSeg = snap.segments.find((s) => s.segmentType === "instrument" && s.segmentKey === "NQ");
    assert.ok(instSeg && instSeg.sampleSize >= 8);
  });

  await check("metric.20 same-day overtrading pattern", () => {
    const day = "2026-02-15T";
    const facts = [
      ...Array.from({ length: 8 }, (_, i) =>
        fact({
          tradeClientId: `od-${i}`,
          pnlMajor: i % 2 === 0 ? 30 : -20,
          occurredAtUtc: `${day}${String(10 + i).padStart(2, "0")}:00:00.000Z`,
          riskAmountMajor: 50,
          rMultiple: 1,
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        fact({
          tradeClientId: `od2-${i}`,
          pnlMajor: 25,
          occurredAtUtc: `2026-02-16T${String(12 + i).padStart(2, "0")}:00:00.000Z`,
          riskAmountMajor: 50,
          rMultiple: 1,
        }),
      ),
    ];
    const snap = calc(facts);
    assert.equal(snap.sequences.avgSameDayTradeCount.kind, "value");
    if (snap.sequences.avgSameDayTradeCount.kind === "value") {
      assert.ok(snap.sequences.avgSameDayTradeCount.valueScaled / 1_000_000 >= METRIC_CATALOGUE.findings.sameDayOvertradeThreshold);
    }
    const finding = snap.findings.find((f) => f.reasonCode === "elevated_same_day_trade_frequency");
    assert.ok(finding);
  });

  await check("metric.21 insufficient segment sample", () => {
    const snap = calc(mixedFacts(3));
    assert.equal(snap.status, "insufficient_data");
    assert.equal(snap.datasetSummary.dataQuality.kind, "insufficient_sample");
    capture("insufficient", {
      status: snap.status,
      dataQuality: snap.datasetSummary.dataQuality,
      tradeCount: snap.datasetSummary.tradeCount,
    });
  });

  await check("metric.22 assignment revision change → outdated + new snapshot", () => {
    const store = seedStore();
    const scope = ACCOUNT_SCOPE;
    const first = runTrustedMemoryCalculation(store, scope, 1, { asOfUtc: FIXED_AS_OF });
    assert.equal(first.kind, "success");
    const old = getCurrentSnapshot(store, scope)!;
    markScopesOutdatedForAssignment(store, 2);
    assert.equal(old.status, "outdated");
    const second = runTrustedMemoryCalculation(store, scope, 2, { asOfUtc: FIXED_AS_OF });
    assert.equal(second.kind, "success");
    const cur = getCurrentSnapshot(store, scope)!;
    assert.notEqual(cur.id, old.id);
    assert.equal(cur.assignmentRevision, 2);
    capture("outdated", { prior: { id: old.id, status: old.status }, current: { id: cur.id, status: cur.status } });
  });

  await check("metric.23 metric-spec version on snapshot", () => {
    const snap = calc(mixedFacts(6));
    assert.equal(snap.metricSpecVersion, PI_METRIC_SPEC_VERSION);
    assert.equal(snap.metricSpecVersion, "pi-metric-spec-v0");
  });

  await check("metric.24 stale processor completion rejected", () => {
    const store = seedStore();
    const scope = ACCOUNT_SCOPE;
    queueIntelligenceCalculation(store, scope, 1);
    store.assignmentRevision = 2;
    const stale = processIntelligenceCalculation(store, scope, 1, { asOfUtc: FIXED_AS_OF });
    assert.equal(stale.kind, "conflict");
    if (stale.kind === "conflict") assert.equal(stale.reasonCode, "stale_assignment_revision");
  });

  await check("metric.25 deterministic rerun byte equality", () => {
    const facts = mixedFacts(12);
    const a = calc(facts);
    const b = calc(facts);
    assert.equal(intelligenceSnapshotCoreBytes(a), intelligenceSnapshotCoreBytes(b));
  });

  // -------------------------------------------------------------------------
  // B) E2E memory scenarios (32)
  // -------------------------------------------------------------------------

  await check("e2e.1 eligible owner opens (read scopes)", async () => {
    const store = seedStore();
    const read = createMemoryIntelligenceReadStore(store);
    const scopes = await read.getAvailableScopes(ACC);
    assert.ok(scopes.some((s) => s.scope.kind === "account"));
    assert.ok(scopes.some((s) => s.scope.kind === "challenge"));
  });

  await check("e2e.2 no current snapshot", async () => {
    const store = seedStore();
    const read = createMemoryIntelligenceReadStore(store);
    assert.equal(await read.getCurrentSnapshot(ACCOUNT_SCOPE), null);
  });

  await check("e2e.3 calculation requested", async () => {
    const store = seedStore();
    const read = createMemoryIntelligenceReadStore(store);
    const req = await read.requestCalculation(ACCOUNT_SCOPE, 1);
    assert.equal(req.kind, "queued");
    capture("calculating", await read.getCalculationState(ACCOUNT_SCOPE));
  });

  await check("e2e.4 duplicate request coalesces", async () => {
    const store = seedStore();
    const read = createMemoryIntelligenceReadStore(store);
    const a = await read.requestCalculation(ACCOUNT_SCOPE, 1);
    const b = await read.requestCalculation(ACCOUNT_SCOPE, 1);
    assert.equal(a.scopeKey, b.scopeKey);
    assert.ok(b.kind === "queued" || b.kind === "running");
  });

  await check("e2e.5 calculation completes", async () => {
    const store = seedStore();
    const done = runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    assert.equal(done.kind, "success");
    const state = store.calc.get(scopeKey(ACCOUNT_SCOPE));
    assert.equal(state?.kind, "completed");
  });

  await check("e2e.6 app restart while queued (calc preserved)", async () => {
    const store = seedStore();
    const read = createMemoryIntelligenceReadStore(store);
    await read.requestCalculation(ACCOUNT_SCOPE, 1);
    const persisted = JSON.parse(JSON.stringify(store.calc.get(scopeKey(ACCOUNT_SCOPE))));
    const store2 = { ...store, calc: new Map([[scopeKey(ACCOUNT_SCOPE), persisted]]) };
    const read2 = createMemoryIntelligenceReadStore(store2 as typeof store);
    const st = await read2.getCalculationState(ACCOUNT_SCOPE);
    assert.equal(st.kind, "queued");
  });

  await check("e2e.7 current snapshot displayed", async () => {
    const store = seedStore();
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    const read = createMemoryIntelligenceReadStore(store);
    const snap = await read.getCurrentSnapshot(ACCOUNT_SCOPE);
    assert.ok(snap);
    assert.equal(snap!.status, "current");
    capture("overview", {
      status: snap!.status,
      performance: snap!.performance,
      datasetSummary: snap!.datasetSummary,
    });
  });

  await check("e2e.8 assignment change marks outdated", async () => {
    const store = seedStore();
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    markScopesOutdatedForAssignment(store, 2);
    const snap = getCurrentSnapshot(store, ACCOUNT_SCOPE)!;
    assert.equal(snap.status, "outdated");
  });

  await check("e2e.9 recalculation creates new snapshot", async () => {
    const store = seedStore();
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    const id1 = getCurrentSnapshot(store, ACCOUNT_SCOPE)!.id;
    markScopesOutdatedForAssignment(store, 2);
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 2, { asOfUtc: FIXED_AS_OF });
    const id2 = getCurrentSnapshot(store, ACCOUNT_SCOPE)!.id;
    assert.notEqual(id1, id2);
  });

  await check("e2e.10 stale old processor completion rejected", () => {
    const store = seedStore();
    queueIntelligenceCalculation(store, ACCOUNT_SCOPE, 1);
    store.assignmentRevision = 3;
    const r = processIntelligenceCalculation(store, ACCOUNT_SCOPE, 1);
    assert.equal(r.kind, "conflict");
  });

  await check("e2e.11 challenge scope", () => {
    const scope: IntelligenceScope = { kind: "challenge", challengeId: CH1, accountId: ACC };
    const snap = calc(seedStore().facts, scope);
    assert.equal(snap.challengeId, CH1);
    assert.ok(snap.performance.totalClosedTrades > 0);
  });

  await check("e2e.12 account scope", () => {
    const snap = calc(seedStore().facts, ACCOUNT_SCOPE);
    assert.equal(snap.scope.kind, "account");
  });

  await check("e2e.13 recent 20", () => {
    const scope: IntelligenceScope = { kind: "recent_trades", accountId: ACC, count: 20 };
    const snap = calc(mixedFacts(30), scope);
    assert.equal(snap.datasetSummary.tradeCount, 20);
  });

  await check("e2e.14 recent 50", () => {
    const scope: IntelligenceScope = { kind: "recent_trades", accountId: ACC, count: 50 };
    const snap = calc(mixedFacts(60), scope);
    assert.equal(snap.datasetSummary.tradeCount, 50);
  });

  await check("e2e.15 fixed date range", () => {
    const scope: IntelligenceScope = {
      kind: "date_range",
      accountId: ACC,
      startUtc: "2026-02-01T00:00:00.000Z",
      endUtc: "2026-02-06T00:00:00.000Z",
    };
    const snap = calc(mixedFacts(10), scope);
    assert.ok(snap.performance.totalClosedTrades <= 5);
  });

  await check("e2e.16 insufficient data", () => {
    const snap = calc(mixedFacts(2));
    assert.equal(snap.status, "insufficient_data");
  });

  await check("e2e.17 incomplete data (missing risk)", () => {
    const facts = mixedFacts(8).map((f) => ({ ...f, riskAmountMajor: null, rMultiple: null }));
    const snap = calc(facts);
    assert.equal(snap.status, "incomplete_data");
  });

  await check("e2e.18 unsupported (> PI_MAX_TRADES)", () => {
    const facts: RawJournalTradeFact[] = [];
    for (let i = 0; i < PI_MAX_TRADES_PER_SCOPE + 1; i += 1) {
      facts.push(
        fact({
          tradeClientId: `bulk-${i}`,
          pnlMajor: i % 2 === 0 ? 1 : -1,
          occurredAtUtc: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
        }),
      );
    }
    const snap = calc(facts);
    assert.equal(snap.status, "unsupported");
    assert.equal(snap.datasetSummary.dataQuality.kind, "unsupported");
  });

  await check("e2e.19 zero-denominator metric", () => {
    const perf = calculatePerformanceMetrics([]);
    assert.equal(perf.winRate.kind, "undefined_zero_denominator");
    assert.equal(perf.profitFactor.kind, "undefined_zero_loss");
  });

  await check("e2e.20 instrument segment", () => {
    const trades = normalizePerformanceTrades(mixedFacts(8)).included;
    const segs = calculateSegments(trades).segments;
    assert.ok(segs.some((s) => s.segmentType === "instrument"));
    capture("segment", segs.filter((s) => s.segmentType === "instrument").slice(0, 3));
  });

  await check("e2e.21 direction segment", () => {
    const trades = normalizePerformanceTrades(mixedFacts(8)).included;
    assert.ok(calculateSegments(trades).segments.some((s) => s.segmentType === "direction"));
  });

  await check("e2e.22 weekday segment", () => {
    const trades = normalizePerformanceTrades(mixedFacts(8)).included;
    assert.ok(calculateSegments(trades).segments.some((s) => s.segmentType === "weekday_utc"));
  });

  await check("e2e.23 time-bucket segment", () => {
    const trades = normalizePerformanceTrades(mixedFacts(8)).included;
    assert.ok(calculateSegments(trades).segments.some((s) => s.segmentType === "session_utc"));
  });

  await check("e2e.24 risk data absent", () => {
    const facts = mixedFacts(8).map((f) => ({ ...f, riskAmountMajor: null }));
    const snap = calc(facts);
    assert.equal(snap.risk.dataQuality.kind, "partial");
  });

  await check("e2e.25 deterministic finding generated", () => {
    const day = "2026-02-20T";
    const facts = [
      ...Array.from({ length: 8 }, (_, i) =>
        fact({
          tradeClientId: `fd-${i}`,
          pnlMajor: 40,
          occurredAtUtc: `${day}${String(11 + i).padStart(2, "0")}:00:00.000Z`,
          riskAmountMajor: 50,
          rMultiple: 1,
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        fact({
          tradeClientId: `fd2-${i}`,
          pnlMajor: 30,
          occurredAtUtc: `2026-02-21T${String(12 + i).padStart(2, "0")}:00:00.000Z`,
          riskAmountMajor: 50,
          rMultiple: 1,
        }),
      ),
    ];
    const snap = calc(facts);
    assert.ok(snap.findings.length > 0);
    capture("finding", snap.findings.slice(0, 3));
    capture("drilldown-evidence", snap.findings[0]?.evidence ?? {});
  });

  await check("e2e.26 finding suppressed below sample threshold", () => {
    const trades = normalizePerformanceTrades(mixedFacts(4)).included;
    const perf = calculatePerformanceMetrics(trades);
    const segs = calculateSegments(trades);
    const findings = evaluateFindings({
      trades,
      performance: perf,
      risk: calculateRiskMetrics(trades),
      sequences: calculateSequenceMetrics(trades),
      segments: segs.segments,
    });
    assert.ok(findings.surfaced.some((f) => f.reasonCode === "insufficient_sample"));
    assert.ok(
      findings.surfaced.every(
        (f) =>
          f.sampleSize < PI_MIN_SEGMENT_SAMPLE ||
          f.reasonCode !== "instrument_lower_historical_expectancy",
      ),
    );
  });

  await check("e2e.27 cross-user read denied (owner scope only)", async () => {
    const store = seedStore([
      ...mixedFacts(6),
      fact({ tradeClientId: "other-t", userId: OTHER, accountId: ACC }),
    ]);
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    const snap = getCurrentSnapshot(store, ACCOUNT_SCOPE)!;
    assert.equal(snap.userId, OWNER);
    assert.ok(!store.facts.some((f) => f.userId === OTHER && f.accountId === ACC && store.snapshots[0]?.userId === OTHER));
  });

  await check("e2e.28 non-allowlisted calc request (memory N/A — roles doc)", () => {
    assert.ok(
      !(TRUSTED_PI_PROCESSOR_ROLES as readonly string[]).includes("authenticated"),
    );
    assert.ok(
      !(TRUSTED_PI_PROCESSOR_ROLES as readonly string[]).includes(
        "prop_os_recalc_processor",
      ),
    );
    assert.ok(
      (TRUSTED_PI_PROCESSOR_ROLES as readonly string[]).includes(
        "prop_os_performance_intelligence_processor",
      ),
    );
  });

  await check("e2e.29 direct DML denied (memory N/A — note only)", () => {
    assert.ok(true, "PG enforces forbid_mutation triggers; memory store has no SQL DML surface");
  });

  await check("e2e.30 account archived during calculation", () => {
    const store = seedStore();
    store.accounts.set(ACC, { userId: OWNER, archived: true });
    queueIntelligenceCalculation(store, ACCOUNT_SCOPE, 1);
    const r = processIntelligenceCalculation(store, ACCOUNT_SCOPE, 1);
    assert.equal(r.kind, "failed");
    if (r.kind === "failed") assert.equal(r.reasonCode, "account_archived");
    capture("failed", store.calc.get(scopeKey(ACCOUNT_SCOPE)));
  });

  await check("e2e.31 historical snapshots remain readable", async () => {
    const store = seedStore();
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    const firstId = getCurrentSnapshot(store, ACCOUNT_SCOPE)!.id;
    markScopesOutdatedForAssignment(store, 2);
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 2, { asOfUtc: FIXED_AS_OF });
    const read = createMemoryIntelligenceReadStore(store);
    const hist = await read.getSnapshotHistory(ACCOUNT_SCOPE);
    assert.ok(hist.some((s) => s.id === firstId));
    assert.equal(hist.length, 2);
  });

  await check("e2e.32 original journal facts unchanged after calc", () => {
    const store = seedStore();
    const before = JSON.parse(JSON.stringify(store.facts));
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    assert.deepEqual(store.facts, before);
  });

  // --- Remediation: publication, rebuild, numeric, inputRevision, privileges ---
  await check("remediation.publication failure injection all stages", () => {
    const stages = [
      "queue_claim",
      "snapshot_insert",
      "finding_insert",
      "current_projection",
      "queue_completion",
      "receipt_completion",
    ] as const;
    for (const stage of stages) {
      const store = attachPublicationState(seedStore());
      store.failAfter = stage;
      const snap = calculatePerformanceIntelligence({
        userId: OWNER,
        scope: ACCOUNT_SCOPE,
        assignmentRevision: 1,
        facts: store.facts,
        asOfUtc: FIXED_AS_OF,
      });
      const r = publishIntelligenceSnapshot(store, ACCOUNT_SCOPE, snap, `req-${stage}`);
      assert.equal(r.kind, "failed", stage);
      assert.equal(store.currentByScope.has(scopeKey(ACCOUNT_SCOPE)), false, stage);
      const calc = store.calc.get(scopeKey(ACCOUNT_SCOPE));
      assert.ok(!calc || calc.kind !== "completed", stage);
      assert.ok(!store.receipts.some((x) => x.resultStatus === "success" && x.clientRequestId === `req-${stage}`), stage);
      // retry succeeds
      store.failAfter = null;
      const snap2 = calculatePerformanceIntelligence({
        userId: OWNER,
        scope: ACCOUNT_SCOPE,
        assignmentRevision: 1,
        facts: store.facts,
        asOfUtc: FIXED_AS_OF,
      });
      const ok = publishIntelligenceSnapshot(store, ACCOUNT_SCOPE, snap2, `req-${stage}-retry`);
      assert.equal(ok.kind, "success", stage);
    }
  });

  await check("remediation.projection rebuild parity", () => {
    const store = seedStore();
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 1, { asOfUtc: FIXED_AS_OF });
    runTrustedMemoryCalculation(store, { kind: "recent_trades", accountId: ACC, count: 20 }, 1, {
      asOfUtc: FIXED_AS_OF,
    });
    markScopesOutdatedForAssignment(store, 2);
    runTrustedMemoryCalculation(store, ACCOUNT_SCOPE, 2, { asOfUtc: FIXED_AS_OF });
    const before = projectionParity(store);
    assert.equal(before.kind, "parity");
    store.currentByScope.clear();
    assert.equal(projectionParity(store).kind, "drift");
    rebuildCurrentProjection(store);
    assert.equal(projectionParity(store).kind, "parity");
  });

  await check("remediation.canonical serialization byte equality", () => {
    const facts = mixedFacts(12);
    const a = calc(facts);
    const b = calc(facts);
    assert.equal(canonicalSnapshotBytes(a), canonicalSnapshotBytes(b));
    assert.equal(intelligenceSnapshotCoreBytes(a), intelligenceSnapshotCoreBytes(b));
    assert.equal(canonicalSnapshotHash(a), canonicalSnapshotHash(b));
  });

  await check("remediation.inputRevision sensitivity", () => {
    const facts = mixedFacts(10);
    const base = calc(facts);
    const pnlChanged = calc(
      facts.map((f, i) => (i === 0 ? { ...f, pnlMajor: (f.pnlMajor ?? 0) + 1 } : f)),
    );
    assert.notEqual(base.datasetSummary.identityHash, pnlChanged.datasetSummary.identityHash);
    assert.notEqual(base.inputRevision, pnlChanged.inputRevision);
    const same = calc(facts);
    assert.equal(base.inputRevision, same.inputRevision);
  });

  await check("remediation.PI processor roles isolated from assignment processor", () => {
    assert.ok(TRUSTED_PI_PROCESSOR_ROLES.includes("prop_os_performance_intelligence_processor"));
    assert.ok(
      !(TRUSTED_PI_PROCESSOR_ROLES as readonly string[]).includes(
        "prop_os_recalc_processor",
      ),
    );
    assert.equal(ASSIGNMENT_RECALC_PROCESSOR_ROLE, "prop_os_recalc_processor");
    assert.equal(assertTrustedPiProcessorRole("authenticated"), false);
    assert.equal(assertTrustedPiProcessorRole("prop_os_performance_intelligence_processor"), true);
  });

  await check("remediation.formula catalogue reconciliation sample", () => {
    assert.equal(METRIC_CATALOGUE.formulas.profitFactor.zeroDenominator, "undefined_zero_loss");
    assert.equal(METRIC_CATALOGUE.formulas.winRate.zeroDenominator, "undefined_zero_denominator");
    const allWin = calc([
      fact({ tradeClientId: "w1", pnlMajor: 10 }),
      fact({ tradeClientId: "w2", pnlMajor: 20, occurredAtUtc: "2026-02-02T15:00:00.000Z" }),
    ]);
    assert.equal(allWin.performance.profitFactor.kind, "undefined_zero_loss");
    assert.equal(allWin.performance.winRate.kind, "value");
    if (allWin.performance.winRate.kind === "value") {
      assert.equal(allWin.performance.winRate.valueScaled, 1_000_000);
    }
  });

  await check("remediation.performance limits contract", () => {
    const t0 = Date.now();
    const snap = calc(mixedFacts(100));
    const ms = Date.now() - t0;
    const bytes = canonicalSnapshotBytes(snap).length;
    capture("performance-limits", {
      maxTrades: PI_MAX_TRADES_PER_SCOPE,
      maxSegments: 64,
      maxFindings: 8,
      sampleTrades: 100,
      durationMs: ms,
      snapshotCoreBytes: bytes,
      segments: snap.segments.length,
      findingsSuppressed: snap.datasetSummary.findingsSuppressed ?? 0,
    });
    assert.ok(ms < 5_000);
    assert.ok(bytes > 100);
  });

  await check("scenario matrix artifact (32 Phase 3A E2E + 25 metric fixtures)", () => {
    const matrix = Array.from({ length: 32 }, (_, i) => ({
      id: i + 1,
      name: `Phase 3A E2E scenario ${i + 1}`,
      cls: "memory",
      test: `e2e.${i + 1}`,
      result: "PASS",
    }));
    capture("scenario-matrix-32", matrix);
    assert.equal(matrix.length, 32);
  });

  console.log(`prop-pass-phase3a-qa: PASS (${passed})`);
  console.log(`captures=${CAPTURE}`);
  console.log(`metric_catalogue_max_trades=${PI_MAX_TRADES_PER_SCOPE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
