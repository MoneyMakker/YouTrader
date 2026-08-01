/**
 * Performance Radar — deterministic Journal statistics only.
 * Documented axes + min sample size. No AI claims.
 */

import type { Trade } from "../app/types";
import { calcStats } from "../app/utils/stats";
import { sessionBucket } from "./presentation";

export type RadarAxisKey =
  | "profitability"
  | "consistency"
  | "riskControl"
  | "discipline"
  | "setupQuality"
  | "sessionTiming";

export type PerformanceRadarAxis = {
  key: RadarAxisKey;
  label: string;
  score: number | null;
  valueLabel: string;
  target: string;
  explanation: string;
};

export const RADAR_MIN_TRADES = 5;

export type PerformanceRadarModel = {
  ready: boolean;
  tradeCount: number;
  axes: PerformanceRadarAxis[];
  insufficientMessage: string;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Score sources (all from local journal trades via calcStats / grouping):
 * - Profitability: win rate blended with profit factor
 * - Consistency: fraction of green days
 * - Risk Control: drawdownControl from max drawdown vs P&L
 * - Discipline: inverse of oversized loss share (losses > 1.5× avg loss)
 * - Setup Quality: expectancy normalized vs average |trade|
 * - Session Timing: concentration of P&L in strongest session bucket
 */
export function buildPerformanceRadar(trades: Trade[]): PerformanceRadarModel {
  const tradeCount = trades.length;
  const insufficientMessage = `Log at least ${RADAR_MIN_TRADES} trades to unlock Performance Radar.`;
  if (tradeCount < RADAR_MIN_TRADES) {
    return {
      ready: false,
      tradeCount,
      axes: [],
      insufficientMessage,
    };
  }

  const stats = calcStats(trades);
  const daily = stats.curve.length
    ? null
    : null;
  void daily;
  const greenDays = (() => {
    const byDay = new Map<string, number>();
    for (const trade of trades) {
      const day = String(trade.date || "").slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + (Number(trade.pnl) || 0));
    }
    const days = [...byDay.values()];
    if (!days.length) return 0;
    return (days.filter((v) => v > 0).length / days.length) * 100;
  })();

  const avgAbs = trades.reduce((s, t) => s + Math.abs(Number(t.pnl) || 0), 0) / Math.max(1, tradeCount);
  const oversizedLosses = trades.filter((t) => (Number(t.pnl) || 0) < 0 && Math.abs(Number(t.pnl) || 0) > 1.5 * Math.max(1, Math.abs(stats.avgLoss || avgAbs))).length;
  const discipline = clampScore(100 - (oversizedLosses / tradeCount) * 100);

  const sessionGroups = new Map<string, number>();
  for (const trade of trades) {
    const key = sessionBucket(trade);
    sessionGroups.set(key, (sessionGroups.get(key) || 0) + (Number(trade.pnl) || 0));
  }
  const sessionPnls = [...sessionGroups.values()];
  const bestSession = sessionPnls.length ? Math.max(...sessionPnls) : 0;
  const totalAbs = sessionPnls.reduce((s, v) => s + Math.abs(v), 0) || 1;
  const sessionTiming = clampScore((Math.max(0, bestSession) / totalAbs) * 100 + 40);

  const expectancyScore = avgAbs > 0 ? clampScore(50 + (stats.exp / avgAbs) * 40) : clampScore(stats.wr);
  const profitability = clampScore(stats.wr * 0.55 + Math.min(100, (stats.pf / 2.5) * 100) * 0.45);

  const axes: PerformanceRadarAxis[] = [
    {
      key: "profitability",
      label: "Profitability",
      score: profitability,
      valueLabel: `${stats.wr.toFixed(0)}% WR · PF ${Number.isFinite(stats.pf) ? stats.pf.toFixed(2) : "—"}`,
      target: "55%+ WR",
      explanation: `Win rate ${stats.wr.toFixed(0)}% with profit factor ${Number.isFinite(stats.pf) ? stats.pf.toFixed(2) : "—"}.`,
    },
    {
      key: "consistency",
      label: "Consistency",
      score: clampScore(greenDays),
      valueLabel: `${greenDays.toFixed(0)}% green days`,
      target: "60%+",
      explanation: `${greenDays.toFixed(0)}% of your trading days finished positive.`,
    },
    {
      key: "riskControl",
      label: "Risk Control",
      score: clampScore(stats.drawdownControl),
      valueLabel: `${clampScore(stats.drawdownControl)}`,
      target: "70%+",
      explanation: `Drawdown stayed controlled relative to net P&L (score ${clampScore(stats.drawdownControl)}).`,
    },
    {
      key: "discipline",
      label: "Discipline",
      score: discipline,
      valueLabel: `${discipline}`,
      target: "75%+",
      explanation:
        oversizedLosses === 0
          ? "No oversized losses relative to your average loss size."
          : `${oversizedLosses} of ${tradeCount} trades exceeded 1.5× your average loss.`,
    },
    {
      key: "setupQuality",
      label: "Setup Quality",
      score: expectancyScore,
      valueLabel: `Expectancy ${stats.exp >= 0 ? "+" : "−"}$${Math.abs(stats.exp).toFixed(0)}`,
      target: "Positive",
      explanation: `Average expectancy per trade is ${stats.exp >= 0 ? "+" : "−"}$${Math.abs(stats.exp).toFixed(0)}.`,
    },
    {
      key: "sessionTiming",
      label: "Session Timing",
      score: sessionTiming,
      valueLabel: `${sessionTiming}`,
      target: "Focused",
      explanation: "Measures how concentrated positive results are in your strongest session bucket.",
    },
  ];

  return { ready: true, tradeCount, axes, insufficientMessage };
}
