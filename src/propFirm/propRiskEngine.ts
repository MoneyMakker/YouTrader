import { C } from "../theme/colors";
import type {
  PropFirmPhase,
  PropFirmTemplate,
  PropRiskEngineInput,
  PropRiskEngineResult,
  PropRiskStatus,
  PropRiskTrade,
  PropRiskWarning,
} from "./types";

const avg = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

const money = (value: number) => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(0)}`;
};

function gradeForScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRuleBreak(trade: PropRiskTrade) {
  const text = `${trade.mood || ""} ${(trade.tags || []).join(" ")} ${trade.notes || ""} ${trade.mistake || ""}`.toLowerCase();
  return /revenge|overtrade|tilt|fomo|gambling|reckless|rule break|oops/.test(text);
}

function lossStreak(trades: PropRiskTrade[]) {
  const recent = [...trades].sort((a, b) => (b.date + b.id).localeCompare(a.date + b.id)).slice(0, 8);
  let streak = 0;
  for (const trade of recent) {
    if (trade.pnl < 0) streak += 1;
    else break;
  }
  return streak;
}

function uniqueTradingDays(trades: PropRiskTrade[]) {
  return new Set(trades.map((t) => t.date).filter(Boolean)).size;
}

function maxContractsForPhase(template: PropFirmTemplate, phase: PropFirmPhase) {
  if (phase === "funded" || phase === "live") return template.liveContracts;
  return template.evaluationContracts;
}

function riskPctForPhase(template: PropFirmTemplate, phase: PropFirmPhase) {
  return phase === "funded" || phase === "live" ? template.liveRiskPct : template.evaluationRiskPct;
}

function resolveDrawdownLimit(template: PropFirmTemplate) {
  if (template.trailingDrawdown) {
    return template.trailingDrawdownAmount ?? template.maxLossLimit;
  }
  return template.staticDrawdown ?? template.maxLossLimit;
}

function buildWarnings(input: {
  template: PropFirmTemplate;
  phase: PropFirmPhase;
  dayPnl: number;
  dailyRemaining: number;
  accountRemaining: number;
  avgLosingTrade: number;
  avgContracts: number;
  recommendedContracts: number;
  maxAllowed: number;
  lossStreakCount: number;
  trailingTightening: boolean;
  payoutReady: boolean;
  minDaysMet: boolean;
  expectancy: number;
}): { ruleWarnings: PropRiskWarning[]; emergencyAlerts: PropRiskWarning[] } {
  const warnings: PropRiskWarning[] = [];
  const push = (warning: PropRiskWarning) => warnings.push(warning);

  if (input.avgLosingTrade >= input.dailyRemaining && input.dailyRemaining > 0) {
    push({
      id: "avg-loss-daily-limit",
      severity: "high",
      title: "One loss can breach today's limit",
      body: `Your average losing trade (${money(input.avgLosingTrade)}) would violate today's remaining daily loss buffer (${money(input.dailyRemaining)}).`,
      category: "daily_loss",
    });
  }

  if (input.dailyRemaining <= 0) {
    push({
      id: "daily-limit-hit",
      severity: "emergency",
      title: "Stop trading today",
      body: "Daily loss limit is breached. Protect the account and reset tomorrow.",
      category: "daily_loss",
    });
  }

  if (input.accountRemaining <= 0) {
    push({
      id: "account-limit-hit",
      severity: "emergency",
      title: "Account drawdown breached",
      body: "Maximum drawdown is breached. Stop trading and review the evaluation path.",
      category: "drawdown",
    });
  }

  if (input.trailingTightening) {
    push({
      id: "trailing-tightening",
      severity: "high",
      title: "Trailing drawdown is tightening",
      body: "Your trailing drawdown follows balance highs. Upside today reduces future room less, but losses tighten the floor immediately.",
      category: "drawdown",
    });
  }

  if (input.avgContracts > input.recommendedContracts && input.recommendedContracts > 0) {
    push({
      id: "reduce-contracts",
      severity: "medium",
      title: "Reduce contract size",
      body: `Reduce from ${Math.round(input.avgContracts)} contracts to ${input.recommendedContracts} based on remaining buffers and recent behavior.`,
      category: "contracts",
    });
  }

  if (input.lossStreakCount >= 2) {
    push({
      id: "loss-streak",
      severity: "high",
      title: "Loss streak detected",
      body: `${input.lossStreakCount} consecutive losses. Pause before revenge entries.`,
      category: "behavior",
    });
  }

  if (input.expectancy <= 0) {
    push({
      id: "negative-expectancy",
      severity: "medium",
      title: "Negative expectancy",
      body: "Process expectancy is negative in the current sample. Do not scale risk until quality improves.",
      category: "behavior",
    });
  }

  if (Object.keys(input.template.newsRestrictions).length > 0) {
    push({
      id: "news-restriction",
      severity: "low",
      title: "News restriction active",
      body: "Firm rules include news buffers. Avoid entries around high-impact releases.",
      category: "news",
    });
  }

  if (!input.template.weekendHoldingAllowed) {
    push({
      id: "weekend-holding",
      severity: "low",
      title: "Weekend holding restricted",
      body: "This firm disallows or limits weekend holding. Flatten before the close if required.",
      category: "rules",
    });
  }

  if (input.payoutReady && (input.phase === "funded" || input.phase === "live")) {
    push({
      id: "payout-ready",
      severity: "low",
      title: "Payout conditions reached",
      body: "You have reached payout readiness thresholds. Protect gains before requesting a withdrawal.",
      category: "payout",
    });
  }

  if (input.phase !== "funded" && input.phase !== "live" && input.minDaysMet && input.accountRemaining > input.template.dailyLossLimit * 0.5) {
    push({
      id: "challenge-progress",
      severity: "low",
      title: "Challenge progress on track",
      body: "Minimum trading days are met. Focus on consistency over acceleration.",
      category: "rules",
    });
  }

  const emergencyAlerts = warnings.filter((w) => w.severity === "emergency");
  const ruleWarnings = warnings.filter((w) => w.severity !== "emergency");
  return { ruleWarnings, emergencyAlerts };
}

