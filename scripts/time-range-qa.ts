#!/usr/bin/env npx tsx
import {
  filterTradesByTimeRange,
  normalizeTradeDateISO,
  resolveTimeRangeStart,
  statsAnchorDateISO,
  STATS_TIME_RANGES,
  type StatsTimeRange,
} from "../src/analytics/timeRange";

type Trade = { date: string; pnl: number };

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const anchor = "2026-07-07";
const trades: Trade[] = [
  { date: "2026-07-07", pnl: 100 },
  { date: "2026-07-06", pnl: -20 },
  { date: "2026-06-30", pnl: 25 },
  { date: "2026-07-01", pnl: 50 },
  { date: "2026-06-01", pnl: 30 },
  { date: "2025-12-15", pnl: -10 },
  // datetime pollution must still filter by calendar day
  { date: "2026-07-07T23:00:00.000Z", pnl: 5 },
];

assert(normalizeTradeDateISO("2026-08-04T12:00:00.000Z") === "2026-08-04", "normalize strips time");
assert(filterTradesByTimeRange(trades, "1D", anchor).length === 2, "1D includes anchor day (+ datetime twin)");
assert(filterTradesByTimeRange(trades, "7D", anchor).length === 4, "7D = current + previous 6 days");
assert(filterTradesByTimeRange(trades, "2W", anchor).length === 5, "2W = current + previous 13 days");
assert(resolveTimeRangeStart("2W", anchor) === "2026-06-24", "2W start is anchor-13");
assert(filterTradesByTimeRange(trades, "1M", anchor).length === 5, "1M should include last 30 calendar days");
assert(filterTradesByTimeRange(trades, "YTD", anchor).length === 6, "YTD should include trades since Jan 1 of anchor year");
assert(filterTradesByTimeRange(trades, "1Y", anchor).length === 7, "1Y should include last 365 days");
assert(filterTradesByTimeRange(trades, "ALL", anchor).length === 7, "ALL should include every trade");
assert(resolveTimeRangeStart("YTD", anchor) === "2026-01-01", "YTD start must be Jan 1");
assert(statsAnchorDateISO(new Date(2026, 6, 7, 15, 0, 0)) === anchor, "Anchor override uses local calendar day");

// Periods must return distinct subsets for this fixture (except when ranges nest identically)
const counts = Object.fromEntries(
  STATS_TIME_RANGES.map((range) => [range, filterTradesByTimeRange(trades, range, anchor).length]),
) as Record<StatsTimeRange, number>;
assert(counts["1D"] < counts["7D"], "1D subset of 7D");
assert(counts["7D"] < counts["2W"], "7D subset of 2W");
assert(counts["2W"] <= counts["1M"], "2W within or equal 1M window for fixture");
assert(counts["1D"] < counts.ALL, "narrower than ALL");

// Near-midnight / date-only: no +1 day shift on label
assert(normalizeTradeDateISO("2026-08-04") === "2026-08-04", "date-only unchanged");
assert(normalizeTradeDateISO("2026-08-04T04:00:00.000Z") === "2026-08-04", "UTC instant keeps calendar prefix");

for (const range of STATS_TIME_RANGES) {
  const filtered = filterTradesByTimeRange(trades, range, anchor);
  const net = filtered.reduce((sum, trade) => sum + trade.pnl, 0);
  console.log(`${range}: trades=${filtered.length} net=${net}`);
}

assert(STATS_TIME_RANGES.length === 7, "seven periods required");
assert(STATS_TIME_RANGES.join(",") === "1D,7D,2W,1M,YTD,1Y,ALL", "canonical period order");

console.log("\nAll time-range QA scenarios passed.");
