import assert from "node:assert/strict";
import { assessSmartInterventions } from "../src/propPass/tradingOs";
const plan = Object.freeze({ id: "p", generatedAt: "2026", accountId: "a", tradingDay: "2026-08-02", context: "challenge" as const, mode: "balanced" as const, maximumRiskTodayMinor: 10_000, riskPerTradeMinor: 5_000, maximumTrades: 2, stopAfterLosses: 2, profitLockMinor: null, preferredInstrument: null, allowedSessionId: null, hardLimitSnapshot: Object.freeze({ dailyLossRemainingMinor: 10_000, maximumLossRemainingMinor: 10_000, drawdownRemainingMinor: 10_000 }) });
const trades = [{ id: "l1", occurredAt: "1", realizedPnlMinor: -100, riskMinor: 5_000, contracts: 1 }, { id: "l2", occurredAt: "2", realizedPnlMinor: -100, riskMinor: 5_000, contracts: 1 }];
const found = assessSmartInterventions({ plan, completedTrades: trades, proposed: { id: "p", occurredAt: "3", realizedPnlMinor: 0, riskMinor: 6_000, contracts: 2 }, selectedMode: "balanced", safeBufferMinor: 10_000, currentMinuteLocal: 600, profitLockReached: false, killSwitchActive: false, recoveryModeActive: false });
assert.ok(found.some((x) => x.id === "consecutive_losses" && x.blocking));
assert.ok(found.some((x) => x.id === "possible_revenge_pattern" && x.overrideEligible));
assert.ok(!found.some((x) => x.title === "You are revenge trading"));
console.log("prop-pass-interventions-qa: PASS");
