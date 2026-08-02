import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { calculateChallenge } from "../src/propOs/engine";
import { mapActivatedReadModelToViewModel } from "../src/propPass/mapViewModel";
import type { PropRuleSetSnapshot } from "../src/propOs/types";

const rules: PropRuleSetSnapshot = {
  version: "qa-v1",
  firmKey: "qa-firm",
  currency: "USD",
  firmTimezone: "America/New_York",
  tradingDayRolloverHour: 0,
  profitTargetMinor: 100_000,
  dailyLossLimitMinor: 25_000,
  dailyLossBasis: "realized_only",
  dailyLossPolicyVersion: "daily-loss-v0",
  drawdown: { kind: "static", amountMinor: 50_000 },
  minimumTradingDays: 2,
};

const result = calculateChallenge({
  challenge: {
    id: "challenge-qa",
    accountId: "account-qa",
    phase: "evaluation",
    status: "active",
    ruleSetVersion: rules.version,
    ruleSetSnapshot: rules,
    startingBalanceMinor: 1_000_000,
    startedAtUtc: "2026-01-01T00:00:00.000Z",
  },
  events: [],
  asOfUtc: "2026-01-02T00:00:00.000Z",
});

assert.deepEqual(result.tradingStats, {
  daysTraded: 0,
  tradeCount: 0,
  disciplineStreakDays: 0,
  bestDisciplineStreakDays: 0,
  ruleViolations: 0,
});

const model = mapActivatedReadModelToViewModel({
  account: {
    id: "account-qa",
    label: "QA account",
    firmKey: "qa-firm",
    accountSizeMinor: 1_000_000,
    currency: "USD",
    status: "active",
  },
  activeChallenge: {
    id: "challenge-qa",
    status: "active",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: null,
  },
  historicalAttempts: [],
  assignedTradeCount: 0,
  ruleSnapshot: { snapshot: rules },
  latestShadowSnapshot: {
    calculated_at: "2026-01-02T00:00:00.000Z",
    payload: {
      accountState: { equityMinor: 1_000_000 },
      buffers: [],
      readiness: null,
      tradingStats: result.tradingStats,
    },
  },
  dataQuality: { level: "ok", flags: [] },
} as never);

assert.equal(model.rules?.firmKey, "qa-firm");
assert.equal(model.rules?.profitTargetMinor, 100_000);
assert.equal(model.readiness.score, null);
assert.equal(model.daysTraded, 0);

const root = path.resolve(import.meta.dirname, "..");
const readinessSource = readFileSync(
  path.join(root, "src/propPass/ui/PropPassPassProbability.tsx"),
  "utf8",
);
assert.equal(readinessSource.includes("passProbability"), false);
assert.equal(readinessSource.includes("assignedTradeCount < 5"), true);

const screenSource = readFileSync(
  path.join(root, "src/propPass/PropPassInternalScreen.tsx"),
  "utf8",
);
assert.match(screenSource, /case "no_shadow_snapshot":[\s\S]*onStartAssignment/);

console.log("prop-pass-lifecycle-qa: OK");
