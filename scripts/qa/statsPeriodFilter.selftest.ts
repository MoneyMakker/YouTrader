/**
 * Stats period filter + journal sync contract (Build 117).
 * Deterministic — no device.
 */
import assert from "node:assert/strict";
import {
  filterTradesByTimeRange,
  normalizeTradeDateISO,
  resolveTimeRangeStart,
  STATS_TIME_RANGES,
  statsAnchorDateISO,
} from "../../src/analytics/timeRange";
import { buildDailySeries, calcStats } from "../../src/app/utils/stats";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

function assertEqualDataset(a: ReturnType<typeof calcStats>, b: ReturnType<typeof calcStats>, label: string) {
  assert.equal(a.pnl, b.pnl, `${label} pnl`);
  assert.equal(a.count, b.count, `${label} count`);
  assert.equal(a.maxDd, b.maxDd, `${label} maxDd`);
  assert.equal(a.wr, b.wr, `${label} wr`);
}

const dashboard = readFileSync(path.join(root, "src/stats/StatsDashboard.tsx"), "utf8");
assert.ok(!dashboard.includes("stats-hero"), "duplicate Net P&L hero card must be removed");
assert.ok(!dashboard.includes("stats.netPnlPeriod"), "netPnlPeriod hero copy must be removed");
assert.ok(!dashboard.includes("stats.heroPositive"), "heroPositive must be removed");
assert.ok(dashboard.includes("STATS_TIME_RANGES"), "period bar uses canonical ranges");
assert.ok(dashboard.includes("stats.periodA11y."), "2W a11y wired");
assert.ok(dashboard.includes("flexBasis: 0"), "equal-width flex selector");
assert.ok(!/flexWrap:\s*"wrap"/.test(dashboard.match(/periodRow:[\s\S]*?\},/)?.[0] || ""), "period row must not wrap");

assert.deepEqual([...STATS_TIME_RANGES], ["1D", "7D", "2W", "1M", "YTD", "1Y", "ALL"]);

const anchor = "2026-08-04";
assert.equal(resolveTimeRangeStart("2W", anchor), "2026-07-22");
assert.equal(statsAnchorDateISO(new Date(2026, 7, 4, 23, 30, 0)), "2026-08-04");

type T = { id: string; date: string; pnl: number; symbol?: string; direction?: string; notes?: string };
let journal: T[] = [
  { id: "a", date: "2026-08-04", pnl: 200, symbol: "MES", direction: "LONG", notes: "" },
  { id: "b", date: "2026-08-01", pnl: 100, symbol: "MES", direction: "LONG", notes: "" },
  { id: "c", date: "2026-07-20", pnl: -50, symbol: "MNQ", direction: "SHORT", notes: "" },
];

function statsFor(range: (typeof STATS_TIME_RANGES)[number]) {
  const filtered = filterTradesByTimeRange(journal, range, anchor);
  const stats = calcStats(filtered as any);
  const daily = buildDailySeries(filtered as any);
  return { filtered, stats, daily };
}

const all = statsFor("ALL");
const d1 = statsFor("1D");
const d7 = statsFor("7D");
const d2w = statsFor("2W");

assert.equal(d1.filtered.length, 1);
assert.equal(d1.stats.pnl, 200);
assert.equal(d7.filtered.length, 2);
assert.equal(d7.stats.pnl, 300);
assert.equal(d2w.filtered.length, 2);
assert.equal(all.filtered.length, 3);
assert.equal(all.stats.pnl, 250);

// Equity curve + metrics share filtered set
assert.deepEqual(
  d7.daily.map((x) => x.label),
  ["2026-08-01", "2026-08-04"],
);
assertEqualDataset(d7.stats, calcStats(d7.filtered as any), "metrics==filtered");

// CREATE
journal = [...journal, { id: "d", date: "2026-08-04", pnl: 50, symbol: "MES", direction: "LONG", notes: "" }];
const afterCreate = statsFor("1D");
assert.equal(afterCreate.stats.pnl, 250);
assert.equal(afterCreate.filtered.length, 2);
assert.equal(afterCreate.daily.length, 1);

// EDIT (replace pnl once)
journal = journal.map((t) => (t.id === "d" ? { ...t, pnl: 80 } : t));
const afterEdit = statsFor("1D");
assert.equal(afterEdit.stats.pnl, 280);
assert.equal(afterEdit.filtered.length, 2);

// Date move out of 1D
journal = journal.map((t) => (t.id === "d" ? { ...t, date: "2026-07-10" } : t));
const afterMove = statsFor("1D");
assert.equal(afterMove.stats.pnl, 200);
assert.equal(statsFor("ALL").filtered.length, 4);

// DELETE
journal = journal.filter((t) => t.id !== "a");
const afterDelete = statsFor("ALL");
assert.equal(afterDelete.stats.pnl, 100 + -50 + 80);
assert.ok(!afterDelete.daily.some((d) => d.label === "2026-08-04" && d.value === 200));

// Timezone / date-only regression — chart label is YYYY-MM-DD prefix, no UTC +1
assert.equal(normalizeTradeDateISO("2026-08-04T22:00:00.000Z"), "2026-08-04");
const series = buildDailySeries([{ date: "2026-08-04T22:00:00.000Z", pnl: 10, notes: "" } as any]);
assert.deepEqual(series.map((s) => s.label), ["2026-08-04"]);

console.log("statsPeriodFilter.selftest PASS");