export function buildPropRiskEngine(input: PropRiskEngineInput): PropRiskEngineResult {
  const { trades, selectedDate, template, phase } = input;
  const dayTrades = trades.filter((t) => t.date === selectedDate);
  const dayPnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const wins = trades.filter((t) => t.pnl > 0);
  const avgLosingTrade = Math.max(35, Math.abs(avg(losses.map((t) => t.pnl))) || 50);
  const avgContracts =
    input.avgContracts ??
    (trades.length
      ? trades.reduce((sum, t) => sum + (t.contracts || 1), 0) / trades.length
      : 1);
  const expectancy = trades.length ? totalPnl / trades.length : 0;
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const emotionalBreaks = trades.filter(isRuleBreak).length;
  const emotionalControl = trades.length ? ((trades.length - emotionalBreaks) / trades.length) * 100 : 100;
  const streak = lossStreak(trades);
  const tradingDays = uniqueTradingDays(trades);

  const dailyRemaining = Math.max(0, template.dailyLossLimit + Math.min(dayPnl, 0));
  const drawdownLimitAmount = resolveDrawdownLimit(template);
  const accountRemaining = Math.max(0, drawdownLimitAmount + Math.min(totalPnl, 0));
  const remainingToPass = Math.max(0, template.evaluationTarget - Math.max(0, totalPnl));
  const challengePct = template.evaluationTarget
    ? Math.min(100, Math.round((Math.max(0, totalPnl) / template.evaluationTarget) * 100))
    : 0;
  const minDaysMet = tradingDays >= template.minTradingDays;

  const trailingTightening = template.trailingDrawdown && totalPnl > 0 && accountRemaining < drawdownLimitAmount * 0.55;
  const maxAllowed = maxContractsForPhase(template, phase);
  const riskPct = riskPctForPhase(template, phase);
  const quality =
    expectancy <= 0 ? 0.42 : emotionalControl >= 72 ? 1 : emotionalControl >= 55 ? 0.72 : 0.55;
  const streakPenalty = streak >= 3 ? 0.28 : streak === 2 ? 0.48 : streak === 1 ? 0.72 : 1;
  const riskBudget = Math.floor(
    Math.max(0, Math.min(dailyRemaining, accountRemaining) * riskPct * quality * streakPenalty),
  );
  const riskUnit = Math.max(180, avgLosingTrade * 3.2);
  let recommendedContracts = Math.max(
    0,
    Math.min(maxAllowed, Math.floor(riskBudget / Math.max(1, riskUnit))),
  );
  if (dailyRemaining <= 0 || accountRemaining <= 0 || streak >= 2 || expectancy <= 0) {
    recommendedContracts = 0;
  } else if (recommendedContracts === 0 && dailyRemaining > 0 && accountRemaining > 0) {
    recommendedContracts = 1;
  }

  const hardStop = dailyRemaining <= 0 || accountRemaining <= 0;
  const caution =
    !hardStop &&
    (dailyRemaining <= template.dailyLossLimit * 0.35 ||
      accountRemaining <= drawdownLimitAmount * 0.35 ||
      streak >= 2 ||
      expectancy <= 0 ||
      dayPnl < 0);
  const status: PropRiskStatus = hardStop ? "STOP" : caution ? "CAUTION" : "CLEAR";
  const statusColor = hardStop ? C.red : caution ? C.yellow : C.green;

  const dailyPctRemaining = (dailyRemaining / Math.max(1, template.dailyLossLimit)) * 100;
  const drawdownPctRemaining = (accountRemaining / Math.max(1, drawdownLimitAmount)) * 100;
  const bufferPct = Math.max(0, Math.min(100, dailyPctRemaining));

  const payoutMinDays = Number(template.payoutRules.minDays ?? template.minTradingDays ?? 0);
  const payoutReady =
    (phase === "funded" || phase === "live") &&
    totalPnl >= template.evaluationTarget * 0.5 &&
    tradingDays >= payoutMinDays &&
    accountRemaining > drawdownLimitAmount * 0.45;
  const payoutPct = Math.min(
    100,
    Math.round(
      ((totalPnl / Math.max(1, template.evaluationTarget)) * 0.6 +
        (tradingDays / Math.max(1, payoutMinDays || 1)) * 0.4) *
        100,
    ),
  );

  const accountHealthScore = clampScore(
    bufferPct * 0.28 +
      drawdownPctRemaining * 0.22 +
      winRate * 0.15 +
      Math.min(100, emotionalControl) * 0.15 +
      (expectancy > 0 ? 12 : -10) +
      (minDaysMet ? 8 : 0) -
      streak * 6 -
      (hardStop ? 25 : caution ? 10 : 0),
  );

  const survivalProbability = clampScore(
    accountHealthScore * 0.55 +
      drawdownPctRemaining * 0.25 +
      (expectancy > 0 ? 12 : -8) -
      streak * 5,
  );

  const { ruleWarnings, emergencyAlerts } = buildWarnings({
    template,
    phase,
    dayPnl,
    dailyRemaining,
    accountRemaining,
    avgLosingTrade,
    avgContracts,
    recommendedContracts,
    maxAllowed,
    lossStreakCount: streak,
    trailingTightening,
    payoutReady,
    minDaysMet,
    expectancy,
  });

  const primaryAction = hardStop
    ? "Stop Trading Today"
    : caution
      ? "Reduce Size"
      : payoutReady
        ? "Protect Payout Path"
        : "Trade With Discipline";

  const coachMessage = hardStop
    ? "Stop trading today. Protect the account."
    : avgLosingTrade >= dailyRemaining && dailyRemaining > 0
      ? `One average losing trade (${money(avgLosingTrade)}) would violate today's limit.`
      : recommendedContracts < avgContracts && recommendedContracts > 0
        ? `Reduce from ${Math.round(avgContracts)} contracts to ${recommendedContracts}.`
        : trailingTightening
          ? "Your trailing drawdown is tightening. Protect upside and cut size."
          : payoutReady
            ? "You have reached payout conditions. Protect gains before withdrawing."
            : caution
              ? `Reduce size. Recommended ${recommendedContracts} contract${recommendedContracts === 1 ? "" : "s"}.`
              : `Conditions are clear. Max ${maxAllowed} contracts for this phase.`;

  const todayLevel: PropRiskEngineResult["todayRisk"]["level"] = hardStop
    ? "STOP"
    : dailyRemaining < template.dailyLossLimit * 0.35
      ? "HIGH"
      : dailyRemaining < template.dailyLossLimit * 0.6
        ? "MEDIUM"
        : "LOW";

  const projectedDays =
    remainingToPass > 0 && dayPnl > 0
      ? `${Math.max(1, Math.ceil(remainingToPass / Math.max(dayPnl, 50)))}-${Math.max(3, Math.ceil(remainingToPass / Math.max(dayPnl * 0.7, 40)))}`
      : remainingToPass > 0
        ? "10-25"
        : "Complete";

  return {
    template,
    phase,
    status,
    statusColor,
    accountHealthScore,
    accountHealthGrade: gradeForScore(accountHealthScore),
    todayRisk: {
      level: todayLevel,
      dayPnl,
      remainingDailyLoss: dailyRemaining,
      dailyLimit: template.dailyLossLimit,
      pctRemaining: Math.round(dailyPctRemaining),
      pctUsed: Math.round(100 - dailyPctRemaining),
    },
    remainingDrawdown: {
      amount: accountRemaining,
      limit: drawdownLimitAmount,
      drawdownType: template.trailingDrawdown ? "trailing" : "static",
      tightening: trailingTightening,
      pctRemaining: Math.round(drawdownPctRemaining),
    },
    challengeProgress: {
      target: template.evaluationTarget,
      current: Math.max(0, totalPnl),
      remaining: remainingToPass,
      pct: challengePct,
      tradingDays,
      minTradingDays: template.minTradingDays,
      minDaysMet,
    },
    payoutReadiness: {
      ready: payoutReady,
      pct: payoutPct,
      message: payoutReady
        ? "Payout thresholds are met. Protect buffer before requesting withdrawal."
        : `Payout readiness ${payoutPct}%. Need more consistency and buffer protection.`,
    },
    ruleWarnings,
    contractRecommendation: {
      currentAvg: Math.round(avgContracts * 10) / 10,
      recommended: recommendedContracts,
      maxAllowed,
      reduceFrom: avgContracts > recommendedContracts ? Math.round(avgContracts) : undefined,
      reason: coachMessage,
    },
    riskForecast: {
      survivalProbability,
      topRisk: ruleWarnings[0]?.title || emergencyAlerts[0]?.title || "No urgent risk",
      daysToPass: phase === "evaluation" || phase === "challenge" ? projectedDays : undefined,
      trend: expectancy > 0 && streak === 0 ? "improving" : streak >= 2 ? "declining" : "stable",
    },
    emergencyAlerts,
    primaryAction,
    coachMessage,
    dayPnl,
    totalPnl,
    dailyRemaining,
    accountRemaining,
    remainingToPass,
    bufferPct,
    lossStreak: streak,
    avgLosingTrade,
  };
}

