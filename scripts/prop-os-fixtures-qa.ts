/**
 * Prop OS Phase 0C — fixture QA (executable source of truth).
 * Not wired to production app flows.
 */
import assert from "node:assert/strict";
import { PROP_OS_FIXTURES } from "../src/propOs/fixtures/scenarios.ts";
import { publicReadinessScore, replayChallenge } from "../src/propOs/replay.ts";
import { sortAccountingEvents } from "../src/propOs/eventOrder.ts";
import { tradingDayId } from "../src/propOs/tradingDay.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

console.log("prop-os-fixtures-qa");

check("fixture catalog size >= 29", () => {
  assert.ok(PROP_OS_FIXTURES.length >= 29, `got ${PROP_OS_FIXTURES.length}`);
});

check("F05 firm TZ trading day is 2026-01-06", () => {
  const day = tradingDayId("2026-01-07T04:30:00.000Z", "America/New_York", 0);
  assert.equal(day, "2026-01-06");
});

check("canonical sort is stable for shuffle", () => {
  const fx = PROP_OS_FIXTURES.find((f) => f.id === "F15_out_of_order_import");
  assert.ok(fx);
  const a = replayChallenge({
    challenge: fx.challenge,
    events: fx.events,
    asOfUtc: fx.asOfUtc,
  });
  const shuffled = [...fx.events].reverse();
  const b = replayChallenge({
    challenge: fx.challenge,
    events: shuffled,
    asOfUtc: fx.asOfUtc,
  });
  assert.equal(a.accountState.equityMinor, b.accountState.equityMinor);
  assert.equal(a.inputRevision, b.inputRevision);
  assert.deepEqual(
    sortAccountingEvents(fx.events).map((e) => e.id),
    sortAccountingEvents(shuffled).map((e) => e.id),
  );
});

for (const fx of PROP_OS_FIXTURES) {
  check(fx.id, () => {
    const result = replayChallenge({
      challenge: fx.challenge,
      events: fx.events,
      asOfUtc: fx.asOfUtc,
      previousReadinessScore: fx.previousReadinessScore,
    });
    const exp = fx.expect;

    assert.equal(result.status, exp.status, `${fx.id} status`);
    assert.equal(result.calculationVersion, "calc-spec-v0");
    assert.equal(result.ruleSetVersion, fx.challenge.ruleSetSnapshot.version);
    assert.ok(result.confidence.confidencePolicyVersion === "confidence-policy-v0");
    assert.equal(result.dailyLossBasis, fx.challenge.ruleSetSnapshot.dailyLossBasis);

    const pub = publicReadinessScore(result);
    if (exp.readinessScore === true) {
      assert.equal(typeof pub, "number", `${fx.id} expected numeric score`);
      assert.ok(pub! >= 0 && pub! <= 100);
      if (exp.expectScoreDelta) {
        assert.ok(result.readiness?.delta != null, `${fx.id} expected delta`);
        assert.ok((result.readiness?.drivers?.length ?? 0) >= 1);
      }
    } else {
      assert.equal(pub, exp.readinessScore, `${fx.id} readinessScore`);
    }

    if (exp.readinessGate) {
      assert.equal(result.readiness?.gate, exp.readinessGate, `${fx.id} gate`);
    }

    if (exp.equityMinor != null) {
      assert.equal(result.accountState.equityMinor, exp.equityMinor, `${fx.id} equity`);
    }
    if (exp.hwmMinor != null) {
      assert.equal(result.accountState.hwmMinor, exp.hwmMinor, `${fx.id} hwm`);
    }
    if (exp.equitySource) {
      assert.equal(result.accountState.equitySource, exp.equitySource, `${fx.id} equitySource`);
    }
    for (const lim of exp.limitationsIncludes ?? []) {
      assert.ok(result.limitations.includes(lim), `${fx.id} missing limitation ${lim}: ${result.limitations.join(",")}`);
    }
    for (const code of exp.breachCodesIncludes ?? []) {
      assert.ok(
        result.breachReasons.some((b) => b.code === code),
        `${fx.id} missing breach ${code}`,
      );
    }
    if (result.status === "breached") {
      assert.equal(pub, null, `${fx.id} breached must withhold public score`);
    }
  });
}

console.log(`prop-os-fixtures-qa: PASS (${passed} checks)`);
