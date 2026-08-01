import React from "react";
import type { Trade } from "../../app/types";
import { calcStats } from "../../app/utils/stats";
import { StatsMetricDashboard } from "./StatsMetricDashboard";

export function StatsMetrics({
  stats,
  trades,
  consistency,
  isPremium,
}: {
  stats: ReturnType<typeof calcStats>;
  trades: Trade[];
  consistency: number;
  isPremium: boolean;
}) {
  return (
    <StatsMetricDashboard
      stats={stats}
      trades={trades}
      consistency={consistency}
      isPremium={isPremium}
      band="detail"
      showTitle={false}
    />
  );
}
