import type { Trade } from "../types";
import type { TradePerformanceBreakdown } from "../../api/tradeAnalysis";
import { getTradeTime } from "./stats";
import { safeDateFromISO } from "./dates";

export function roundMetric(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function emptyBreakdown(key: string): TradePerformanceBreakdown {
  return {
    key,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    netPnl: 0,
    avgPnl: 0,
    profitFactor: 0,
    expectancy: 0,
    avgWin: 0,
    avgLoss: 0,
    maxWin: 0,
    maxLoss: 0,
  };
}

export function summarizeTradesForAnalysis(key: string, trades: Trade[]): TradePerformanceBreakdown {
  if (!trades.length) return emptyBreakdown(key);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  return {
    key,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: roundMetric((wins.length / trades.length) * 100),
    netPnl: roundMetric(netPnl),
    avgPnl: roundMetric(netPnl / trades.length),
    profitFactor: roundMetric(grossLoss ? grossWin / grossLoss : grossWin > 0 ? 99 : 0),
    expectancy: roundMetric(netPnl / trades.length),
    avgWin: roundMetric(wins.length ? grossWin / wins.length : 0),
    avgLoss: roundMetric(losses.length ? grossLoss / losses.length : 0),
    maxWin: roundMetric(Math.max(0, ...trades.map((trade) => trade.pnl))),
    maxLoss: roundMetric(Math.min(0, ...trades.map((trade) => trade.pnl))),
  };
}

export function buildAnalysisBreakdown(trades: Trade[], keyFn: (trade: Trade) => string) {
  const groups = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const key = keyFn(trade) || "Unknown";
    groups.set(key, [...(groups.get(key) || []), trade]);
  });
  return [...groups.entries()]
    .map(([key, rows]) => summarizeTradesForAnalysis(key, rows))
    .sort((a, b) => b.trades - a.trades || Math.abs(b.netPnl) - Math.abs(a.netPnl))
    .slice(0, 12);
}

export function dayKeyForTrade(trade: Trade) {
  return safeDateFromISO(trade.date).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function hourKeyForTrade(trade: Trade) {
  const hour = getTradeTime(trade).getHours();
  return `${String(hour).padStart(2, "0")}:00`;
}
