import { buildNormalizedEquityCurve, maxDrawdownFromCurve, type EquityCurvePoint } from "./equityCurve";
import { confidenceForSampleSize, normalizeTradesForAnalytics, type MetricConfidence, type NormalizedTrade, type TradeInput } from "./tradeNormalizer";

export type OfficialTradeMetrics = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number | null;
  lossRate: number | null;
  breakevenRate: number | null;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  profitFactor: number | null;
  profitFactorLabel?: string;
  averageWin: number;
  averageLoss: number;
  averageWinLossRatio: number | null;
  expectancy: number | null;
  rExpectancy: number | null;
  maxDrawdown: number;
  recoveryFactor: number | null;
  stabilityScore: number | null;
  consistency: number;
  riskControl: number;
  tradingScore: number;
  confidence: MetricConfidence;
};

export type GroupMetrics = {
  key: string;
  trades: number;
  pnl: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  averageR: number | null;
  confidence: MetricConfidence;
};

export type UnifiedTradeAnalytics = {
  trades: NormalizedTrade[];
  equityCurve: EquityCurvePoint[];
  metrics: OfficialTradeMetrics;
  sessionStats: GroupMetrics[];
  symbolStats: GroupMetrics[];
  dayOfWeekStats: GroupMetrics[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

function dailyPnlValues(trades: NormalizedTrade[]) {
  const byDate = new Map<string, number>();
  trades.forEach((trade) => byDate.set(trade.date, (byDate.get(trade.date) || 0) + trade.netPnl));
  return [...byDate.values()];
}

function consistencyScore(trades: NormalizedTrade[], maxDrawdown: number) {
  if (!trades.length) return 0;
  const daily = dailyPnlValues(trades);
  if (daily.length <= 1) return 62;
  const greenRate = (daily.filter((value) => value > 0).length / daily.length) * 100;
  const avgAbs = daily.reduce((sum, value) => sum + Math.abs(value), 0) / daily.length || 1;
  const stdev = standardDeviation(daily);
  const smoothness = Math.max(0, 100 - (stdev / avgAbs) * 42);
  const oversizedDependency = Math.max(...daily.map((value) => Math.abs(value))) / Math.max(1, daily.reduce((sum, value) => sum + Math.abs(value), 0));
  const dependencyPenalty = oversizedDependency > 0.55 ? 18 : oversizedDependency > 0.4 ? 9 : 0;
  const drawdownPenalty = Math.min(20, Math.abs(maxDrawdown) / Math.max(1, avgAbs * daily.length) * 35);
  return round(Math.max(0, Math.min(100, greenRate * 0.45 + smoothness * 0.45 + Math.min(10, trades.length / 3) - dependencyPenalty - drawdownPenalty)), 0);
}

function currentLossStreak(trades: NormalizedTrade[]) {
  let streak = 0;
  for (let index = trades.length - 1; index >= 0; index -= 1) {
    if (trades[index].isLoss) streak += 1;
    else if (!trades[index].isBreakeven) break;
  }
  return streak;
}

function riskControlScore(trades: NormalizedTrade[], metrics: Pick<OfficialTradeMetrics, "averageLoss" | "maxDrawdown" | "netPnl">) {
  if (!trades.length) return 0;
  const daily = dailyPnlValues(trades);
  const maxLossDay = Math.abs(Math.min(0, ...daily));
  const avgAbsLoss = Math.abs(metrics.averageLoss);
  const lossStreakPenalty = Math.min(24, currentLossStreak(trades) * 8);
  const drawdownPressure = Math.min(28, Math.abs(metrics.maxDrawdown) / Math.max(1, Math.abs(metrics.netPnl) + Math.abs(metrics.maxDrawdown)) * 45);
  const lossDayPressure = Math.min(22, maxLossDay / Math.max(1, avgAbsLoss * 3) * 18);
  const missingRiskPenalty = trades.filter((trade) => trade.riskAmount == null).length / trades.length > 0.5 ? 14 : 0;
  return round(Math.max(0, Math.min(100, 100 - lossStreakPenalty - drawdownPressure - lossDayPressure - missingRiskPenalty)), 0);
}

function groupBy(trades: NormalizedTrade[], keyFn: (trade: NormalizedTrade) => string): GroupMetrics[] {
  const groups = new Map<string, NormalizedTrade[]>();
  trades.forEach((trade) => {
    const key = keyFn(trade);
    groups.set(key, [...(groups.get(key) || []), trade]);
  });
  return [...groups.entries()]
    .map(([key, group]) => {
      const analysis = buildUnifiedTradeAnalytics(group, false, false);
      return {
        key,
        trades: group.length,
        pnl: analysis.metrics.netPnl,
        winRate: analysis.metrics.winRate,
        profitFactor: analysis.metrics.profitFactor,
        expectancy: analysis.metrics.expectancy,
        averageR: analysis.metrics.rExpectancy,
        confidence: confidenceForSampleSize(group.length),
      };
    })
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl) || b.trades - a.trades);
}

