type TradeLike = { pnl: number; date?: string };
export type PassProbabilityResult = { probability: number; status: 'EXCELLENT' | 'ON_TRACK' | 'AT_RISK' | 'DANGER'; explanation: string; confidence: 'low' | 'medium' | 'high' };
export function calculatePassProbability({ trades, template }: { trades: TradeLike[]; selectedDate: string; template: { evaluationTarget?: number; dailyLossLimit?: number; maxLossLimit?: number } }): PassProbabilityResult {
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const target = Math.max(1, template.evaluationTarget || 3000);
  const maxLoss = Math.max(1, template.maxLossLimit || 2000);
  const progress = Math.max(0, pnl / target) * 55;
  const drawdown = Math.abs(Math.min(0, pnl));
  const buffer = Math.max(0, 1 - drawdown / maxLoss) * 35;
  const sample = Math.min(10, trades.length / 2);
  const probability = Math.round(Math.max(3, Math.min(98, progress + buffer + sample)));
  const status = probability >= 82 ? 'EXCELLENT' : probability >= 58 ? 'ON_TRACK' : probability >= 32 ? 'AT_RISK' : 'DANGER';
  return { probability, status, explanation: `Based on ${trades.length} logged trades, current P&L, target progress, and drawdown buffer.`, confidence: trades.length >= 25 ? 'high' : trades.length >= 10 ? 'medium' : 'low' };
}
