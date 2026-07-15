#!/usr/bin/env npx tsx
import {
  filterTradesByTimeRange,
  resolveTimeRangeStart,
  statsAnchorDateISO,
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
  { date: "2026-07-01", pnl: 50 },
  { date: "2026-06-01", pnl: 30 },
  { date: "2025-12-15", pnl: -10 },
];

assert(filterTradesByTimeRange(trades, "1D", anchor).length === 1, "1D should include only anchor day");
assert(filterTradesByTimeRange(trades, "7D", anchor).length === 3, "7D should include last 7 calendar days");
assert(filterTradesByTimeRange(trades, "1M", anchor).length === 3, "1M should include last 30 calendar days");
assert(filterTradesByTimeRange(trades, "YTD", anchor).length === 4, "YTD should include trades since Jan 1 of anchor year");
assert(filterTradesByTimeRange(trades, "1Y", anchor).length === 5, "1Y should include last 365 days");
assert(filterTradesByTimeRange(trades, "ALL", anchor).length === 5, "ALL should include every trade");
assert(resolveTimeRangeStart("YTD", anchor) === "2026-01-01", "YTD start must be Jan 1");
assert(statsAnchorDateISO(new Date("2026-07-07T15:00:00")) === anchor, "Anchor date should use local calendar day");

const ranges: StatsTimeRange[] = ["1D", "7D", "1M", "YTD", "1Y", "ALL"];
for (const range of ranges) {
  const filtered = filterTradesByTimeRange(trades, range, anchor);
  const net = filtered.reduce((sum, trade) => sum + trade.pnl, 0);
  console.log(`${range}: trades=${filtered.length} net=${net}`);
}

console.log("\nAll time-range QA scenarios passed.");
