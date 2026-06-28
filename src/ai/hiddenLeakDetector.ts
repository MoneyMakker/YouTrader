type TradeLike = { pnl: number; symbol?: string; mood?: string; tags?: string[] };
export type HiddenLeak = { title: string; impact: string; recommendation: string };
export function detectHiddenLeaks(trades: TradeLike[]): HiddenLeak[] {
  const leaks: HiddenLeak[] = [];
  const losses = trades.filter((t) => t.pnl < 0);
  if (losses.length > trades.length / 2) leaks.push({ title: 'Loss frequency', impact: `${losses.length} losing trades in the sample.`, recommendation: 'Filter lower-quality setups and reduce size until win rate stabilizes.' });
  const moodLosses = losses.filter((t) => /angry|fear|fomo|tilt|stress/i.test(t.mood || '')).length;
  if (moodLosses) leaks.push({ title: 'Mood-linked losses', impact: `${moodLosses} losses include stressed/tilted mood labels.`, recommendation: 'Add a cooldown rule after emotional trades.' });
  return leaks.slice(0, 3);
}
