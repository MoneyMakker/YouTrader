export type TradingScoreResult = {
  score: number;
  grade: string;
  percentileLabel: string;
  strengths: string[];
  weaknesses: string[];
};
export function calculateTradingScore(input: {
  winRate: number;
  profitFactor: number;
  expectancy: number;
  consistency: number;
  riskControl: number;
  recoveryFactor: number;
  maxDrawdown: number;
  avgWinLossRatio: number;
  tradeCount: number;
}): TradingScoreResult {
  const pfScore = Math.min(100, Math.max(0, input.profitFactor / 2.2 * 100));
  const expectancyScore = input.expectancy >= 0 ? Math.min(100, 55 + Math.abs(input.expectancy) / 8) : Math.max(0, 45 + input.expectancy / 8);
  const recoveryScore = Math.min(100, Math.max(0, input.recoveryFactor / 3 * 100));
  const sample = Math.min(100, input.tradeCount / 20 * 100);
  const score = Math.round(
    input.winRate * 0.18 + pfScore * 0.2 + expectancyScore * 0.18 + input.consistency * 0.16 + input.riskControl * 0.18 + recoveryScore * 0.06 + sample * 0.04,
  );
  const grade = score >= 85 ? 'A+' : score >= 75 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
  const strengths = [
    input.winRate >= 55 ? 'Strong win rate' : '',
    input.profitFactor >= 1.4 ? 'Positive profit factor' : '',
    input.consistency >= 65 ? 'Stable daily execution' : '',
    input.riskControl >= 70 ? 'Controlled drawdown' : '',
  ].filter(Boolean);
  const weaknesses = [
    input.profitFactor < 1 ? 'Improve loss control' : '',
    input.expectancy < 0 ? 'Fix negative expectancy' : '',
    input.consistency < 55 ? 'Reduce volatility between trading days' : '',
    input.riskControl < 55 ? 'Protect drawdown buffer' : '',
  ].filter(Boolean);
  return { score: Math.max(0, Math.min(100, score)), grade, percentileLabel: `Top ${Math.max(5, 100 - score)}%`, strengths, weaknesses };
}
