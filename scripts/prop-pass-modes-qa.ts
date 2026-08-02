import assert from "node:assert/strict";
import { compareRiskModes } from "../src/propPass/tradingOs";
const modes = compareRiskModes({ dailyLossRemainingMinor: 10_000, maximumLossRemainingMinor: 9_000, drawdownRemainingMinor: 8_000, configuredDailyRiskBudgetMinor: 7_000, configuredPerTradeRiskCapMinor: 6_000 }, "challenge", 100);
assert.equal(modes[0].riskPerTradeMinor, 900); assert.equal(modes[2].highRisk, true); assert.equal(modes[2].requiresConfirmation, true);
assert.equal(modes[0].recommendedContracts, 9, "contract sizing must floor against verified loss per contract");
assert.equal(compareRiskModes({ dailyLossRemainingMinor: 10_000, maximumLossRemainingMinor: 9_000, drawdownRemainingMinor: 8_000, configuredDailyRiskBudgetMinor: 7_000, configuredPerTradeRiskCapMinor: 6_000 }, "challenge", null)[0].recommendedContracts, 0, "no instrument specification means no contract recommendation");
assert.equal(compareRiskModes({ dailyLossRemainingMinor: 0, maximumLossRemainingMinor: 9_000, drawdownRemainingMinor: 8_000, configuredDailyRiskBudgetMinor: 7_000, configuredPerTradeRiskCapMinor: 6_000 }, "challenge", 100)[2].enabled, false);
console.log("prop-pass-modes-qa: PASS");
