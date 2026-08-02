import assert from "node:assert/strict";
import { PROP_PASS_CALCULATION_VERSION, createDecisionReplay } from "../src/propPass/tradingOs";
const plan = Object.freeze({ calculationVersion: PROP_PASS_CALCULATION_VERSION, id: "p", generatedAt: "x", accountId: "a", tradingDay: "d", context: "challenge" as const, mode: "balanced" as const, maximumRiskTodayMinor: 100, riskPerTradeMinor: 50, maximumTrades: 2, stopAfterLosses: 2, profitLockMinor: null, preferredInstrument: null, allowedSessionId: null, hardLimitSnapshot: Object.freeze({ dailyLossRemainingMinor: 100, maximumLossRemainingMinor: 100, drawdownRemainingMinor: 100 }) });
assert.equal(createDecisionReplay({ plan, trade: { id: "loss", riskMinor: 50, realizedPnlMinor: -100, sequenceToday: 1, dailyBufferAfterMinor: 50 } }).verdict, "good_decision");
assert.equal(createDecisionReplay({ plan, trade: { id: "winbad", riskMinor: 50, realizedPnlMinor: 100, sequenceToday: 1, ruleViolationId: "daily_loss" } }).verdict, "rule_violation");
assert.equal(createDecisionReplay({ plan: null, trade: null }).verdict, "insufficient_data");
console.log("prop-pass-replay-qa: PASS");
