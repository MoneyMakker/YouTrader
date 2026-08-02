import assert from "node:assert/strict";
import { evaluateProfitProtection } from "../src/propPass/tradingOs";
const base = { dailyRealizedPnlMinor: 18_000, dailyPeakProfitMinor: 20_000, weeklyRealizedPnlMinor: 40_000, weeklyPeakProfitMinor: 40_000, dailyProfitLockThresholdMinor: 10_000, weeklyProfitLockThresholdMinor: 100_000, maximumGivebackBps: 2_500, stopAfterProfitLock: false, reducedRiskBps: 5_000, switchToCalmWhenProtected: true };
const protectedDay = evaluateProfitProtection(base); assert.equal(protectedDay.values.active, true); assert.equal(protectedDay.values.maximumAllowedGivebackMinor, 5_000); assert.equal(protectedDay.values.protectedAmountMinor, 15_000); assert.equal(protectedDay.values.enforcement, "reduce_risk"); assert.equal(protectedDay.values.forcedRiskMode, "calm");
const breach = evaluateProfitProtection({ ...base, dailyRealizedPnlMinor: 14_000 }); assert.equal(breach.status, "stop_trading"); assert.equal(breach.values.enforcement, "stop_trading");
const noRule = evaluateProfitProtection({ ...base, dailyProfitLockThresholdMinor: null }); assert.equal(noRule.status, "needs_input");
