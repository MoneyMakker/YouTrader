import { useMemo } from "react";

export type RiskCoachMode = "evaluation" | "live";
export type RiskCoachFamily = "micro" | "emini";

export type RiskCoachTrade = {
  id: string;
  date: string;
  pnl: number;
  contracts?: number;
};

export type RiskCoachFirm = {
  key: string;
  label: string;
  accountSize: number;
  dailyLossLimit: number;
  maxLossLimit: number;
  evaluationContracts: number;
  liveContracts: number;
  evaluationRiskPct: number;
  liveRiskPct: number;
};

export type RiskCoachSnapshot = {
  status: "CLEAR" | "CAUTION" | "STOP";
  dayPnl: number;
  totalPnl: number;
  dailyLossBuffer: number;
  accountBuffer: number;
  riskBudget: number;
  lossStreak: number;
  recommendedFamily: RiskCoachFamily;
  recommendedContracts: number;
  coachMessage: string;
};

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function buildRiskCoachSnapshot(
  trades: RiskCoachTrade[],
  selectedDate: string,
  firm: RiskCoachFirm,
  mode: RiskCoachMode,
): RiskCoachSnapshot {
  const dayTrades = trades.filter((trade) => trade.date === selectedDate);
  const dayPnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const expectancy = trades.length ? totalPnl / trades.length : 0;
  const avgLoss = Math.max(35, Math.abs(avg(losses.map((trade) => trade.pnl))) || 50);
  const returns = trades.map((trade) => trade.pnl);
  const mean = avg(returns);
  const variance = avg(returns.map((value) => Math.pow(value - mean, 2)));
  const sharpe = variance ? mean / Math.sqrt(variance) : mean > 0 ? 2 : 0;
  const winRate = trades.length ? wins.length / trades.length : 0;
  const consistency = Math.max(0, Math.min(1, winRate * 0.55 + Math.max(0, Math.min(1, sharpe / 2)) * 0.45));
  const dailyLossBuffer = Math.max(0, firm.dailyLossLimit + Math.min(dayPnl, 0));
  const accountBuffer = Math.max(0, firm.maxLossLimit + Math.min(totalPnl, 0));
  const recent = [...trades].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 8);
  let lossStreak = 0;
  for (const trade of recent) {
    if (trade.pnl < 0) lossStreak += 1;
    else break;
  }
  const hardStop = dailyLossBuffer <= 0 || accountBuffer <= 0;
  const riskPct = mode === "live" ? firm.liveRiskPct : firm.evaluationRiskPct;
  const quality = expectancy <= 0 ? 0.42 : consistency >= 0.72 ? 1 : consistency >= 0.55 ? 0.72 : 0.55;
  const streakPenalty = lossStreak >= 3 ? 0.28 : lossStreak === 2 ? 0.48 : lossStreak === 1 ? 0.72 : 1;
  const riskBudget = Math.floor(Math.max(0, Math.min(dailyLossBuffer, accountBuffer) * riskPct * quality * streakPenalty));
  const maxFirmContracts = mode === "live" ? firm.liveContracts : firm.evaluationContracts;
  const microContracts = Math.max(0, Math.min(maxFirmContracts * 10, Math.floor(riskBudget / Math.max(18, avgLoss * 0.32))));
  const eminiContracts = Math.max(0, Math.min(maxFirmContracts, Math.floor(riskBudget / Math.max(180, avgLoss * 3.2))));
  const recommendedFamily: RiskCoachFamily =
    mode === "live" || lossStreak >= 2 || expectancy <= 0 || dailyLossBuffer < firm.dailyLossLimit * 0.55
      ? "micro"
      : eminiContracts >= 1
        ? "emini"
        : "micro";
  const recommendedContracts =
    recommendedFamily === "emini" ? Math.max(1, eminiContracts) : Math.max(1, microContracts || Math.min(2, maxFirmContracts));
  const status = hardStop ? "STOP" : lossStreak >= 2 || dailyLossBuffer < firm.dailyLossLimit * 0.35 || expectancy <= 0 ? "CAUTION" : "CLEAR";
  const coachMessage =
    status === "STOP"
      ? "Stop trading today. Protect the account."
      : status === "CAUTION"
        ? `Reduce size. Recommended ${recommendedContracts} ${recommendedFamily === "emini" ? "E-mini" : "Micro"}.`
        : `You can trade. Recommended ${recommendedContracts} ${recommendedFamily === "emini" ? "E-mini" : "Micro"}.`;

  return {
    status,
    dayPnl,
    totalPnl,
    dailyLossBuffer,
    accountBuffer,
    riskBudget,
    lossStreak,
    recommendedFamily,
    recommendedContracts,
    coachMessage,
  };
}

export function useRiskCoach(
  trades: RiskCoachTrade[],
  selectedDate: string,
  firm: RiskCoachFirm,
  mode: RiskCoachMode,
) {
  return useMemo(
    () => buildRiskCoachSnapshot(trades, selectedDate, firm, mode),
    [trades, selectedDate, firm, mode],
  );
}
