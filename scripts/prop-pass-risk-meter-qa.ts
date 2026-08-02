import assert from "node:assert/strict";
import { calculateLiveRiskMeter } from "../src/propPass/tradingOs";
assert.equal(calculateLiveRiskMeter({ dailyRiskBudgetMinor: 100_000, dailyRiskUsedMinor: 49_999, hardStopActive: false }).values.status, "healthy");
assert.equal(calculateLiveRiskMeter({ dailyRiskBudgetMinor: 100_000, dailyRiskUsedMinor: 50_000, hardStopActive: false }).values.status, "watch");
const danger = calculateLiveRiskMeter({ dailyRiskBudgetMinor: 100_000, dailyRiskUsedMinor: 75_000, hardStopActive: false, previousStatus: "watch" });
assert.equal(danger.values.status, "danger"); assert.equal(danger.values.enteredDanger, true);
assert.equal(calculateLiveRiskMeter({ dailyRiskBudgetMinor: 100_000, dailyRiskUsedMinor: 100_000, hardStopActive: false }).status, "stop_trading");
assert.equal(calculateLiveRiskMeter({ dailyRiskBudgetMinor: null, dailyRiskUsedMinor: 0, hardStopActive: false }).status, "needs_input");
console.log("prop-pass-risk-meter-qa: PASS");
