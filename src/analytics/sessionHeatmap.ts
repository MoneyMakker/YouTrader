type TradeLike = { pnl: number; entryTime?: string | null; exitTime?: string | null; createdAt?: number; date?: string };
export type HourHeatmapCell = { hour: number; label: string; tradeCount: number; pnl: number; winRate: number };
function hourOf(trade: TradeLike) {
  const raw = trade.entryTime || trade.exitTime;
  if (raw && /^\d{1,2}:/.test(raw)) return Math.max(0, Math.min(23, Number(raw.split(':')[0])));
  if (trade.createdAt) return new Date(trade.createdAt).getHours();
  return 9;
}
export function buildSessionHeatmap(trades: TradeLike[]): HourHeatmapCell[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const rows = trades.filter((trade) => hourOf(trade) === hour);
    const wins = rows.filter((trade) => trade.pnl > 0).length;
    return { hour, label: `${String(hour).padStart(2, '0')}:00`, tradeCount: rows.length, pnl: rows.reduce((s, t) => s + t.pnl, 0), winRate: rows.length ? (wins / rows.length) * 100 : 0 };
  });
}
