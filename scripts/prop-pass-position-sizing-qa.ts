import assert from "node:assert/strict";
import { calculatePositionSize } from "../src/propPass/tradingOs";

const plan = { instrument: { symbol: "QA", name: "QA", category: "futures" as const, tickSize: 0.25, tickValueMinor: 125, pointValueMinor: 500, roundTripCommissionMinor: 100, defaultSlippageTicks: 1, maximumSupportedContracts: 5, source: "user_configured" as const }, stopDistance: 3, stopUnit: "points" as const };
const sized = calculatePositionSize({ plan, allowedRiskMinor: 17_500, propMaximumContracts: 3 });
assert.equal(sized.values.stopTicks, 12);
assert.equal(sized.values.totalLossPerContractMinor, 1_725);
assert.equal(sized.values.recommendedContracts, 3);
assert.equal(sized.values.actualRiskMinor, 5_175);
assert.equal(calculatePositionSize({ plan, allowedRiskMinor: 1_000 }).values.recommendedContracts, 0);
assert.equal(calculatePositionSize({ plan: { ...plan, stopDistance: 0 }, allowedRiskMinor: 17_500 }).status, "needs_input");
console.log("prop-pass-position-sizing-qa: PASS");
