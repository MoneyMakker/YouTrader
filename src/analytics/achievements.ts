type TradeLike = {
  date?: string;
  pnl?: number;
  r?: number;
  riskReward?: number;
  mistake?: string;
  notes?: string;
};

export type Achievement = {
  id: string;
  title: string;
  condition: string;
  category: string;
  progress: number;
  target: number;
  progressLabel: string;
  metricLabel: string;
  unlocked: boolean;
  status: "unlocked" | "next_target" | "locked";
};
export type TraderLevel = { title: string; phrase: string; score: number; topLabel: string; nextLevel?: string; nextAction?: string };

function formatProgress(progress: number, target: number) {
  return `${Math.min(Math.round(progress), target)} / ${target}`;
}

function achievement(id: string, title: string, condition: string, category: string, progress: number, target: number): Achievement {
  const unlocked = progress >= target;
  return {
    id,
    title,
    condition,
    category,
    progress,
    target,
    progressLabel: formatProgress(progress, target),
    metricLabel: condition,
    unlocked,
    status: unlocked ? "unlocked" : progress >= target * 0.55 ? "next_target" : "locked",
  };
}

function countGreenDays(trades: TradeLike[]) {
  const byDate = new Map<string, number>();
  trades.forEach((trade) => {
    if (!trade.date) return;
    byDate.set(trade.date, (byDate.get(trade.date) || 0) + (trade.pnl || 0));
  });
  return [...byDate.values()].filter((pnl) => pnl > 0).length;
}

function countGreenWeeks(trades: TradeLike[]) {
  const byWeek = new Map<string, number>();
  trades.forEach((trade) => {
    if (!trade.date) return;
    const date = new Date(`${trade.date}T00:00:00`);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) || 0) + (trade.pnl || 0));
  });
  return [...byWeek.values()].filter((pnl) => pnl > 0).length;
}

function largestR(trades: TradeLike[]) {
  return Math.max(
    0,
    ...trades.map((trade) => {
      const r = Number(trade.r ?? trade.riskReward ?? 0);
      return Number.isFinite(r) ? r : 0;
    }),
  );
}

function riskDisciplineStreak(trades: TradeLike[]) {
  let streak = 0;
  let best = 0;
  trades.forEach((trade) => {
    const text = `${trade.mistake || ""} ${trade.notes || ""}`.toLowerCase();
    const brokeRules = /revenge|overtrade|tilt|fomo|rule break/.test(text);
    if (brokeRules) {
      streak = 0;
    } else {
      streak += 1;
      best = Math.max(best, streak);
    }
  });
  return best;
}

export function calculateAchievements(input: {
  trades: TradeLike[];
  selectedDate?: string;
  tradingScore: number;
  winRate: number;
  profitFactor: number;
  bestMonthPnl: number;
  drawdownControl?: number;
  riskControl?: number;
  propSurvivalScore: number;
  propTargetRemainingPct?: number;
  [key: string]: unknown;
}) {
  const trades = input.trades || [];
  const count = trades.length;
  const greenTrades = trades.filter((trade) => (trade.pnl || 0) > 0).length;
  const greenDays = countGreenDays(trades);
  const greenWeeks = countGreenWeeks(trades);
  const bestR = largestR(trades);
  const discipline = Math.max(Number(input.drawdownControl ?? input.riskControl ?? 0), riskDisciplineStreak(trades));

  return [
    achievement("first_trade", "First Trade Logged", "Log your first trade", "journal", count, 1),
    achievement("first_10_trades", "10 Trades Logged", "Log 10 trades", "journal", count, 10),
    achievement("green_100", "100 Green Trades", "Close 100 green trades", "performance", greenTrades, 100),
    achievement("green_days_10", "10 Green Days", "Finish 10 days green", "performance", greenDays, 10),
    achievement("first_green_week", "First Green Week", "Finish one week green", "performance", greenWeeks, 1),
    achievement("five_r_trade", "5R Trade", "Log a 5R trade", "performance", bestR * 100, 500),
    achievement("pass_eval", "Pass Eval", "Reach 85 prop survival score", "prop_firm", Math.round(input.propSurvivalScore), 85),
    achievement("no_revenge_week", "No Revenge Trading Week", "Keep 5 clean sessions", "risk", riskDisciplineStreak(trades), 5),
    achievement("risk_streak", "Risk Discipline Streak", "Keep discipline score above 70", "risk", Math.round(discipline), 70),
    achievement("equity_high", "New Equity High", "Build positive monthly P&L", "performance", Math.max(0, input.bestMonthPnl), 1),
    achievement("first_1k_month", "First $1K Month", "Reach $1,000 in a month", "performance", Math.max(0, input.bestMonthPnl), 1000),
    achievement("first_10k_month", "First $10K Month", "Reach $10,000 in a month", "performance", Math.max(0, input.bestMonthPnl), 10000),
    achievement("top_20_trader", "Top 20% Trader", "Reach Trading Score 70", "performance", Math.round(input.tradingScore), 70),
    achievement("one_step_funding", "One Step From Funding", "Keep prop target remaining under 10%", "prop_firm", Math.max(0, 10 - Number(input.propTargetRemainingPct ?? 10)), 10),
  ];
}
export function traderLevelFromScore(score: number, _selectedDate?: string): TraderLevel {
  if (score >= 88) return { title: "Elite", phrase: "Your process is behaving like a professional desk.", score, topLabel: "Top 5%", nextAction: "Protect size and consistency." };
  if (score >= 76) return { title: "Funded", phrase: "Your edge is strong enough to protect like funded capital.", score, topLabel: "Top 10%", nextLevel: "Elite", nextAction: "Reduce drawdown and keep clean execution." };
  if (score >= 58) return { title: "Consistent", phrase: "Your edge is forming. Protect risk and repeat the best setups.", score, topLabel: "Top 25%", nextLevel: "Funded", nextAction: "Improve profit factor and green-day consistency." };
  return { title: "Rookie", phrase: "Keep logging trades to reveal your edge.", score, topLabel: "", nextLevel: "Consistent", nextAction: "Log more trades and control risk per setup." };
}
