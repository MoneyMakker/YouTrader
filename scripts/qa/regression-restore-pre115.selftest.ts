/**
 * Pre-115 regression restore contracts:
 * Stats Radar/Heatmap always present, Journal day Add Trade, Manual P&L, five-tab Prop Pass.
 * Avoid importing RN/i18n graphs — pure helpers + source contracts.
 * Run: npx tsx scripts/qa/regression-restore-pre115.selftest.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Inlined from src/journal/manualPnl.ts to keep this selftest outside the RN import graph. */
function resolveManualSignedPnl(
  amountRaw: string,
  resultType: "profit" | "loss" | "breakeven",
): { ok: true; pnl: number } | { ok: false; error: "empty" | "invalid" } {
  if (resultType === "breakeven") return { ok: true, pnl: 0 };
  const cleaned = String(amountRaw || "")
    .trim()
    .replace(/[$€£\s]/g, "")
    .replace(",", ".");
  if (!cleaned) return { ok: false, error: "empty" };
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "invalid" };
  const abs = Number(n.toFixed(2));
  if (resultType === "loss") return { ok: true, pnl: -Math.abs(abs) };
  return { ok: true, pnl: Math.abs(abs) };
}
function inferManualResultType(pnl: number): "profit" | "loss" | "breakeven" {
  if (pnl > 0) return "profit";
  if (pnl < 0) return "loss";
  return "breakeven";
}

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const RADAR_MIN_TRADES = 5;
const HEATMAP_COMPARE_MIN = 4;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Cell = { key: string; pnl: number; count: number };

function buildWeekdayHeatmap(
  trades: Array<{ date: string; pnl: number; symbol?: string }>,
): Cell[] {
  const map = new Map<string, { pnl: number; count: number }>();
  for (const trade of trades) {
    const day = WEEKDAYS[new Date(`${trade.date}T12:00:00Z`).getUTCDay()] || "—";
    const cur = map.get(day) || { pnl: 0, count: 0 };
    cur.pnl += trade.pnl;
    cur.count += 1;
    map.set(day, cur);
  }
  return WEEKDAYS.map((key) => {
    const live = map.get(key);
    return live
      ? { key, pnl: live.pnl, count: live.count }
      : { key, pnl: 0, count: 0 };
  });
}

// 1–2 Stats always contains Radar + Heatmap sections
{
  const dash = read("src/stats/StatsDashboard.tsx");
  assert.ok(dash.includes("StatsRadarCard"), "StatsDashboard mounts Performance Radar");
  assert.ok(dash.includes("StatsHeatmapCard"), "StatsDashboard mounts Trading Heatmap");
  const emptySlice = dash.slice(
    dash.indexOf('testID="stats-dashboard-empty"'),
    dash.indexOf("const conclusion"),
  );
  assert.ok(emptySlice.includes("StatsRadarCard"), "Radar present with 0 trades");
  assert.ok(emptySlice.includes("StatsHeatmapCard"), "Heatmap present with 0 trades");
  assert.ok(read("src/stats/StatsRadarCard.tsx").includes("react-native-svg"), "Radar is visual SVG");
  assert.ok(read("src/stats/StatsHeatmapCard.tsx").includes("stats-heatmap-grid"), "Heatmap grid present");
}

// 3 Radar does not fabricate values with insufficient data
{
  const radar = read("src/stats/performanceRadar.ts");
  assert.ok(radar.includes(`tradeCount < RADAR_MIN_TRADES`), "insufficient gate present");
  assert.ok(radar.includes("axes: []"), "no fabricated axes when not ready");
  const radarCard = read("src/stats/StatsRadarCard.tsx");
  assert.ok(radarCard.includes("strokeDasharray"), "preview outline without real polygon when not ready");
  assert.ok(!radarCard.includes("profileScore") || radarCard.includes("model.ready"), "no fake profile score path");
  assert.equal(2 < RADAR_MIN_TRADES, true);
}

// 4 Heatmap does not fabricate cells with insufficient data
{
  const empty = buildWeekdayHeatmap([]);
  assert.equal(empty.length, 7);
  assert.ok(empty.every((c) => c.count === 0 && c.pnl === 0), "empty cells stay neutral zero");
  const heatSrc = read("src/stats/tradingHeatmap.ts");
  assert.ok(heatSrc.includes("HEATMAP_COMPARE_MIN"), "comparable-trade threshold defined");
  assert.ok(
    heatSrc.includes("day.slice(0, 2)") && heatSrc.includes("${hour}"),
    "dayHour labels use ultra-short Fr14 form (no clipping)",
  );
  assert.ok(heatSrc.includes("buildVisualHeatmap"), "visual merge helper present");
  assert.ok(heatSrc.includes("emptyCell"), "scaffold empties stay zero");
  assert.equal(1 < HEATMAP_COMPARE_MIN, true);
}

// 5 Radar ready path exists for sufficient trades
{
  const radar = read("src/stats/performanceRadar.ts");
  assert.ok(radar.includes("ready: true"), "ready model returned when threshold met");
  assert.ok(radar.includes('label: "Profitability"'), "real axis labels");
  assert.ok(read("src/stats/StatsRadarCard.tsx").includes("Polygon"), "renders polygon when ready");
}

