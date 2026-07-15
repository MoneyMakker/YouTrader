type TradeLike = { pnl: number; date?: string };
export type RevengeTradingResult = { detected: boolean; severity: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string; recommendation: string };
export function detectRevengeTrading({ trades, selectedDate, dangerMode }: { trades: TradeLike[]; selectedDate: string; dangerMode?: boolean }): RevengeTradingResult {
  const today = trades.filter((t) => t.date === selectedDate);
  const losses = today.filter((t) => t.pnl < 0).length;

  if (today.length === 0) {
    const recent = trades.slice(-8);
    const recentLosses = recent.filter((t) => t.pnl < 0).length;
    const lossStreak = recentLosses >= 3;
    const detected = lossStreak || Boolean(dangerMode && recent.length >= 3);
    const severity = lossStreak || (dangerMode && recent.length >= 5) ? "HIGH" : detected ? "MEDIUM" : "LOW";
    return {
      detected,
      severity,
      reason: detected
        ? `Recent journal shows ${recentLosses} losses across the last ${recent.length} trades — emotional risk is based on recent behavior, not today.`
        : "No clear revenge-trading pattern in recent journal behavior.",
      recommendation: detected
        ? "Pause, review screenshots/notes, and do not increase size after losses."
        : "Keep following the checklist and fixed risk.",
    };
  }

  const detected = Boolean(dangerMode || losses >= 2 || today.length >= 5);
  const severity = dangerMode || losses >= 3 ? "HIGH" : detected ? "MEDIUM" : "LOW";
  return {
    detected,
    severity,
    reason: detected
      ? `${today.length} trades today with ${losses} losses suggests elevated emotional risk.`
      : "No clear revenge-trading pattern in the selected day.",
    recommendation: detected
      ? "Pause, review screenshots/notes, and do not increase size after losses."
      : "Keep following the checklist and fixed risk.",
  };
}
