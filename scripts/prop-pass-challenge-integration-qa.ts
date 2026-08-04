import assert from "node:assert/strict";
import { buildChallengeTimeline, evaluateChallengeLifecycle } from "../src/propPass/tradingOs/index.ts";

const account = {
  contextType: "challenge" as const,
  accountId: "challenge-1",
  startingBalanceMinor: 1_000_000,
  currentBalanceMinor: 1_100_000,
  currentEquityMinor: 1_100_000,
  equityHighMinor: 1_100_000,
  realizedPnlMinor: 100_000,
  tradingDay: "2026-08-02",
  timezone: "America/New_York",
};
const rules = {
  id: "rules-1",
  effectiveDate: "2026-08-02",
  templateVersion: "1",
  profitTargetMinor: 100_000,
  minimumTradingDays: 3,
};
const rooms = {
  dailyLossRemainingMinor: 30_000,
  maximumLossRemainingMinor: 80_000,
  drawdownRemainingMinor: 70_000,
};
const base = {
  account,
  rules,
  riskRooms: rooms,
  completedTradingDays: 3,
  consistencyPassed: true,
  appliedJournalTradeIds: ["trade-b", "trade-a"],
  breach: null,
  fundedAt: null,
  archivedAt: null,
};

// Active progress (target not yet met)
const active = evaluateChallengeLifecycle({
  ...base,
  account: { ...account, currentBalanceMinor: 1_050_000, currentEquityMinor: 1_050_000, realizedPnlMinor: 50_000 },
});
assert.equal(active.values.state, "active");
assert.equal(active.values.profitRemainingMinor, 50_000);
assert.equal(active.values.completedTradingDays, 3);
assert.equal(active.values.requiredTradingDays, 3);
assert.equal(active.values.dailyLossRoomMinor, 30_000);
assert.equal(active.values.maximumLossRoomMinor, 80_000);
assert.equal(active.values.drawdownRoomMinor, 70_000);
assert.equal(active.values.recalculationKey, "trade-a:trade-b");

// Minimum trading days block pass even when profit target is met
const waitingDays = evaluateChallengeLifecycle({ ...base, completedTradingDays: 2 });
assert.equal(waitingDays.values.state, "active");
assert.ok((waitingDays.values.completedTradingDays ?? 0) < (waitingDays.values.requiredTradingDays ?? 0));

// Consistency gate blocks pass
const waitingConsistency = evaluateChallengeLifecycle({ ...base, consistencyPassed: false });
assert.equal(waitingConsistency.values.state, "active");

// Passed — exact journal revision key is sorted and stable
const passed = evaluateChallengeLifecycle(base);
assert.equal(passed.values.state, "passed");
assert.equal(passed.values.recalculationKey, "trade-a:trade-b");
assert.deepEqual(passed.values.appliedJournalTradeIds, ["trade-a", "trade-b"]);

// Same trade set in another order must not invent a new lifecycle key
const passedAgain = evaluateChallengeLifecycle({
  ...base,
  appliedJournalTradeIds: ["trade-a", "trade-b"],
});
assert.equal(passedAgain.values.recalculationKey, passed.values.recalculationKey);

// Breached — exact triggering rule + trade revision identity
const breach = evaluateChallengeLifecycle({
  ...base,
  breach: {
    ruleId: "daily_loss",
    tradeId: "trade-b",
    occurredAt: "2026-08-02T15:00:00.000Z",
    plannedRiskMinor: 10_000,
    actualRiskMinor: 20_000,
    bufferBeforeMinor: 5_000,
    bufferAfterMinor: -5_000,
  },
});
assert.equal(breach.values.state, "breached");
assert.equal(breach.values.breach?.ruleId, "daily_loss");
assert.equal(breach.values.breach?.tradeId, "trade-b");
assert.deepEqual(breach.relatedRuleIds, ["daily_loss"]);

const drawdownBreach = evaluateChallengeLifecycle({
  ...base,
  breach: {
    ruleId: "drawdown",
    tradeId: "trade-a",
    occurredAt: "2026-08-02T15:05:00.000Z",
    plannedRiskMinor: 10_000,
    actualRiskMinor: 40_000,
    bufferBeforeMinor: 20_000,
    bufferAfterMinor: -20_000,
  },
});
assert.equal(drawdownBreach.values.state, "breached");
assert.equal(drawdownBreach.values.breach?.ruleId, "drawdown");

// Max-loss breach identity
const maxLossBreach = evaluateChallengeLifecycle({
  ...base,
  breach: {
    ruleId: "maximum_loss",
    tradeId: "trade-a",
    occurredAt: "2026-08-02T15:10:00.000Z",
    plannedRiskMinor: null,
    actualRiskMinor: null,
    bufferBeforeMinor: 0,
    bufferAfterMinor: -1,
  },
});
assert.equal(maxLossBreach.values.breach?.ruleId, "maximum_loss");

// Funded / Archived precedence over passed
const funded = evaluateChallengeLifecycle({ ...base, fundedAt: "2026-08-03T12:00:00.000Z" });
assert.equal(funded.values.state, "funded");
const archived = evaluateChallengeLifecycle({
  ...base,
  fundedAt: "2026-08-03T12:00:00.000Z",
  archivedAt: "2026-08-10T12:00:00.000Z",
});
assert.equal(archived.values.state, "archived");

// Duplicate journal trade ids withheld
assert.equal(
  evaluateChallengeLifecycle({ ...base, appliedJournalTradeIds: ["trade-a", "trade-a"] }).status,
  "needs_input",
);

// Timeline refresh must not duplicate identical lifecycle events
const event = {
  type: "passed" as const,
  occurredAt: "2026-08-02T16:00:00.000Z",
  accountId: "challenge-1",
  snapshot: { equityMinor: 1_100_000, balanceMinor: 1_100_000 },
};
assert.equal(buildChallengeTimeline([event, event]).length, 1, "refresh must not duplicate an identical timeline event");

console.log("prop-pass-challenge-integration-qa: PASS");
