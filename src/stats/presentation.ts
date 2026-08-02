/**
 * Stats presentation helpers — deterministic from journal stats only.
 */

import type { Trade } from "../app/types";

export type StatsPeriodId = "1D" | "7D" | "1M" | "YTD" | "1Y" | "ALL";

export type StatsEdgeLeak = {
  title: string;
  subtitle: string;
  pnl: number;
  winRate: number;
  tradeCount: number;
  insight: string;
} | null;

export const MIN_EDGE_TRADES = 5;
export const RECENT_TREND_MIN_TRADES = 6;

export function sessionBucket(trade: Trade): string {
  const raw = String(trade.entryTime || trade.exitTime || "").trim();
  let hour = Number(raw.slice(0, 2));
  if (!Number.isFinite(hour) || raw.length < 2) {
    const created = Number((trade as { createdAt?: number }).createdAt);
    if (Number.isFinite(created) && created > 0) {
      hour = new Date(created).getUTCHours();
    } else {
      return "Unspecified session";
    }
  }
  if (hour >= 9 && hour < 12) return "New York AM";
  if (hour >= 12 && hour < 16) return "New York PM";
  return "Other session";
}

export function groupTradesByKey(
  trades: Trade[],
  keyFn: (t: Trade) => string,
): Array<{ key: string; trades: Trade[]; pnl: number; wins: number; count: number; winRate: number; avg: number }> {
  const map = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = keyFn(trade) || "Other";
    const list = map.get(key) || [];
    list.push(trade);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const pnl = list.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
      const wins = list.filter((t) => (Number(t.pnl) || 0) > 0).length;
      const count = list.length;
      return {
        key,
        trades: list,
        pnl,
        wins,
        count,
        winRate: count ? (wins / count) * 100 : 0,
        avg: count ? pnl / count : 0,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

export function deriveBestEdge(trades: Trade[]): StatsEdgeLeak {
  if (trades.length < MIN_EDGE_TRADES) return null;
  const byInstrumentSession = groupTradesByKey(
    trades,
    (t) => `${String(t.symbol || "—").toUpperCase()} · ${sessionBucket(t)}`,
  ).filter((row) => row.count >= MIN_EDGE_TRADES);
  const best = byInstrumentSession[0];
  if (!best || best.pnl <= 0) return null;
  return {
    title: "Best Edge",
    subtitle: best.key,
    pnl: best.pnl,
    winRate: best.winRate,
    tradeCount: best.count,
    insight: `Your strongest results appear in ${best.key}.`,
  };
}

export function deriveBiggestLeak(trades: Trade[]): StatsEdgeLeak {
  if (trades.length < MIN_EDGE_TRADES) return null;
  // Trade ordinal within calendar day (1st/2nd/3rd+)
  const byDay = new Map<string, Trade[]>();
  for (const trade of [...trades].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const day = String(trade.date || "").slice(0, 10);
    const list = byDay.get(day) || [];
    list.push(trade);
    byDay.set(day, list);
  }
  const ordinalBuckets = new Map<string, Trade[]>();
  for (const list of byDay.values()) {
    list.forEach((trade, index) => {
      const label =
        index === 0 ? "First trade of the day" : index === 1 ? "Second trade of the day" : "Third+ trade of the day";
      const bucket = ordinalBuckets.get(label) || [];
      bucket.push(trade);
      ordinalBuckets.set(label, bucket);
    });
  }
  const ranked = [...ordinalBuckets.entries()]
    .map(([key, list]) => {
      const pnl = list.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
      const wins = list.filter((t) => (Number(t.pnl) || 0) > 0).length;
      const count = list.length;
      return { key, pnl, winRate: count ? (wins / count) * 100 : 0, count };
    })
    .filter((row) => row.count >= 3)
    .sort((a, b) => a.pnl - b.pnl);
  const worst = ranked[0];
  if (!worst || worst.pnl >= 0) return null;
  return {
    title: "Biggest Leak",
    subtitle: worst.key,
    pnl: worst.pnl,
    winRate: worst.winRate,
    tradeCount: worst.count,
    insight: `Performance weakens on ${worst.key.toLowerCase()}.`,
  };
}

export function formatStatsMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}

export function formatStatsPct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatStatsRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (!Number.isFinite(value) || value > 99) return "∞";
  return value.toFixed(2);
}

export function performanceStateLabel(pnl: number, tradeCount: number): string {
  if (tradeCount <= 0) return "No trades yet";
  if (pnl > 0) return "Performance improving";
  if (pnl < 0) return "Protect the next session";
  return "Flat period";
}

export function deriveRecentTrend(trades: Trade[]): {
  pnlDelta: string;
  wrDelta: string;
  tradeDelta: string;
  summary: string;
} | null {
  if (trades.length < RECENT_TREND_MIN_TRADES) return null;
  const ordered = [...trades].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const mid = Math.floor(ordered.length / 2);
  const prev = ordered.slice(0, mid);
  const curr = ordered.slice(mid);
  if (prev.length < 3 || curr.length < 3) return null;
  const prevPnl = prev.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const currPnl = curr.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const prevWr = prev.filter((t) => (Number(t.pnl) || 0) > 0).length / prev.length;
  const currWr = curr.filter((t) => (Number(t.pnl) || 0) > 0).length / curr.length;
  const pnlPct = prevPnl === 0 ? (currPnl === 0 ? 0 : 100) : ((currPnl - prevPnl) / Math.abs(prevPnl)) * 100;
  const wrPts = (currWr - prevWr) * 100;
  const tradePct = ((curr.length - prev.length) / Math.max(1, prev.length)) * 100;
  const summary =
    currPnl > prevPnl && curr.length <= prev.length
      ? "Fewer trades produced better results."
      : currPnl > prevPnl
        ? "Results improved versus the previous half of this period."
        : "Results softened versus the previous half of this period.";
  const fmt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(0)}%`;
  return {
    pnlDelta: fmt(pnlPct),
    wrDelta: fmt(wrPts),
    tradeDelta: fmt(tradePct),
    summary,
  };
}
