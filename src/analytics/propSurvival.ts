export function calculatePropSurvival(input: { consistency: number; drawdown: number; profitFactor?: number; winRate?: number; dayPnl: number; dailyRemaining?: number; accountRemaining?: number; dailyLossLimit?: number; maxLossLimit?: number; expectancy?: number; [key: string]: unknown }) {
  const drawdownPenalty = Math.min(35, Math.abs(input.drawdown) / 250);
  const dayPenalty = input.dayPnl < 0 ? Math.min(18, Math.abs(input.dayPnl) / 150) : 0;
  const pfBoost = Math.min(20, Math.max(0, (input.profitFactor || 0) - 1) * 14);
  const probability = Math.round(Math.max(5, Math.min(98, input.consistency * 0.34 + (input.winRate || 0) * 0.28 + 30 + pfBoost - drawdownPenalty - dayPenalty)));
  return {
    probability,
    topRisk: drawdownPenalty > 12 ? 'Drawdown buffer is the main risk.' : input.dayPnl < 0 ? 'Today is reducing the daily buffer.' : 'Overtrading after green sessions.',
    biggestAdvantage: (input.profitFactor || 0) >= 1.2 ? 'Current payoff profile supports the plan.' : 'Discipline and position sizing can quickly improve survival.',
    recommendedAction: probability >= 75 ? 'Keep size fixed and protect the buffer.' : 'Reduce size, stop after rule breaks, and trade only A setups.',
  };
}
