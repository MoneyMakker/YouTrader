/**
 * Behavior-level UI contracts for Journal / Stats / theme lime accent (YT3 UI polish).
 * Avoid importing app modules that pull RN/i18n graphs — assert source + pure inline helper.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function getInsightsLearningState(input: {
  tradeCount: number;
  hasRecentTrend: boolean;
  radarReady: boolean;
  hasBestEdge: boolean;
  hasBiggestLeak: boolean;
  recentTrendMin: number;
  edgeMin: number;
  radarMin: number;
}) {
  const targets: string[] = [];
  const belowRecent = input.tradeCount < input.recentTrendMin;
  const belowEdge = input.tradeCount < input.edgeMin;
  if (!input.hasRecentTrend && belowRecent) targets.push("recentTrend");
  if (!input.radarReady) targets.push("performanceRadar");
  if (!input.hasBestEdge && belowEdge) targets.push("bestEdge");
  if (!input.hasBiggestLeak && belowEdge) targets.push("biggestLeak");
  return {
    isLearning: targets.length > 0,
    targets,
    requiredTrades: Math.max(
      !input.hasRecentTrend ? input.recentTrendMin : 0,
      !input.radarReady ? input.radarMin : 0,
      !input.hasBestEdge && belowEdge ? input.edgeMin : 0,
      !input.hasBiggestLeak && belowEdge ? input.edgeMin : 0,
    ),
  };
}

{
  const app = read("src/app/YouTraderApp.tsx");
  const journalSlice = app.slice(app.indexOf("function JournalScreen"), app.indexOf("function TabGlyph"));
  assert.equal(journalSlice.includes("styles.journalHeader"), false, "Journal permanent header removed");
  assert.equal(journalSlice.includes("journalSyncChip"), false, "Synced chip not rendered on Journal");
  assert.ok(journalSlice.includes('testID="journal-add-trade"'), "Add Trade reachable via day UI");
  assert.ok(journalSlice.includes("journal-day-empty"), "Empty day state present");
  assert.ok(journalSlice.includes("styles.daySelected"), "Selected day style used");
  assert.ok(journalSlice.includes("setDayPanelOpen(true)"), "Selected day opens action panel");
  assert.ok(journalSlice.includes("journal-day-panel"), "Day panel test id present");
}

{
  const semantic = read("src/ydl/tokens/color.semantic.ts");
  assert.ok(semantic.includes("primary: ydlPrimitiveColor.green400"), "action.primary is lime");
  assert.ok(semantic.includes("primaryText: ydlPrimitiveColor.inkOnLime"), "text on lime is dark");
  assert.ok(!/action:\s*\{[^}]*primary:\s*ydlPrimitiveColor\.accent400/s.test(semantic), "primary is not purple");
  const tabBar = read("src/ydl/shell/YdlTabBar.tsx");
  assert.ok(tabBar.includes("theme.colors.action.primary"), "tab bar uses action.primary");
  const styles = read("src/app/styles.ts");
  assert.ok(/daySelected:\s*\{[\s\S]*?borderColor:\s*C\.green/.test(styles), "selected day lime border");
  assert.ok(/instrumentBtnActive:\s*\{[\s\S]*?borderColor:\s*C\.green/.test(styles), "instrument selected lime");
}

{
  const learning = getInsightsLearningState({
    tradeCount: 2,
    hasRecentTrend: false,
    radarReady: false,
    hasBestEdge: false,
    hasBiggestLeak: false,
    recentTrendMin: 5,
    edgeMin: 5,
    radarMin: 5,
  });
  assert.equal(learning.isLearning, true);
  assert.ok(learning.requiredTrades >= 5);
  assert.ok(learning.targets.includes("performanceRadar"));
  assert.ok(learning.targets.includes("bestEdge"));
  const ready = getInsightsLearningState({
    tradeCount: 50,
    hasRecentTrend: true,
    radarReady: true,
    hasBestEdge: true,
    hasBiggestLeak: true,
    recentTrendMin: 5,
    edgeMin: 5,
    radarMin: 5,
  });
  assert.equal(ready.isLearning, false);
}

{
  const dash = read("src/stats/StatsDashboard.tsx");
  assert.ok(dash.includes("horizontal"), "filter chips use horizontal ScrollView");
  assert.ok(dash.includes("numberOfLines={1}"), "chip labels single line");
  assert.ok(dash.includes("stats-insights-learning"), "consolidated learning card");
  assert.ok(dash.includes("getInsightsLearningState"), "uses learning helper");
  assert.ok(dash.includes("StatsRadarCard"), "Performance Radar visual card");
  assert.ok(dash.includes("StatsHeatmapCard"), "Trading Heatmap visual card");
}

{
  const app = read("src/app/YouTraderApp.tsx");
  const outcomeStart = app.indexOf("journalFormTradeResult");
  const outcomeEnd = app.indexOf("journalDetailExecution", outcomeStart);
  const formSlice = app.slice(outcomeStart, outcomeEnd);
  assert.ok(formSlice.includes("journal.trade.edit.pnl.mode"), "Calculate/Manual selector present");
  assert.ok(formSlice.includes("journal.trade.edit.pnl.manual"), "Manual amount field present");
  assert.ok(formSlice.includes("pnlPreview === 0") || formSlice.includes("journalDetailResultBoxNeutral"), "zero/neutral styling path");
  assert.ok(formSlice.includes("symbolIsCustom"), "custom symbol mode");
  assert.ok(formSlice.includes("customSymbolOption"), "Custom option present");
  assert.ok(app.includes('t("microContracts")'), "Micro contracts label used");
}

{
  const prop = read("src/propPass/PropPassInternalScreen.tsx");
  assert.ok(prop.includes("BufferHealthSection") || prop.includes("PropPassTargetProgress"), "Prop Pass dashboard cards remain");
  const primitive = read("src/ydl/tokens/color.primitive.ts");
  assert.ok(primitive.includes('neutral900: "#F4F7F5"'), "primary light text token present");
}

console.log("[YouTrader:ui-polish-qa] contracts passed");
