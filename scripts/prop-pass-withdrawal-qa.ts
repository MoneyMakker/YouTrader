import assert from "node:assert/strict";
import { calculateMaximumSafeWithdrawal } from "../src/propPass/tradingOs";
const base = { currentEquityMinor: 1_100_000, equityHighMinor: 1_150_000, realizedEligibleProfitMinor: 180_000, staticLossFloorMinor: 900_000, trailingDrawdownFloorMinor: 920_000, postWithdrawalReserveMinor: 50_000, dailyRiskReserveMinor: 25_000, weeklyRiskReserveMinor: 40_000, recoverySafetyReserveMinor: 80_000, recoveryModeActive: false, priorWithdrawalsMinor: 0 };
const ready = calculateMaximumSafeWithdrawal(base); assert.equal(ready.values.safetyFloorMinor, 920_000); assert.equal(ready.values.reserveMinor, 50_000); assert.equal(ready.values.recommendedMaximumWithdrawalMinor, 130_000); assert.equal(ready.values.resultingBufferMinor, 0);
const recovery = calculateMaximumSafeWithdrawal({ ...base, recoveryModeActive: true }); assert.equal(recovery.values.recommendedMaximumWithdrawalMinor, 0); assert.ok(recovery.values.blockers.includes("recovery_mode_active"));
assert.equal(calculateMaximumSafeWithdrawal({ ...base, realizedEligibleProfitMinor: null }).status, "needs_input");
