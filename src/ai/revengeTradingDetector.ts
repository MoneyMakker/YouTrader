type TradeLike = { pnl: number; date?: string };
export type RevengeTradingResult = { detected: boolean; severity: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string; recommendation: string };
export function detectRevengeTrading({ trades, selectedDate, dangerMode }: { trades: TradeLike[]; selectedDate: string; dangerMode?: boolean }): RevengeTradingResult {
  const today = trades.filter((t) => t.date === selectedDate);
  const losses = today.filter((t) => t.pnl < 0).length;
  const detected = Boolean(dangerMode || losses >= 2 || today.length >= 5);
  const severity = dangerMode || losses >= 3 ? 'HIGH' : detected ? 'MEDIUM' : 'LOW';
  return { detected, severity, reason: detected ? `${today.length} trades today with ${losses} losses suggests elevated emotional risk.` : 'No clear revenge-trading pattern in the selected day.', recommendation: detected ? 'Pause, review screenshots/notes, and do not increase size after losses.' : 'Keep following the checklist and fixed risk.' };
}
