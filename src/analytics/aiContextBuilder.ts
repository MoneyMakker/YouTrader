import { buildUnifiedTradeAnalytics, type UnifiedTradeAnalytics } from "./tradeMetrics";
import type { TradeInput } from "./tradeNormalizer";

export type AIAnalyticsContext = {
  userStats: UnifiedTradeAnalytics["metrics"];
  equityCurveSummary: {
    points: number;
    finalPnl: number;
    maxDrawdown: number;
    latestIsNewHigh: boolean;
  };
  sessionStats: UnifiedTradeAnalytics["sessionStats"];
  symbolStats: UnifiedTradeAnalytics["symbolStats"];
  dayOfWeekStats: UnifiedTradeAnalytics["dayOfWeekStats"];
  recentTrades: Array<{
    date: string;
    instrument: string;
    side: "long" | "short";
    session: string;
    netPnl: number;
    rMultiple: number | null;
    tags: string[];
    mood: string;
  }>;
  journalNotesSummary: {
    notesLogged: number;
    screenshotsLogged: number;
    commonTags: string[];
  };
  confidence: UnifiedTradeAnalytics["metrics"]["confidence"];
};

function topTags(trades: UnifiedTradeAnalytics["trades"]) {
  const counts = new Map<string, number>();
  trades.forEach((trade) => trade.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag]) => tag);
}

export function buildAIAnalyticsContext(input: TradeInput[]): AIAnalyticsContext {
  const analytics = buildUnifiedTradeAnalytics(input);
  const latestPoint = analytics.equityCurve[analytics.equityCurve.length - 1];
  return {
    userStats: analytics.metrics,
    equityCurveSummary: {
      points: analytics.equityCurve.length,
      finalPnl: latestPoint?.cumulativePnl || 0,
      maxDrawdown: analytics.metrics.maxDrawdown,
      latestIsNewHigh: latestPoint?.isNewHigh || false,
    },
    sessionStats: analytics.sessionStats,
    symbolStats: analytics.symbolStats,
    dayOfWeekStats: analytics.dayOfWeekStats,
    recentTrades: analytics.trades.slice(-12).reverse().map((trade) => ({
      date: trade.date,
      instrument: trade.instrument,
      side: trade.side,
      session: trade.session,
      netPnl: trade.netPnl,
      rMultiple: trade.rMultiple,
      tags: trade.tags,
      mood: trade.mood,
    })),
    journalNotesSummary: {
      notesLogged: analytics.trades.filter((trade) => trade.notes.trim()).length,
      screenshotsLogged: analytics.trades.filter((trade) => trade.screenshots.length > 0).length,
      commonTags: topTags(analytics.trades),
    },
    confidence: analytics.metrics.confidence,
  };
}
