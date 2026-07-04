import { t } from "../i18n";

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
export type TraderLevel = {
  titleKey: "Rookie" | "Consistent" | "Funded" | "Elite";
  title: string;
  phrase: string;
  score: number;
  topLabel: string;
  nextLevel?: string;
  nextAction?: string;
};

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
    achievement("first_trade", t("achFirstTradeTitle"), t("achFirstTradeCond"), "journal", count, 1),
    achievement("first_10_trades", t("ach10TradesTitle"), t("ach10TradesCond"), "journal", count, 10),
    achievement("green_100", t("ach100GreenTitle"), t("ach100GreenCond"), "performance", greenTrades, 100),
    achievement("green_days_10", t("ach10GreenDaysTitle"), t("ach10GreenDaysCond"), "performance", greenDays, 10),
    achievement("first_green_week", t("achFirstGreenWeekTitle"), t("achFirstGreenWeekCond"), "performance", greenWeeks, 1),
    achievement("five_r_trade", t("ach5RTitle"), t("ach5RCond"), "performance", bestR * 100, 500),
    achievement("pass_eval", t("achPassEvalTitle"), t("achPassEvalCond"), "prop_firm", Math.round(input.propSurvivalScore), 85),
    achievement("no_revenge_week", t("achNoRevengeTitle"), t("achNoRevengeCond"), "risk", riskDisciplineStreak(trades), 5),
    achievement("risk_streak", t("achRiskStreakTitle"), t("achRiskStreakCond"), "risk", Math.round(discipline), 70),
    achievement("equity_high", t("achEquityHighTitle"), t("achEquityHighCond"), "performance", Math.max(0, input.bestMonthPnl), 1),
    achievement("first_1k_month", t("ach1KMonthTitle"), t("ach1KMonthCond"), "performance", Math.max(0, input.bestMonthPnl), 1000),
    achievement("first_10k_month", t("ach10KMonthTitle"), t("ach10KMonthCond"), "performance", Math.max(0, input.bestMonthPnl), 10000),
    achievement("top_20_trader", t("achTop20Title"), t("achTop20Cond"), "performance", Math.round(input.tradingScore), 70),
    achievement("one_step_funding", t("achOneStepTitle"), t("achOneStepCond"), "prop_firm", Math.max(0, 10 - Number(input.propTargetRemainingPct ?? 10)), 10),
  ];
}

export function traderLevelFromScore(score: number, _selectedDate?: string): TraderLevel {
  if (score >= 88) {
    return {
      titleKey: "Elite",
      title: t("levelEliteTitle"),
      phrase: t("levelElitePhrase"),
      score,
      topLabel: t("levelTop5"),
      nextAction: t("levelEliteAction"),
    };
  }
  if (score >= 76) {
    return {
      titleKey: "Funded",
      title: t("levelFundedTitle"),
      phrase: t("levelFundedPhrase"),
      score,
      topLabel: t("levelTop10"),
      nextLevel: t("levelEliteTitle"),
      nextAction: t("levelFundedAction"),
    };
  }
  if (score >= 58) {
    return {
      titleKey: "Consistent",
      title: t("levelConsistentTitle"),
      phrase: t("levelConsistentPhrase"),
      score,
      topLabel: t("levelTop25"),
      nextLevel: t("levelFundedTitle"),
      nextAction: t("levelConsistentAction"),
    };
  }
  return {
    titleKey: "Rookie",
    title: t("levelRookieTitle"),
    phrase: t("levelRookiePhrase"),
    score,
    topLabel: "",
    nextLevel: t("levelConsistentTitle"),
    nextAction: t("levelRookieAction"),
  };
}
