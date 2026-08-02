import { MIN_EDGE_TRADES, RECENT_TREND_MIN_TRADES } from "./presentation";
import { RADAR_MIN_TRADES } from "./performanceRadar";

export type InsightsLearningTarget =
  | "recentTrend"
  | "performanceRadar"
  | "bestEdge"
  | "biggestLeak";

export type InsightsLearningTargetProgress = {
  target: InsightsLearningTarget;
  currentTrades: number;
  requiredTrades: number;
};

type Input = {
  tradeCount: number;
  hasRecentTrend: boolean;
  radarReady: boolean;
  hasBestEdge: boolean;
  hasBiggestLeak: boolean;
};

export function getInsightsLearningState({
  tradeCount,
  hasRecentTrend,
  radarReady,
  hasBestEdge,
  hasBiggestLeak,
}: Input): {
  tradeCount: number;
  isLearning: boolean;
  requiredTrades: number;
  targets: InsightsLearningTarget[];
  targetProgress: InsightsLearningTargetProgress[];
} {
  const targets: InsightsLearningTarget[] = [];
  const belowRecentTrendThreshold = tradeCount < RECENT_TREND_MIN_TRADES;
  const belowEdgeThreshold = tradeCount < MIN_EDGE_TRADES;

  if (!hasRecentTrend && belowRecentTrendThreshold) targets.push("recentTrend");
  if (!radarReady) targets.push("performanceRadar");
  if (!hasBestEdge && belowEdgeThreshold) targets.push("bestEdge");
  if (!hasBiggestLeak && belowEdgeThreshold) targets.push("biggestLeak");

  const targetProgress = targets.map((target) => ({
    target,
    currentTrades: Math.min(tradeCount, targetRequiredTrades(target)),
    requiredTrades: targetRequiredTrades(target),
  }));

  return {
    tradeCount,
    isLearning: targets.length > 0,
    requiredTrades: Math.max(
      !hasRecentTrend ? RECENT_TREND_MIN_TRADES : 0,
      !radarReady ? RADAR_MIN_TRADES : 0,
      !hasBestEdge && belowEdgeThreshold ? MIN_EDGE_TRADES : 0,
      !hasBiggestLeak && belowEdgeThreshold ? MIN_EDGE_TRADES : 0,
    ),
    targets,
    targetProgress,
  };
}

function targetRequiredTrades(target: InsightsLearningTarget): number {
  switch (target) {
    case "performanceRadar":
      return RADAR_MIN_TRADES;
    case "recentTrend":
      return RECENT_TREND_MIN_TRADES;
    case "bestEdge":
    case "biggestLeak":
      return MIN_EDGE_TRADES;
  }
}
