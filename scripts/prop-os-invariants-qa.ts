/**
 * Phase 1B — property / invariant / determinism checks for Prop OS engine.
 */
import assert from "node:assert/strict";
import { PROP_OS_FIXTURES } from "../src/propOs/fixtures/scenarios";
import {
  calculateChallenge,
  publicReadinessScore,
  replayChallenge,
} from "../src/propOs/index";
import { sortAccountingEvents } from "../src/propOs/eventOrder";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

function stableCore(result: ReturnType<typeof calculateChallenge>) {
  return {
    status: result.status,
    equity: result.accountState.equityMinor,
    hwm: result.accountState.hwmMinor,
    floor: result.accountState.drawdownFloorMinor,
    dayPnl: result.accountState.dayPnlMinor,
    revision: result.inputRevision,
    score: publicReadinessScore(result),
    limitations: [...result.limitations].sort(),
    breach: result.breachReasons.map((b) => b.code).sort(),
  };
}

console.log("prop-os-invariants-qa");

check("calculateChallenge === replayChallenge alias (no dual math)", () => {
  for (const fx of PROP_OS_FIXTURES) {
    const a = calculateChallenge({
      challenge: fx.challenge,
      events: fx.events,
      asOfUtc: fx.asOfUtc,
      previousReadinessScore: fx.previousReadinessScore,
      previousReadinessFactors: fx.previousReadinessFactors,
    });
    const b = replayChallenge({
      challenge: fx.challenge,
      events: fx.events,
      asOfUtc: fx.asOfUtc,
      previousReadinessScore: fx.previousReadinessScore,
      previousReadinessFactors: fx.previousReadinessFactors,
    });
    assert.deepEqual(stableCore(a), stableCore(b), fx.id);
  }
});

check("determinism: repeated calls identical", () => {
  const fx = PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy") ?? PROP_OS_FIXTURES[0]!;
  const a = stableCore(
    calculateChallenge({ challenge: fx.challenge, events: fx.events, asOfUtc: fx.asOfUtc }),
  );
  const b = stableCore(
    calculateChallenge({ challenge: fx.challenge, events: fx.events, asOfUtc: fx.asOfUtc }),
  );
  assert.deepEqual(a, b);
});

check("no hidden Date.now dependency in math", () => {
  const fx = PROP_OS_FIXTURES.find((f) => f.id === "F01_static_dd_near_floor")!;
  const realNow = Date.now;
  let calls = 0;
  Date.now = () => {
    calls += 1;
    return 1_700_000_000_000 + calls * 999_999;
  };
  try {
    const a = stableCore(
      calculateChallenge({ challenge: fx.challenge, events: fx.events, asOfUtc: fx.asOfUtc }),
    );
    const b = stableCore(
      calculateChallenge({ challenge: fx.challenge, events: fx.events, asOfUtc: fx.asOfUtc }),
    );
    assert.deepEqual(a, b);
  } finally {
    Date.now = realNow;
  }
});

check("permutation invariance for multi-event fixtures", () => {
  const candidates = PROP_OS_FIXTURES.filter((f) => f.events.length >= 3);
  assert.ok(candidates.length >= 5);
  for (const fx of candidates.slice(0, 12)) {
    const base = stableCore(
      calculateChallenge({ challenge: fx.challenge, events: fx.events, asOfUtc: fx.asOfUtc }),
    );
    const shuffled = [...fx.events].sort((a, b) => b.id.localeCompare(a.id));
    const alt = stableCore(
      calculateChallenge({ challenge: fx.challenge, events: shuffled, asOfUtc: fx.asOfUtc }),
    );
    assert.deepEqual(base, alt, fx.id);
    assert.deepEqual(
      sortAccountingEvents(fx.events).map((e) => e.id),
      sortAccountingEvents(shuffled).map((e) => e.id),
    );
  }
});

check("replay idempotency: concatenate duplicate stream ignored", () => {
  const fx = PROP_OS_FIXTURES.find((f) => f.id === "F10_duplicate_event")!;
  const once = stableCore(
    calculateChallenge({ challenge: fx.challenge, events: fx.events, asOfUtc: fx.asOfUtc }),
  );
  const twice = stableCore(
    calculateChallenge({
      challenge: fx.challenge,
      events: [...fx.events, ...fx.events],
      asOfUtc: fx.asOfUtc,
    }),
  );
  assert.equal(once.equity, twice.equity);
  assert.equal(once.status, twice.status);
});

check("integer money invariant", () => {
  for (const fx of PROP_OS_FIXTURES) {
    const r = calculateChallenge({
      challenge: fx.challenge,
      events: fx.events,
      asOfUtc: fx.asOfUtc,
    });
    for (const n of [
      r.accountState.equityMinor,
      r.accountState.hwmMinor,
      r.accountState.drawdownFloorMinor,
      r.accountState.dayPnlMinor,
    ]) {
      assert.equal(n, Math.trunc(n), fx.id);
    }
  }
});

check("breached withholds public score", () => {
  for (const fx of PROP_OS_FIXTURES) {
    const r = calculateChallenge({
      challenge: fx.challenge,
      events: fx.events,
      asOfUtc: fx.asOfUtc,
    });
    if (r.status === "breached") {
      assert.equal(publicReadinessScore(r), null, fx.id);
    }
  }
});

check("benchmark: 5k synthetic fills < 2s", () => {
  const base = PROP_OS_FIXTURES.find((f) => f.id === "F07_readiness_healthy")!;
  const events = Array.from({ length: 5000 }, (_, i) => ({
    kind: "fill_close" as const,
    id: `bench-${i}`,
    challengeId: base.challenge.id,
    accountId: base.account.id,
    occurredAtUtc: new Date(Date.UTC(2026, 0, 6, 14, 0, i % 60, Math.floor(i / 60) % 1000)).toISOString(),
    brokerSequence: i,
    realizedPnlMinor: i % 17 === 0 ? -2_000 : 1_500,
    feesMinor: 50,
  }));
  const t0 = Date.now();
  const r = calculateChallenge({
    challenge: {
      ...base.challenge,
      ruleSetSnapshot: {
        ...base.challenge.ruleSetSnapshot,
        dailyLossLimitMinor: 50_000_000,
        drawdown: { kind: "static", amountMinor: 20_000_000 },
        minimumTradingDays: 0,
      },
    },
    events,
    asOfUtc: "2026-01-07T00:00:00.000Z",
  });
  const ms = Date.now() - t0;
  assert.ok(Number.isFinite(r.accountState.equityMinor));
  assert.ok(ms < 2000, `took ${ms}ms`);
  console.log(`    benchmark_ms=${ms.toFixed(1)}`);
});

console.log(`prop-os-invariants-qa: PASS (${passed} checks)`);