/** Legacy snapshot shape used across App.tsx AI Analytics */
export function toLegacyPropSnapshot(
  result: PropRiskEngineResult,
  selectedDate: string,
  legacyMode: "evaluation" | "funded",
) {
  return {
    template: result.template,
    status: result.status,
    statusColor: result.statusColor,
    statusSoft: result.status === "STOP" ? C.redSoft : result.status === "CAUTION" ? C.yellowSoft : C.greenSoft,
    dayPnl: result.dayPnl,
    totalPnl: result.totalPnl,
    remainingToPass: result.remainingToPass,
    dailyRemaining: result.dailyRemaining,
    accountRemaining: result.accountRemaining,
    bufferPct: result.bufferPct,
    mode: legacyMode,
    selectedDate,
    engine: result,
  };
}

export function computePropRiskSnapshot(args: {
  trades: PropRiskTrade[];
  selectedDate: string;
  templateKey: string;
  mode: "evaluation" | "funded";
  templates: PropFirmTemplate[];
  phase?: PropFirmPhase;
  currentBalance?: number;
}) {
  const template =
    args.templates.find((item) => item.key === args.templateKey) || args.templates[0];
  if (!template) return null;
  const phase = args.phase ?? (args.mode === "funded" ? "funded" : "evaluation");
  const result = buildPropRiskEngine({
    trades: args.trades,
    selectedDate: args.selectedDate,
    template,
    phase,
    currentBalance: args.currentBalance,
  });
  return toLegacyPropSnapshot(result, args.selectedDate, args.mode);
}
