import assert from "node:assert/strict";
import {
  RISK_MODE_POLICIES,
  calculateAllowedRisk,
  validateInstrumentSpec,
  validateTradingOsInputs,
  type AccountContext,
  type InstrumentSpec,
} from "../src/propPass/tradingOs";

const account: AccountContext = {
  contextType: "challenge",
  accountId: "qa-account",
  startingBalanceMinor: 5_000_000,
  currentBalanceMinor: 5_010_000,
  currentEquityMinor: 5_010_000,
  equityHighMinor: 5_010_000,
  realizedPnlMinor: 10_000,
  tradingDay: "2026-08-02",
  timezone: "America/New_York",
};

const instrument: InstrumentSpec = {
  symbol: "QA-MICRO",
  name: "QA micro instrument",
  category: "futures",
  exchange: "QA",
  currency: "USD",
  tickSize: 0.25,
  tickValueMinor: 125,
  pointValueMinor: 500,
  roundTripCommissionMinor: 0,
  defaultSlippageTicks: 0,
  maximumSupportedContracts: null,
  source: "user_configured",
  verifiedAt: "2026-08-02T00:00:00.000Z",
};

const valid = validateTradingOsInputs({ account, challengeRules: { id: "r", effectiveDate: "2026-08-02", templateVersion: "qa" } });
assert.deepEqual(valid, { missingInputs: [], reasons: [] });

const missing = validateTradingOsInputs({ account: null });
assert.deepEqual(missing.missingInputs, ["account_context"]);

assert.deepEqual(validateInstrumentSpec(instrument), { missingInputs: [], reasons: [] });
assert.match(validateInstrumentSpec({ ...instrument, tickValueMinor: 0 }).reasons.join(","), /invalid_tick_value/);

const balanced = calculateAllowedRisk(RISK_MODE_POLICIES.balanced, {
  dailyLossRemainingMinor: 80_000,
  maximumLossRemainingMinor: 50_000,
  drawdownRemainingMinor: 60_000,
  configuredDailyRiskBudgetMinor: 70_000,
  configuredPerTradeRiskCapMinor: 40_000,
}, "challenge");
assert.equal(balanced.values.safeBudgetMinor, 40_000);
assert.equal(balanced.values.allowedRiskMinor, 9_000);
assert.ok(balanced.values.allowedRiskMinor <= 40_000);

const stopped = calculateAllowedRisk(RISK_MODE_POLICIES.gambler, {
  dailyLossRemainingMinor: 0,
  maximumLossRemainingMinor: 50_000,
  drawdownRemainingMinor: 60_000,
  configuredPerTradeRiskCapMinor: 40_000,
}, "challenge");
assert.equal(stopped.values.allowedRiskMinor, 0);
assert.equal(stopped.appliedHardLimits.find((limit) => limit.id === "daily_loss")?.blocksTrading, true);

console.log("prop-pass-trading-os-domain-qa: PASS");
