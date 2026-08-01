import React from "react";
import type { Trade } from "../../app/types";
import { calcStats } from "../../app/utils/stats";
import type { TradingRadarAxis } from "./radarAxes";
import { StatsEquitySection } from "./StatsEquitySection";
import { StatsPerformanceRadar } from "./StatsPerformanceRadar";
import { StatsSessionHeatmap } from "./StatsSessionHeatmap";

/** Equity + radar + session heatmap — presentation only. */
export function StatsCharts({
  trades,
  stats,
  axes,
  isPremium,
  onRadarUpgrade,
}: {
  trades: Trade[];
  stats: ReturnType<typeof calcStats>;
  axes: TradingRadarAxis[];
  isPremium: boolean;
  onRadarUpgrade: () => void;
}) {
  return (
    <>
      <StatsEquitySection trades={trades} stats={stats} />
      <StatsPerformanceRadar axes={axes} isPremium={isPremium} onUpgrade={onRadarUpgrade} />
      <StatsSessionHeatmap trades={trades} />
    </>
  );
}
