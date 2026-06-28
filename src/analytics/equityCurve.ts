import type { NormalizedTrade } from "./tradeNormalizer";

export type EquityCurvePoint = {
  date: string;
  tradeId: string;
  netPnl: number;
  cumulativePnl: number;
  drawdownFromPeak: number;
  isNewHigh: boolean;
  isWin: boolean;
  isLoss: boolean;
  session: string;
  instrument: string;
};

export function buildNormalizedEquityCurve(trades: NormalizedTrade[]): EquityCurvePoint[] {
  let cumulativePnl = 0;
  let peak = 0;
  return trades.map((trade) => {
    cumulativePnl = Number((cumulativePnl + trade.netPnl).toFixed(2));
    const isNewHigh = cumulativePnl >= peak;
    peak = Math.max(peak, cumulativePnl);
    return {
      date: trade.date,
      tradeId: trade.id,
      netPnl: trade.netPnl,
      cumulativePnl,
      drawdownFromPeak: Number((cumulativePnl - peak).toFixed(2)),
      isNewHigh,
      isWin: trade.isWin,
      isLoss: trade.isLoss,
      session: trade.session,
      instrument: trade.instrument,
    };
  });
}

export function maxDrawdownFromCurve(curve: EquityCurvePoint[]) {
  return curve.reduce((maxDrawdown, point) => Math.min(maxDrawdown, point.drawdownFromPeak), 0);
}
