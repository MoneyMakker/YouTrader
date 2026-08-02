import assert from "node:assert/strict";
import { assessPreTrade, type PreTradeAssessmentInput } from "../src/propPass/tradingOs";

const base: PreTradeAssessmentInput = {
  account: {
    contextType: "challenge", accountId: "qa", startingBalanceMinor: 5_000_000,
    currentBalanceMinor: 5_000_000, currentEquityMinor: 5_000_000, equityHighMinor: 5_000_000,
    realizedPnlMinor: 0, tradingDay: "2026-08-02", timezone: "America/New_York",
  },
  challengeRules: { id: "challenge-rules", effectiveDate: "2026-08-02", templateVersion: "qa", maximumContracts: 4, stopAfterLosses: 2 },
  liveRules: null,
  plan: {
    instrument: { symbol: "QA", name: "QA", category: "futures", tickSize: 0.25, tickValueMinor: 125, pointValueMinor: 500, roundTripCommissionMinor: 100, defaultSlippageTicks: 1, source: "user_configured" },
    direction: "long", stopDistance: 8, stopUnit: "ticks", contracts: 1, setup: "QA", intendedSessionId: null, intendedRiskMinor: null, plannedEntryTime: "2026-08-02T14:30:00Z",
  },
  riskRooms: { dailyLossRemainingMinor: 100_000, maximumLossRemainingMinor: 90_000, drawdownRemainingMinor: 80_000, configuredDailyRiskBudgetMinor: 70_000, configuredPerTradeRiskCapMinor: 60_000 },
  selectedMode: "balanced", completedTradesToday: 0, consecutiveLosses: 0, currentMinuteLocal: 600, killSwitchActive: false, profitLockReached: false,
};

const safe = assessPreTrade(base);
assert.equal(safe.status, "safe_to_take");
assert.equal(safe.values.lossPerContractMinor, 1_225);
assert.equal(safe.values.totalPlannedRiskMinor, 1_225);
assert.equal(safe.values.recommendedContracts, 11);

assert.equal(assessPreTrade({ ...base, plan: { ...base.plan, contracts: 70 } }).status, "rule_violation");
assert.equal(assessPreTrade({ ...base, riskRooms: { ...base.riskRooms, dailyLossRemainingMinor: 0 } }).status, "stop_trading");
assert.equal(assessPreTrade({ ...base, killSwitchActive: true }).status, "stop_trading");
assert.equal(assessPreTrade({ ...base, plan: { ...base.plan, stopDistance: null } }).status, "needs_input");
assert.equal(assessPreTrade({ ...base, riskRooms: { ...base.riskRooms, drawdownRemainingMinor: null } }).status, "needs_input");
assert.equal(assessPreTrade({ ...base, challengeRules: { ...base.challengeRules!, allowedSessions: [{ id: "ny", label: "NY", startMinuteLocal: 570, endMinuteLocal: 690 }] }, currentMinuteLocal: 800 }).status, "rule_violation");
assert.equal(assessPreTrade({ ...base, consecutiveLosses: 2 }).status, "stop_trading");

console.log("prop-pass-pre-trade-qa: PASS");