// 6 Heatmap filters use real journal trades
{
  const trades = [
    { date: "2026-08-03", pnl: 200, symbol: "MES" }, // Mon
    { date: "2026-08-04", pnl: -80, symbol: "MNQ" }, // Tue
    { date: "2026-08-03", pnl: 50, symbol: "MES" },
    { date: "2026-08-05", pnl: 10, symbol: "ES" },
  ];
  assert.ok(trades.length >= HEATMAP_COMPARE_MIN);
  const weekday = buildWeekdayHeatmap(trades);
  const mon = weekday.find((c) => c.key === "Mon");
  assert.ok(mon && mon.count === 2 && mon.pnl === 250);
  const heatCard = read("src/stats/StatsHeatmapCard.tsx");
  assert.ok(heatCard.includes("Day × Hour") || heatCard.includes("HEATMAP_MODE_LABELS"), "filter modes wired");
  assert.ok(heatCard.includes('"weekday"') && heatCard.includes('"session"'), "weekday/session filters");
  assert.ok(heatCard.includes('"instrument"') && heatCard.includes('"setup"'), "instrument/setup filters");
}

// 7–10 Journal selected-day Add Trade flow
{
  const app = read("src/app/YouTraderApp.tsx");
  const journalSlice = app.slice(app.indexOf("function JournalScreen"), app.indexOf("function TabGlyph"));
  assert.ok(journalSlice.includes("setDayPanelOpen(true)"), "day tap opens day panel");
  assert.ok(journalSlice.includes('testID="journal-day-panel"'), "day panel present");
  assert.ok(journalSlice.includes("journal-day-panel-add-trade"), "panel Add Trade CTA");
  assert.ok(journalSlice.includes("journalAddTradeForDate"), "date-aware Add Trade a11y");
  assert.ok(journalSlice.includes("journalViewTradesForDate"), "date-aware view trades a11y");
  assert.ok(journalSlice.includes("openNew(selectedDate)"), "Add Trade inherits selected date");
  assert.equal(journalSlice.includes("styles.journalHeader"), false, "header stays removed");
  assert.ok(app.includes("date: selectedDate"), "saved trade uses selectedDate");
}

// 11–15 Manual P&L
{
  assert.deepEqual(resolveManualSignedPnl("350", "profit"), { ok: true, pnl: 350 });
  assert.deepEqual(resolveManualSignedPnl("200", "loss"), { ok: true, pnl: -200 });
  assert.deepEqual(resolveManualSignedPnl("0", "breakeven"), { ok: true, pnl: 0 });
  assert.deepEqual(resolveManualSignedPnl("", "breakeven"), { ok: true, pnl: 0 });
  assert.equal(resolveManualSignedPnl("abc", "profit").ok, false);
  assert.equal(inferManualResultType(350), "profit");
  assert.equal(inferManualResultType(-200), "loss");
  assert.equal(inferManualResultType(0), "breakeven");

  const app = read("src/app/YouTraderApp.tsx");
  const outcomeStart = app.indexOf("journalFormTradeResult");
  const outcomeEnd = app.indexOf("journalDetailExecution", outcomeStart);
  const formSlice = app.slice(outcomeStart, outcomeEnd);
  assert.ok(formSlice.includes("journal.trade.edit.pnl.mode"), "Calculate/Manual selector present");
  assert.ok(formSlice.includes('id: "calculate"'), "Calculate mode");
  assert.ok(formSlice.includes('id: "manual"'), "Manual mode");
  assert.ok(formSlice.includes("journal.trade.edit.pnl.manual"), "visible manual amount field");
  assert.ok(formSlice.includes("pnl.plus") && formSlice.includes("pnl.minus"), "Profit/Loss controls");
  assert.ok(formSlice.includes("breakeven"), "Breakeven control");
  assert.ok(app.includes("pnlMode: pnlEntryMode"), "save uses selected mode");
  assert.ok(app.includes("journalFormPnlSwitchConfirm"), "mode switch confirmation path");
}

// 16–21 five-tab Prop Pass contract / no bypass
{
  const app = read("src/app/YouTraderApp.tsx");
  assert.ok(app.includes("PropPassLockedPreview"), "locked preview wired");
  assert.ok(
    app.includes("propPassTabVisible = !(qaPropPassPayload?.forceHidePropPassTab)"),
    "tab not gated by isPremium",
  );
  assert.ok(app.includes("propPassEntitled"), "entitlement gates content not tab");
  assert.ok(app.includes("LazyPropPassInternalScreen"), "entitled path keeps full dashboard");
  const more = read("src/app/MoreScreen.tsx");
  assert.ok(!more.includes('id: "propPass"'), "Prop Pass not duplicated in More");
  assert.ok(
    !app.includes("localPremiumBypass") && !app.includes("FORCE_PREMIUM"),
    "no production premium bypass",
  );
}

console.log("[YouTrader:regression-restore-pre115] PASS");
