/**
 * Trading Heatmap — shared Journal source via trade list.
 * Modes answer: when / which session / instrument / setup perform best or worst.
 */

import type { Trade } from "../app/types";
import { sessionBucket } from "./presentation";

export type HeatmapMode = "dayHour" | "weekday" | "session" | "instrument" | "setup";

export type HeatmapCell = {
  key: string;
  label: string;
  pnl: number;
  count: number;
  wins: number;
  winRate: number;
  avg: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function tradeHour(trade: Trade): number | null {
  const raw = String((trade as { time?: string; entryTime?: string }).time || (trade as { entryTime?: string }).entryTime || "");
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function cellKey(trade: Trade, mode: HeatmapMode): string {
  if (mode === "weekday") {
    const d = String(trade.date || "");
    if (!d) return "—";
    const day = new Date(`${d}T12:00:00Z`).getUTCDay();
    return WEEKDAYS[day] || "—";
  }
  if (mode === "session") return sessionBucket(trade);
  if (mode === "instrument") return String(trade.symbol || "—").toUpperCase();
  if (mode === "setup") {
    const setup = String((trade as { setup?: string; setupTag?: string }).setup || (trade as { setupTag?: string }).setupTag || "").trim();
    return setup || "Unlabeled";
  }
  // dayHour
  const d = String(trade.date || "");
  const day = d ? WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()] || "—" : "—";
  const hour = tradeHour(trade);
  if (hour == null) return `${day} · —`;
  return `${day} ${String(hour).padStart(2, "0")}:00`;
}

export function buildTradingHeatmap(trades: Trade[], mode: HeatmapMode): HeatmapCell[] {
  const map = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = cellKey(trade, mode);
    const list = map.get(key) || [];
    list.push(trade);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const pnl = list.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
      const wins = list.filter((t) => (Number(t.pnl) || 0) > 0).length;
      const count = list.length;
      return {
        key,
        label: key,
        pnl,
        count,
        wins,
        winRate: count ? (wins / count) * 100 : 0,
        avg: count ? pnl / count : 0,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

export const HEATMAP_MODE_LABELS: Record<HeatmapMode, string> = {
  dayHour: "Day × Hour",
  weekday: "Weekday",
  session: "Session",
  instrument: "Instrument",
  setup: "Setup",
};