export function buildUnifiedTradeAnalytics(input: TradeInput[] | NormalizedTrade[], shouldNormalize = true, includeGroups = true): UnifiedTradeAnalytics {
  const trades = shouldNormalize ? normalizeTradesForAnalytics(input as TradeInput[]) : input as NormalizedTrade[];
  const totalTrades = trades.length;
  const wins = trades.filter((trade) => trade.isWin);
  const losses = trades.filter((trade) => trade.isLoss);
  const breakevens = trades.filter((trade) => trade.isBreakeven);
  const grossProfit = round(wins.reduce((sum, trade) => sum + trade.netPnl, 0));
  const grossLoss = round(Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0)));
  const netPnl = round(grossProfit - grossLoss);
  const winRate = totalTrades ? round((wins.length / totalTrades) * 100) : null;
  const lossRate = totalTrades ? round((losses.length / totalTrades) * 100) : null;
  const breakevenRate = totalTrades ? round((breakevens.length / totalTrades) * 100) : null;
  const averageWin = wins.length ? round(grossProfit / wins.length) : 0;
  const averageLoss = losses.length ? round(grossLoss / losses.length) : 0;
  const profitFactor = grossLoss ? round(grossProfit / grossLoss) : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const averageWinLossRatio = averageLoss ? round(averageWin / averageLoss) : averageWin ? Number.POSITIVE_INFINITY : null;
  const expectancy = totalTrades && winRate != null && lossRate != null
    ? round((winRate / 100) * averageWin - (lossRate / 100) * averageLoss)
    : null;
  const rValues = trades.map((trade) => trade.rMultiple).filter((value): value is number => value != null && Number.isFinite(value));
  const rExpectancy = rValues.length ? round(rValues.reduce((sum, value) => sum + value, 0) / rValues.length) : null;
  const equityCurve = buildNormalizedEquityCurve(trades);
  const maxDrawdown = round(maxDrawdownFromCurve(equityCurve));
  const recoveryFactor = maxDrawdown < 0 ? round(netPnl / Math.abs(maxDrawdown)) : netPnl > 0 ? Number.POSITIVE_INFINITY : null;
  const daily = dailyPnlValues(trades);
  const avgDaily = daily.length ? daily.reduce((sum, value) => sum + value, 0) / daily.length : 0;
  const dailyStdev = standardDeviation(daily);
  const stabilityScore = daily.length >= 3 && dailyStdev > 0 ? round(avgDaily / dailyStdev) : null;
  const consistency = consistencyScore(trades, maxDrawdown);
  const riskControl = riskControlScore(trades, { averageLoss, maxDrawdown, netPnl });
  const expectancyScore = expectancy == null ? 0 : Math.max(0, Math.min(100, expectancy > 0 ? 55 + Math.min(35, expectancy / Math.max(1, averageWin || expectancy) * 45) : 45 + Math.max(-45, expectancy / Math.max(1, averageLoss || Math.abs(expectancy)) * 45)));
  const profitabilityScore = Math.max(0, Math.min(100, profitFactor === Number.POSITIVE_INFINITY ? 95 : ((profitFactor || 0) / 2.2) * 100));
  const disciplineScore = Math.max(0, Math.min(100, 100 - currentLossStreak(trades) * 10));
  const sampleConfidence = confidenceForSampleSize(totalTrades);
  const sampleMultiplier = sampleConfidence === "low" ? 0.72 : sampleConfidence === "medium" ? 0.88 : 1;
  const tradingScore = round((profitabilityScore * 0.25 + riskControl * 0.25 + consistency * 0.2 + expectancyScore * 0.15 + disciplineScore * 0.15) * sampleMultiplier, 0);

  const metrics: OfficialTradeMetrics = {
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakevens.length,
    winRate,
    lossRate,
    breakevenRate,
    grossProfit,
    grossLoss,
    netPnl,
    profitFactor,
    profitFactorLabel: profitFactor === Number.POSITIVE_INFINITY ? "No losses yet" : undefined,
    averageWin,
    averageLoss,
    averageWinLossRatio,
    expectancy,
    rExpectancy,
    maxDrawdown,
    recoveryFactor,
    stabilityScore,
    consistency,
    riskControl,
    tradingScore,
    confidence: sampleConfidence,
  };

  return {
    trades,
    equityCurve,
    metrics,
    sessionStats: includeGroups ? groupBy(trades, (trade) => trade.session) : [],
    symbolStats: includeGroups ? groupBy(trades, (trade) => trade.instrument) : [],
    dayOfWeekStats: includeGroups ? groupBy(trades, (trade) => trade.dayOfWeek) : [],
  };
}

export function infinitySafeMetric(value: number | null, fallback = 0) {
  if (value == null) return fallback;
  if (value === Number.POSITIVE_INFINITY) return 99;
  return value;
}

/** UI drawdown-control score used by Stats radar, Trading Score, and AI payloads. */
export function drawdownControlFromMetrics(netPnl: number, maxDrawdown: number) {
  const absDrawdown = Math.abs(maxDrawdown);
  return netPnl > 0
    ? Math.max(15, Math.min(100, 100 - (absDrawdown / Math.max(1, Math.abs(netPnl) + absDrawdown)) * 100))
    : Math.max(10, 100 - absDrawdown / 10);
}
