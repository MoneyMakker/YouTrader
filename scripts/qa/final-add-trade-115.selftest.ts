/**
 * Final Add Trade / Journal / Stats / Prop Pass / Diagnostics contracts for 1.6.1 (115).
 * Run: npx tsx scripts/qa/final-add-trade-115.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  formatAbsolutePnlAmount,
  inferTradePnlSign,
  resolveSignedTradePnl,
} from "../../src/journal/manualPnl";
import { buildPropPassRiskModePlan } from "../../src/propPass/riskModes";
import { buildPerformanceRadar } from "../../src/stats/performanceRadar";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const app = read("src/app/YouTraderApp.tsx");
const heatmap = read("src/stats/StatsHeatmapCard.tsx");
const radar = read("src/stats/performanceRadar.ts");
const settings = read("src/components/settings/SettingsAccountSection.tsx");
const riskPanel = read("src/propPass/ui/PropPassRiskModePanel.tsx");
const readiness = read("src/propPass/ui/PropPassPassProbability.tsx");
const replay = read("src/propPass/ui/PropPassDecisionReplay.tsx");
const en = JSON.parse(read("src/i18n/locales/en.json")) as Record<string, string>;

// 1–3 Day panel
assert.match(app, /testID="journal-day-panel"/);
assert.match(app, /testID="journal-day-panel-add-trade"/);
assert.match(app, /journalNoTradesForDay/);
const dayPanelSlice = app.slice(
  app.indexOf('testID="journal-day-panel"'),
  app.indexOf('testID="journal-day-panel-add-trade"') + 80,
);
assert.equal((dayPanelSlice.match(/eventDateLabel\(selectedDate\)/g) || []).length, 0);

// 4–6 No Calculate/Manual / Profit-Loss-Breakeven / Enter execution hero
assert.doesNotMatch(app, /journal\.trade\.edit\.pnl\.mode/);
assert.doesNotMatch(app, /journalFormPnlCalculate/);
assert.doesNotMatch(app, /journalFormPnlBreakeven/);
assert.doesNotMatch(app, /journalFormPnlEnterExecution/);
assert.doesNotMatch(app, /Switch P&L entry mode/);
assert.match(app, /journal\.trade\.edit\.signedPnl/);
assert.match(app, /journalFormTradePnl/);
assert.match(app, /journal\.trade\.execution\.toggle/);

// 7–11 Signed P&L
const plus = resolveSignedTradePnl("150", "plus");
assert.equal(plus.ok && plus.pnl, 150);
const minus = resolveSignedTradePnl("200", "minus");
assert.equal(minus.ok && minus.pnl, -200);
const zero = resolveSignedTradePnl("0", "plus");
assert.equal(zero.ok && zero.pnl, 0);
const empty = resolveSignedTradePnl("", "plus");
assert.equal(empty.ok, false);
assert.equal(inferTradePnlSign(-42), "minus");
assert.equal(formatAbsolutePnlAmount(-42), "42.00");

// 12–14 Optional sections + no required execution for save path
assert.match(app, /journalFormExecutionDetails/);
assert.match(app, /executionDetailsExpanded/);
assert.match(app, /journal\.trade\.context\.toggle/);
assert.match(app, /Signed Trade P&L control is authoritative/);

// 17–18 Top X closes; no duplicate bottom Close in actions stack
assert.match(app, /accessibilityLabel=\{t\("close"\)\}/);
const actions = app.slice(app.indexOf("styles.journalDetailActions"), app.indexOf("</SafeAreaView>\n      </Modal>\n      <Modal\n        visible={!!photoView}"));
assert.doesNotMatch(actions, /journalCloseSecondary/);
assert.doesNotMatch(actions, /styles\.journalCloseText/);
assert.match(actions, /journal\.trade\.save/);

// 19 Futures rename preserved (route id stays more)
assert.equal(en["more.title"], "Futures");
assert.match(app, /id: "more"/);

// 20 Prop Pass engine unchanged contract
const plan = buildPropPassRiskModePlan({
  context: "challenge",
  mode: "balanced",
  accountSizeMinor: 5_000_000,
  currentEquityMinor: 5_100_000,
  profitTargetMinor: 300_000,
  profitRemainingMinor: 200_000,
  dailyLossLimitMinor: 100_000,
  dailyLossRemainingMinor: 80_000,
  maxDrawdownLimitMinor: 200_000,
  maxDrawdownRemainingMinor: 150_000,
  stopSizePoints: 4,
  pointValue: 5,
  userMaxRiskPerTradeMinor: null,
  realizedPnlTodayMinor: 0,
  winRate: null,
  avgWinR: 1,
});
assert.equal(plan.ready, true);
assert.ok(plan.maxContracts != null && plan.maxContracts >= 1);
assert.match(riskPanel, /propPass\.riskMode\.gamblerHighRisk/);
assert.match(riskPanel, /propPass\.riskMode\.drawdownHealthy/);
assert.match(riskPanel, /propPass-set-stop-distance|prop-pass-set-stop-distance/);
assert.match(readiness, /propPass\.readiness\.combined/);
assert.match(replay, /prop-pass-decision-replay/);
assert.doesNotMatch(replay.slice(0, replay.indexOf("if (!breach)") + 200), /YdlCard testID="prop-pass-decision-replay"/);

// 21 Radar / Heatmap
assert.match(radar, /label: "Timing"/);
assert.match(heatmap, /heatTextColors/);
const radarModel = buildPerformanceRadar([]);
assert.equal(radarModel.ready, false);

// 22 Developer Diagnostics gated to staging fingerprint only
assert.match(app, /isStagingBuildFingerprintVisible\(\) \? \(/);
assert.match(app, /settings-developer-diagnostics/);
assert.equal(settings.includes("rgba(176,38,255"), false);

console.log("final-add-trade-115.selftest PASS");
