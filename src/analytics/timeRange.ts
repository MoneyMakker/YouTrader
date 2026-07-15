import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type StatsTimeRange = "1D" | "7D" | "1M" | "YTD" | "1Y" | "ALL";

export const STATS_TIME_RANGES: readonly StatsTimeRange[] = ["1D", "7D", "1M", "YTD", "1Y", "ALL"];

export const DEFAULT_STATS_TIME_RANGE: StatsTimeRange = "1M";

const STORAGE_KEY = "stats-time-range-v1";

export type TradeDateLike = { date: string };

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

export function statsAnchorDateISO(reference = new Date()): string {
  return formatISODate(reference);
}

/** Inclusive rolling/calendar window ending on anchorDate (local calendar dates). */
export function resolveTimeRangeStart(range: StatsTimeRange, anchorDateISO: string): string | null {
  if (range === "ALL") return null;
  if (range === "1D") return anchorDateISO;
  if (range === "7D") return addCalendarDays(anchorDateISO, -6);
  if (range === "1M") return addCalendarDays(anchorDateISO, -29);
  if (range === "1Y") return addCalendarDays(anchorDateISO, -364);
  if (range === "YTD") return `${parseISODate(anchorDateISO).getFullYear()}-01-01`;
  return null;
}

export function filterTradesByTimeRange<T extends TradeDateLike>(
  trades: T[],
  range: StatsTimeRange,
  anchorDateISO: string = statsAnchorDateISO(),
): T[] {
  if (range === "ALL") return trades;
  if (range === "1D") return trades.filter((trade) => trade.date === anchorDateISO);
  const start = resolveTimeRangeStart(range, anchorDateISO);
  if (!start) return trades;
  return trades.filter((trade) => trade.date >= start && trade.date <= anchorDateISO);
}

export function statsTimeRangeToLegacyPeriod(range: StatsTimeRange): "day" | "week" | "month" | "year" {
  if (range === "1D") return "day";
  if (range === "7D") return "week";
  if (range === "1M") return "month";
  return "year";
}

type StatsTimeRangeContextValue = {
  range: StatsTimeRange;
  setRange: (range: StatsTimeRange) => void;
  anchorDate: string;
};

const StatsTimeRangeContext = createContext<StatsTimeRangeContextValue | null>(null);

export function StatsTimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<StatsTimeRange>(DEFAULT_STATS_TIME_RANGE);
  const anchorDate = statsAnchorDateISO();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value && (STATS_TIME_RANGES as readonly string[]).includes(value)) {
          setRangeState(value as StatsTimeRange);
        }
      })
      .catch(() => {});
  }, []);

  const setRange = useCallback((next: StatsTimeRange) => {
    setRangeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ range, setRange, anchorDate }), [range, setRange, anchorDate]);

  return React.createElement(StatsTimeRangeContext.Provider, { value }, children);
}

export function useStatsTimeRange() {
  const ctx = useContext(StatsTimeRangeContext);
  if (!ctx) throw new Error("useStatsTimeRange must be used within StatsTimeRangeProvider");
  return ctx;
}

export function useFilteredTrades<T extends TradeDateLike>(trades: T[]): T[] {
  const { range, anchorDate } = useStatsTimeRange();
  return useMemo(() => filterTradesByTimeRange(trades, range, anchorDate), [trades, range, anchorDate]);
}
