/**
 * Deterministic Prop Pass risk-mode engine + Futures rename + Add Trade layout contracts.
 * Run: npx tsx scripts/qa/refinement-rs113.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildPropPassRiskModePlan,
  planRespectsHardLossLimits,
  type PropPassRiskModeInput,
} from "../../src/propPass/riskModes";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const baseInput: PropPassRiskModeInput = {
  context: "challenge",
  mode: "balanced",
  accountSizeMinor: 5_000_000,
  currentEquityMinor: 5_125_000,
  profitTargetMinor: 300_000,
  profitRemainingMinor: 175_000,
  dailyLossLimitMinor: 100_000,
  dailyLossRemainingMinor: 78_000,
  maxDrawdownLimitMinor: 200_000,
  maxDrawdownRemainingMinor: 142_000,
  stopSizePoints: null,
  pointValue: null,
  userMaxRiskPerTradeMinor: null,
  realizedPnlTodayMinor: 0,
  winRate: null,
  avgWinR: 1,
};

const calm = buildPropPassRiskModePlan({ ...baseInput, mode: "calm" });
const balanced = buildPropPassRiskModePlan({ ...baseInput, mode: "balanced" });
const gambler = buildPropPassRiskModePlan({ ...baseInput, mode: "gambler" });

assert.equal(calm.ready, true);
assert.equal(balanced.ready, true);
assert.equal(gambler.ready, true);
assert.ok(calm.maxRiskPerTradeMinor! < balanced.maxRiskPerTradeMinor!);
assert.ok(balanced.maxRiskPerTradeMinor! <= gambler.maxRiskPerTradeMinor!);
assert.ok(planRespectsHardLossLimits(calm));
assert.ok(planRespectsHardLossLimits(balanced));
assert.ok(planRespectsHardLossLimits(gambler));
assert.ok(gambler.maxRiskPerTradeMinor! <= 78_000);
assert.ok(gambler.maxRiskPerTradeMinor! <= 142_000);
assert.equal(gambler.requiresGamblerConfirm, true);
assert.ok(gambler.gamblerConsequenceMinor != null);

const missing = buildPropPassRiskModePlan({
  ...baseInput,
  dailyLossLimitMinor: null,
  dailyLossRemainingMinor: null,
  maxDrawdownLimitMinor: null,
  maxDrawdownRemainingMinor: null,
});
assert.equal(missing.ready, false);
assert.ok(missing.missingInputs.includes("daily_loss_limit"));
assert.ok(missing.missingInputs.includes("max_drawdown"));
assert.equal(missing.maxRiskPerTradeMinor, null);

const live = buildPropPassRiskModePlan({ ...baseInput, context: "live", mode: "balanced" });
assert.equal(live.ready, true);
assert.ok(planRespectsHardLossLimits(live));

const app = read("src/app/YouTraderApp.tsx");
assert.match(app, /journal\.trade\.section\.result/);
assert.match(app, /journal\.trade\.section\.setup/);
assert.match(app, /journal\.trade\.section\.context/);
assert.match(app, /journal\.trade\.context\.toggle/);
assert.match(app, /journalFormTradeContextSummary/);
assert.match(app, /propPassEntitled = !!session\?\.user\?\.id && isPremium/);

const en = read("src/i18n/locales/en.json");
assert.match(en, /"more\.title": "Futures"/);
assert.match(en, /"propPass\.riskMode\.calm"/);

const locked = read("src/propPass/PropPassLockedPreview.tsx");
assert.match(locked, /propPass\.locked\.cap\.modes/);
assert.match(locked, /fullWidth/);

const internal = read("src/propPass/PropPassInternalScreen.tsx");
assert.match(internal, /PropPassRiskModePanel/);

const nav = read("scripts/qa/bottomNavContract.selftest.ts");
assert.match(nav, /more/);

console.log("[YouTrader:refinement-rs113] PASS");
