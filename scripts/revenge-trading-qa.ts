import assert from "node:assert/strict";
import {
  countTrailingConsecutiveLosses,
  detectRevengeTrading,
  REVENGE_TRADING_THRESHOLDS,
} from "../src/ai/revengeTradingDetector";

function section(name: string) {
  console.log(`\n[revenge-trading-qa] ${name}`);
}

const DAY = "2026-07-28";
const OTHER = "2026-07-27";

section("empty / malformed inputs never false-positive");
{
  assert.equal(detectRevengeTrading({ trades: null, selectedDate: DAY }).detected, false);
  assert.equal(detectRevengeTrading({ trades: undefined, selectedDate: DAY }).detected, false);
  assert.equal(detectRevengeTrading({ trades: [], selectedDate: DAY }).detected, false);
  assert.equal(detectRevengeTrading({ trades: [], selectedDate: DAY, dangerMode: true }).detected, false);
  assert.equal(detectRevengeTrading({ trades: [{ pnl: Number.NaN, date: DAY }], selectedDate: DAY }).detected, false);
  assert.equal(detectRevengeTrading({ trades: [{ pnl: 10, date: OTHER }], selectedDate: "" }).detected, false);
  assert.equal(detectRevengeTrading({ trades: [{ pnl: 10, date: OTHER }], selectedDate: null }).detected, false);
}

section("empty selected day: insufficient recent losses → not detected");
{
  const trades = [
    { pnl: 10, date: OTHER },
    { pnl: -5, date: OTHER },
    { pnl: 8, date: OTHER },
  ];
  const result = detectRevengeTrading({ trades, selectedDate: DAY });
  assert.equal(result.detected, false);
  assert.equal(result.severity, "LOW");
}

section("empty selected day: dangerMode alone without loss evidence → not detected");
{
  const wins = Array.from({ length: 5 }, (_, i) => ({ pnl: 10 + i, date: OTHER }));
  const result = detectRevengeTrading({ trades: wins, selectedDate: DAY, dangerMode: true });
  assert.equal(result.detected, false);
  assert.match(result.reason, /recent journal behavior/i);
}

section("empty selected day: recent loss density ≥ threshold → detected");
{
  const trades = [
    { pnl: 5, date: OTHER },
    { pnl: -1, date: OTHER },
    { pnl: -2, date: OTHER },
    { pnl: -3, date: OTHER },
  ];
  const result = detectRevengeTrading({ trades, selectedDate: DAY });
  assert.equal(result.detected, true);
  assert.ok(result.severity === "MEDIUM" || result.severity === "HIGH");
  assert.match(result.reason, /Recent journal shows/);
  assert.match(result.recommendation, /Pause/);
}

section("empty selected day: trailing consecutive losses → detected HIGH");
{
  const trades = [
    { pnl: 20, date: OTHER },
    { pnl: -1, date: OTHER },
    { pnl: -2, date: OTHER },
    { pnl: -3, date: OTHER },
  ];
  assert.equal(countTrailingConsecutiveLosses(trades), 3);
  const result = detectRevengeTrading({ trades, selectedDate: DAY });
  assert.equal(result.detected, true);
  assert.equal(result.severity, "HIGH");
}

section("empty selected day: dangerMode + ≥2 recent losses → detected");
{
  const trades = [
    { pnl: 5, date: OTHER },
    { pnl: -1, date: OTHER },
    { pnl: -2, date: OTHER },
  ];
  const without = detectRevengeTrading({ trades, selectedDate: DAY, dangerMode: false });
  const withDanger = detectRevengeTrading({ trades, selectedDate: DAY, dangerMode: true });
  assert.equal(without.detected, false);
  assert.equal(withDanger.detected, true);
}

section("selected day with trades: legacy semantics preserved");
{
  // losses >= 2 → detected MEDIUM
  const twoLosses = detectRevengeTrading({
    trades: [
      { pnl: -1, date: DAY },
      { pnl: -2, date: DAY },
    ],
    selectedDate: DAY,
  });
  assert.equal(twoLosses.detected, true);
  assert.equal(twoLosses.severity, "MEDIUM");

  // losses >= 3 → HIGH
  const threeLosses = detectRevengeTrading({
    trades: [
      { pnl: -1, date: DAY },
      { pnl: -2, date: DAY },
      { pnl: -3, date: DAY },
    ],
    selectedDate: DAY,
  });
  assert.equal(threeLosses.detected, true);
  assert.equal(threeLosses.severity, "HIGH");

  // overtrade count >= 5 even with wins
  const overtrade = detectRevengeTrading({
    trades: Array.from({ length: 5 }, (_, i) => ({ pnl: 1, date: DAY })),
    selectedDate: DAY,
  });
  assert.equal(overtrade.detected, true);
  assert.equal(overtrade.severity, "MEDIUM");

  // dangerMode alone on a quiet day with one small win → detected HIGH (legacy)
  const danger = detectRevengeTrading({
    trades: [{ pnl: 1, date: DAY }],
    selectedDate: DAY,
    dangerMode: true,
  });
  assert.equal(danger.detected, true);
  assert.equal(danger.severity, "HIGH");

  // clean day
  const clean = detectRevengeTrading({
    trades: [{ pnl: 10, date: DAY }],
    selectedDate: DAY,
  });
  assert.equal(clean.detected, false);
  assert.equal(clean.severity, "LOW");
}

section("output shape is severity + reason + recommendation only");
{
  const result = detectRevengeTrading({
    trades: [
      { pnl: -1, date: DAY },
      { pnl: -2, date: DAY },
    ],
    selectedDate: DAY,
  });
  assert.deepEqual(Object.keys(result).sort(), ["detected", "reason", "recommendation", "severity"]);
  assert.equal(typeof result.detected, "boolean");
  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(result.severity));
}

section("thresholds are documented constants");
{
  assert.equal(REVENGE_TRADING_THRESHOLDS.RECENT_WINDOW, 8);
  assert.equal(REVENGE_TRADING_THRESHOLDS.EMPTY_DAY_MIN_RECENT_LOSSES, 3);
  assert.equal(REVENGE_TRADING_THRESHOLDS.DAY_MIN_LOSSES, 2);
  assert.equal(REVENGE_TRADING_THRESHOLDS.DAY_OVERTRADE_COUNT, 5);
}

console.log("\n[revenge-trading-qa] PASS");
