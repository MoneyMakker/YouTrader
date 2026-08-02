import assert from "node:assert/strict";
import { calculatePayoutReadiness } from "../src/propPass/tradingOs";
const input = { currentEquityMinor: 1_200_000, startingBalanceMinor: 1_000_000, eligibleProfitMinor: 200_000, completedTradingDays: 10, minimumTradingDays: 8, consistencyPassed: true, payoutThresholdMinor: 50_000, maximumLossFloorMinor: 1_000_000, postPayoutReserveMinor: 50_000 };
assert.equal(calculatePayoutReadiness(input).values.recommendedMaximumPayoutMinor, 150_000);
assert.equal(calculatePayoutReadiness({ ...input, completedTradingDays: 2 }).values.recommendedMaximumPayoutMinor, 0);
assert.equal(calculatePayoutReadiness({ ...input, consistencyPassed: null }).status, "needs_input");
console.log("prop-pass-payout-qa: PASS");
