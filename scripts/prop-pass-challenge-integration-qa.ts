import assert from "node:assert/strict";
import { buildChallengeTimeline, evaluateChallengeLifecycle } from "../src/propPass/tradingOs";
const account = { contextType: "challenge" as const, accountId: "challenge-1", startingBalanceMinor: 1_000_000, currentBalanceMinor: 1_100_000, currentEquityMinor: 1_100_000, equityHighMinor: 1_100_000, realizedPnlMinor: 100_000, tradingDay: "2026-08-02", timezone: "America/New_York" };
const rules = { id: "rules-1", effectiveDate: "2026-08-02", templateVersion: "1", profitTargetMinor: 100_000, minimumTradingDays: 3 };
const base = { account, rules, riskRooms: { dailyLossRemainingMinor: 30_000, maximumLossRemainingMinor: 80_000, drawdownRemainingMinor: 70_000 }, completedTradingDays: 3, consistencyPassed: true, appliedJournalTradeIds: ["trade-b", "trade-a"], breach: null, fundedAt: null, archivedAt: null };
const passed = evaluateChallengeLifecycle(base); assert.equal(passed.values.state, "passed"); assert.equal(passed.values.recalculationKey, "trade-a:trade-b");
const breach = evaluateChallengeLifecycle({ ...base, breach: { ruleId: "daily_loss", tradeId: "trade-b", occurredAt: "2026-08-02T15:00:00.000Z", plannedRiskMinor: 10_000, actualRiskMinor: 20_000, bufferBeforeMinor: 5_000, bufferAfterMinor: -5_000 } }); assert.equal(breach.values.state, "breached"); assert.equal(breach.values.breach?.ruleId, "daily_loss");
assert.equal(evaluateChallengeLifecycle({ ...base, appliedJournalTradeIds: ["trade-a", "trade-a"] }).status, "needs_input");
const event = { type: "passed" as const, occurredAt: "2026-08-02T16:00:00.000Z", accountId: "challenge-1", snapshot: { equityMinor: 1_100_000, balanceMinor: 1_100_000 } }; assert.equal(buildChallengeTimeline([event, event]).length, 1, "refresh must not duplicate an identical timeline event");
