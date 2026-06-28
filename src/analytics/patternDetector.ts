type TradeLike = { pnl: number; symbol?: string; mood?: string; tags?: string[]; date?: string };
export type PatternInsight = { title: string; detail: string; tone: 'green' | 'purple' | 'red' };
export type PatternDetectionResult = { strengths: PatternInsight[]; risks: PatternInsight[]; opportunity: PatternInsight };
export function detectTradingPatterns(trades: TradeLike[]): PatternDetectionResult {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf = grossLoss ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const bestSymbol = [...new Set(trades.map((t) => t.symbol || 'Unknown'))]
    .map((symbol) => ({ symbol, pnl: trades.filter((t) => (t.symbol || 'Unknown') === symbol).reduce((s, t) => s + t.pnl, 0) }))
    .sort((a, b) => b.pnl - a.pnl)[0];
  const strengths: PatternInsight[] = [
    { title: bestSymbol?.symbol ? `Best instrument: ${bestSymbol.symbol}` : 'Instrument edge building', detail: bestSymbol ? `Net P&L ${bestSymbol.pnl.toFixed(0)} on this symbol.` : 'Log more trades to reveal instrument edge.', tone: 'green' },
    { title: pf >= 1 ? 'Positive payoff profile' : 'Payoff profile needs work', detail: `Profit factor is ${pf.toFixed(2)} across ${trades.length} trades.`, tone: pf >= 1 ? 'green' : 'purple' },
  ];
  const risks: PatternInsight[] = [
    { title: losses.length > wins.length ? 'Loss frequency pressure' : 'Losses contained', detail: `${losses.length} losses vs ${wins.length} wins in the selected sample.`, tone: losses.length > wins.length ? 'red' : 'purple' },
    { title: grossLoss > grossWin ? 'Gross losses exceed wins' : 'Gross wins lead losses', detail: `Gross wins ${grossWin.toFixed(0)}, gross losses ${grossLoss.toFixed(0)}.`, tone: grossLoss > grossWin ? 'red' : 'green' },
  ];
  return { strengths, risks, opportunity: risks[0] || strengths[0] };
}
