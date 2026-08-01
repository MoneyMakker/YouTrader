/**
 * Deterministic calculator boundary QA — mirrors CalcScreen formulas.
 * No UI / no network.
 */
import assert from "node:assert/strict";

type Instrument = { tickSize: number; tickValue: number; name: string };

const MES: Instrument = { tickSize: 0.25, tickValue: 1.25, name: "Micro E-mini S&P" };

function unitValue(mode: "ticks" | "points", i: Instrument): number {
  return mode === "ticks" ? i.tickValue : i.tickValue / i.tickSize;
}

function parseNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function calcResult(amount: string, mode: "ticks" | "points", contracts: string, i: Instrument) {
  const a = parseNum(amount);
  const c = parseNum(contracts);
  if (!Number.isFinite(a) || !Number.isFinite(c)) return NaN;
  return a * unitValue(mode, i) * c;
}

function calcRiskReward(sl: string, tp: string, mode: "ticks" | "points", contracts: string, i: Instrument) {
  const risk = calcResult(sl, mode, contracts, i);
  const reward = calcResult(tp, mode, contracts, i);
  if (!Number.isFinite(risk) || !Number.isFinite(reward)) return { risk: NaN, reward: NaN, rr: NaN };
  const rr = risk ? reward / risk : 0;
  return { risk, reward, rr };
}

function maxRiskDollars(balance: string, riskPct: string): number {
  const b = parseNum(balance);
  const p = parseNum(riskPct);
  if (!Number.isFinite(b) || !Number.isFinite(p)) return NaN;
  return (b * p) / 100;
}

function run() {
  assert.equal(calcResult("20", "ticks", "1", MES), 25);
  assert.equal(calcResult("20", "points", "1", MES), 100);
  assert.equal(maxRiskDollars("50000", "1"), 500);
  assert.equal(maxRiskDollars("0", "1"), 0);
  assert.ok(Number.isNaN(maxRiskDollars("abc", "1")));
  assert.ok(Number.isNaN(calcResult("x", "ticks", "1", MES)));
  assert.ok(!Number.isNaN(calcResult("-5", "ticks", "1", MES))); // negative allowed numerically; UI may warn
  assert.ok(Number.isFinite(calcResult("1e9", "ticks", "100", MES)));
  assert.ok(Math.abs(calcResult("1e9", "ticks", "100", MES)) < Number.POSITIVE_INFINITY);

  const rr = calcRiskReward("20", "40", "ticks", "1", MES);
  assert.equal(rr.rr, 2);
  const zeroRisk = calcRiskReward("0", "40", "ticks", "1", MES);
  assert.equal(zeroRisk.rr, 0);

  console.log("calculator-risk-qa: PASS");
}

run();
