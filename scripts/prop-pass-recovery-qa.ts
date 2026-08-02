import assert from "node:assert/strict";
import { evaluateRecoveryMode } from "../src/propPass/tradingOs";
const active = evaluateRecoveryMode({ currentEquityMinor: 960_000, equityHighMinor: 1_000_000, normalRiskPerTradeMinor: 20_000, normalMaximumContracts: 4, activationDrawdownBps: 300, recoveryRiskBps: 5_000, minimumCompliantProfitableSessions: 3, completedCompliantProfitableSessions: 1 });
assert.equal(active.status, "safe_to_take"); assert.equal(active.values.active, true); assert.equal(active.values.reducedRiskPerTradeMinor, 10_000); assert.equal(active.values.reducedMaximumContracts, 2); assert.equal(active.values.scalingDisabled, true); assert.equal(active.values.gamblerDisabled, true);
assert.equal(active.values.exitProgress?.completedCompliantProfitableSessions, 1, "one compliant winning session cannot exit Recovery Mode");
const clear = evaluateRecoveryMode({ currentEquityMinor: 1_000_000, equityHighMinor: 1_000_000, normalRiskPerTradeMinor: 20_000, normalMaximumContracts: 4, activationDrawdownBps: 300, recoveryRiskBps: 5_000, minimumCompliantProfitableSessions: 3, completedCompliantProfitableSessions: 3 });
assert.equal(clear.values.active, false); assert.equal(clear.values.reducedRiskPerTradeMinor, 20_000);
assert.equal(evaluateRecoveryMode({ currentEquityMinor: null, equityHighMinor: null, normalRiskPerTradeMinor: null, normalMaximumContracts: null, activationDrawdownBps: null, recoveryRiskBps: null, minimumCompliantProfitableSessions: null, completedCompliantProfitableSessions: null }).status, "needs_input");
