import assert from "node:assert/strict";
import { applyDrawdownEvent, replayDrawdownHistory, type DrawdownEvent, type DrawdownRuleVersion } from "../src/propPass/tradingOs/index";

const baseRule: DrawdownRuleVersion = {
  id: "drawdown-rule",
  version: "v1",
  effectiveAt: "2026-08-01T00:00:00.000Z",
  variant: "balance_based_trailing",
  calculationBasis: "balance",
  timing: "intraday",
  amountMinor: 10_000,
  startingBalanceMinor: 100_000,
  initialFloorMinor: 90_000,
  lockThresholdMinor: null,
  milestoneMinor: null,
  staticAfterMilestoneFloorMinor: null,
  unrealizedPnlAffectsFloor: false,
  floorCanMoveDown: false,
};
const event = (overrides: Partial<DrawdownEvent>): DrawdownEvent => ({
  id: "event-1",
  kind: "balance_update",
  occurredAt: "2026-08-02T12:00:00.000Z",
  balanceMinor: 110_000,
  equityMinor: 110_000,
  equityIncludesUnrealized: false,
  ...overrides,
});

const staticResult = applyDrawdownEvent({ ...baseRule, variant: "static" }, null, event({ balanceMinor: 95_000 }));
assert.equal(staticResult.values.state?.floorMinor, 90_000);
assert.equal(staticResult.values.state?.floorStatic, true);

const balance = applyDrawdownEvent(baseRule, null, event({}));
assert.equal(balance.values.state?.highWaterMarkMinor, 110_000);
assert.equal(balance.values.state?.floorMinor, 100_000);

const equityRule: DrawdownRuleVersion = { ...baseRule, variant: "equity_based_trailing", calculationBasis: "equity", unrealizedPnlAffectsFloor: true };
const equity = applyDrawdownEvent(equityRule, null, event({ kind: "equity_update", equityMinor: 115_000, equityIncludesUnrealized: true }));
assert.equal(equity.values.state?.floorMinor, 105_000);
assert.equal(applyDrawdownEvent(equityRule, null, event({ kind: "equity_update", equityIncludesUnrealized: false })).status, "needs_input");

const intraday = applyDrawdownEvent({ ...equityRule, variant: "intraday_trailing" }, null, event({ kind: "equity_update", equityMinor: 112_000, equityIncludesUnrealized: true }));
assert.equal(intraday.values.state?.floorMinor, 102_000);

const eodRule: DrawdownRuleVersion = { ...baseRule, variant: "end_of_day_trailing", timing: "end_of_day" };
const beforeEod = applyDrawdownEvent(eodRule, null, event({ balanceMinor: 120_000 }));
assert.equal(beforeEod.values.state?.floorMinor, 90_000);
const eod = applyDrawdownEvent(eodRule, beforeEod.values.state, event({ id: "eod", kind: "end_of_day", balanceMinor: 120_000 }));
assert.equal(eod.values.state?.floorMinor, 110_000);

const thresholdRule: DrawdownRuleVersion = { ...baseRule, variant: "trailing_until_threshold", lockThresholdMinor: 105_000 };
const threshold = applyDrawdownEvent(thresholdRule, null, event({ balanceMinor: 120_000 }));
assert.equal(threshold.values.state?.floorMinor, 105_000);
assert.equal(threshold.values.state?.floorStatic, true);

const starting = applyDrawdownEvent({ ...baseRule, variant: "trailing_until_starting_balance" }, null, event({ balanceMinor: 120_000 }));
assert.equal(starting.values.state?.floorMinor, 100_000);
assert.equal(starting.values.state?.floorStatic, true);

const milestoneRule: DrawdownRuleVersion = { ...baseRule, variant: "static_after_milestone", milestoneMinor: 110_000, staticAfterMilestoneFloorMinor: 102_000 };
const milestone = applyDrawdownEvent(milestoneRule, null, event({ balanceMinor: 115_000 }));
assert.equal(milestone.values.state?.floorMinor, 102_000);
assert.equal(milestone.values.state?.floorStatic, true);

const lockedAgain = applyDrawdownEvent(thresholdRule, threshold.values.state, event({ id: "event-2", balanceMinor: 130_000 }));
assert.equal(lockedAgain.values.state?.floorMinor, 105_000);
assert.equal(lockedAgain.values.trace?.previousFloorMinor, 105_000);
assert.equal(lockedAgain.values.trace?.newFloorMinor, 105_000);

const duplicate = replayDrawdownHistory(baseRule, [event({}), event({})]);
assert.equal(duplicate.status, "needs_input");
assert.ok(duplicate.reasons.includes("duplicate_drawdown_event"));

const breach = applyDrawdownEvent({ ...baseRule, variant: "static" }, null, event({ balanceMinor: 90_000 }));
assert.equal(breach.status, "stop_trading");
assert.equal(breach.values.trace?.remainingRoomMinor, 0);

console.log("prop-pass-drawdown-variants-qa: PASS");
