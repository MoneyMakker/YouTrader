export type AiInsightCategory =
  | "risk"
  | "discipline"
  | "timing"
  | "consistency"
  | "prop_firm"
  | "improvement"
  | "achievement";

export type AiInsightPriority = "high" | "medium" | "low";

export type AiInsightVisualType =
  | "chart"
  | "progress"
  | "warning"
  | "comparison"
  | "calendar"
  | "streak"
  | "rule_card";

export type AiInsight = {
  id: string;
  category: AiInsightCategory;
  priority: AiInsightPriority;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  visualType: AiInsightVisualType;
  sourceMetrics: string[];
  relatedInsightIds: string[];
  createdAt: string;
  expiresAt?: string;
};

type TradeLike = {
  id?: string;
  date?: string;
  symbol?: string;
  direction?: string;
  pnl: number;
  mood?: string | null;
  tags?: string[];
  entryTime?: string | null;
  exitTime?: string | null;
};

type PerformanceRow = {
  label: string;
  pnl: number;
  count?: number;
  wr?: number;
};

type StatsLike = {
  count: number;
  pnl: number;
  wr: number;
  pf: number;
  exp: number;
  avgWin?: number;
  avgLoss?: number;
  avgWinLoss?: number;
  avgRR?: number;
  maxDd: number;
  consistency: number;
  drawdownControl: number;
  recoveryFactor: number;
  session?: PerformanceRow[];
  weekday?: PerformanceRow[];
  bySetup?: PerformanceRow[];
};

type PatternLike = { title: string; detail?: string; tone?: "green" | "purple" | "red" };

type PropContext = {
  mode?: string;
  status?: string;
  statusColor?: string;
  templateLabel?: string;
  dailyRemaining?: number;
  accountRemaining?: number;
  remainingToPass?: number;
  dailyLossLimit?: number;
  maxLossLimit?: number;
  passProbability?: number;
  bufferPct?: number;
};

type RevengeContext = {
  detected?: boolean;
  severity?: "LOW" | "MEDIUM" | "HIGH" | string;
  reason?: string;
  recommendation?: string;
};

export type AiInsightEngineInput = {
  trades: TradeLike[];
  stats: StatsLike;
  prop?: PropContext;
  patterns?: {
    strengths?: PatternLike[];
    risks?: PatternLike[];
    opportunity?: PatternLike;
  };
  revengeRisk?: RevengeContext;
  calendarContext?: string[];
  newsContext?: string[];
  createdAt?: string;
};

export type AiInsightEngineResult = {
  insights: AiInsight[];
  primary: AiInsight[];
  groups: Record<AiInsightCategory, AiInsight[]>;
};

export type AiWeeklyReport = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  pnl: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  tradeCount: number;
  bestDay: string;
  worstDay: string;
  bestSession: string;
  worstSession: string;
  bestSymbol: string;
  biggestMistake: string;
  bestBehavior: string;
  mainRiskWarning: string;
  nextWeekFocus: string;
  takeaways: string[];
  chartPoints: { label: string; value: number; cumulative: number }[];
};

export type AiDailyMissionStatus = "active" | "completed" | "failed" | "skipped";

export type AiDailyMission = {
  id: string;
  title: string;
  reason: string;
  checklist: { id: string; text: string; sourceMetric: string }[];
  relatedStats: string[];
  riskLevel: AiInsightPriority;
  createdAt: string;
};

export type AiAchievementRarity = "core" | "advanced" | "elite" | "prop_firm";

export type AiTradingAchievement = {
  id: string;
  icon: string;
  title: string;
  rarity: AiAchievementRarity;
  category: AiInsightCategory;
  progress: number;
  target: number;
  unlocked: boolean;
  explanation: string;
  whyItMatters: string;
  connectedStats: string[];
};

export type AiTradingDNAProfile = {
  enoughData: boolean;
  traderType: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  bestConditions: string[];
  dangerZones: string[];
  personalRules: string[];
  growthPotential: string;
  metrics: {
    bestSymbol: string;
    bestSession: string;
    bestSetup: string;
    averageHoldingMinutes: number | null;
    averageRR: number;
    drawdownBehavior: string;
    consistency: number;
    emotionalBehavior: string;
    overtradingTendency: string;
    recoveryAfterLosses: string;
  };
};

export type AiBenchmarkProfile = {
  available: boolean;
  message: string;
  percentiles: {
    winRate?: number;
    expectancy?: number;
    discipline?: number;
    journaling?: number;
    risk?: number;
    profitFactor?: number;
    consistency?: number;
  };
};

export type AiImprovementWindow = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  improved: boolean;
  explanation: string;
};

export type AiImprovementTimeline = {
  windows: AiImprovementWindow[];
  whatImproved: string[];
  whatDeclined: string[];
  nextFocus: string;
};

const categories: AiInsightCategory[] = [
  "risk",
  "discipline",
  "timing",
  "consistency",
  "prop_firm",
  "improvement",
  "achievement",
];

const priorityRank: Record<AiInsightPriority, number> = { high: 0, medium: 1, low: 2 };

const money = (value: number | undefined) => {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
};

const pct = (value: number | undefined) => `${Math.round(Number(value || 0))}%`;

const stableId = (category: AiInsightCategory, title: string, sourceMetrics: string[]) =>
  `${category}-${title}-${sourceMetrics.join("-")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);

const bestRow = (rows: PerformanceRow[] | undefined) =>
  [...(rows || [])].filter((row) => (row.count || 0) > 0).sort((a, b) => b.pnl - a.pnl)[0];

const worstRow = (rows: PerformanceRow[] | undefined) =>
  [...(rows || [])].filter((row) => (row.count || 0) > 0).sort((a, b) => a.pnl - b.pnl)[0];

const rowLabel = (row: PerformanceRow | undefined, fallback: string) =>
  row ? `${row.label} · ${money(row.pnl)}` : fallback;

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const gradeForScore = (score: number): AiWeeklyReport["grade"] =>
  score >= 82 ? "A" : score >= 68 ? "B" : score >= 52 ? "C" : "D";

const fallbackBehavior = (stats: StatsLike, prop?: PropContext) => {
  if ((prop?.bufferPct || 0) >= 70) return "You protected the prop-firm buffer.";
  if (stats.pf >= 1.5) return "Winners paid for losses with a healthy profit factor.";
  if (stats.consistency >= 70) return "Execution stayed consistent across the sample.";
  return "You kept building journal evidence instead of trading blind.";
};

const fallbackMistake = (stats: StatsLike, patterns?: AiInsightEngineInput["patterns"]) => {
  if (patterns?.risks?.[0]?.title) return patterns.risks[0].title;
  if (stats.avgWinLoss && stats.avgWinLoss < 1) return "Average loss is larger than average win.";
  if (stats.maxDd < 0) return `Drawdown reached ${money(stats.maxDd)}.`;
  if (stats.pf > 0 && stats.pf < 1) return "Profit factor is below 1.00.";
  return "No major mistake detected yet.";
};

function createInsight(input: Omit<AiInsight, "id" | "createdAt" | "relatedInsightIds"> & { createdAt: string }): AiInsight {
  return {
    id: stableId(input.category, input.title, input.sourceMetrics),
    relatedInsightIds: [],
    ...input,
  };
}

function dedupeInsights(insights: AiInsight[]) {
  const seen = new Set<string>();
  const result: AiInsight[] = [];
  for (const insight of insights) {
    const key = `${insight.category}:${insight.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    const recommendationKey = insight.recommendation.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90);
    if (seen.has(key) || seen.has(recommendationKey)) continue;
    seen.add(key);
    seen.add(recommendationKey);
    result.push(insight);
  }
  return result;
}

export function buildAiWeeklyReport(input: AiInsightEngineInput): AiWeeklyReport {
  const { trades, stats, patterns, prop, revengeRisk } = input;
  const bestDay = bestRow(stats.weekday);
  const worstDay = worstRow(stats.weekday);
  const bestSession = bestRow(stats.session);
  const worstSession = worstRow(stats.session);
  const bestSymbol = bestRow(
    Object.values(
      trades.reduce<Record<string, PerformanceRow>>((acc, trade) => {
        const key = trade.symbol || "Unknown";
        if (!acc[key]) acc[key] = { label: key, pnl: 0, count: 0, wr: 0 };
        acc[key].pnl += trade.pnl;
        acc[key].count = (acc[key].count || 0) + 1;
        acc[key].wr = (acc[key].wr || 0) + (trade.pnl > 0 ? 1 : 0);
        return acc;
      }, {}),
    ).map((row) => ({ ...row, wr: row.count ? ((row.wr || 0) / row.count) * 100 : 0 })),
  );
  const chartPoints = [...trades]
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .reduce<{ label: string; value: number; cumulative: number }[]>((acc, trade) => {
      const last = acc[acc.length - 1];
      if (last && last.label === trade.date) {
        last.value += trade.pnl;
        last.cumulative += trade.pnl;
      } else {
        const cumulative = (last?.cumulative || 0) + trade.pnl;
        acc.push({ label: trade.date || "", value: trade.pnl, cumulative });
      }
      return acc;
    }, []);
  const score = clampScore(
    stats.wr * 0.25 +
    Math.min(stats.pf, 3) * 15 +
    Math.max(0, stats.consistency) * 0.18 +
    Math.max(0, stats.drawdownControl) * 0.22 +
    (stats.exp > 0 ? 12 : -8) +
    ((prop?.bufferPct || 0) > 60 ? 8 : 0) -
    (revengeRisk?.severity === "HIGH" ? 12 : revengeRisk?.severity === "MEDIUM" ? 6 : 0),
  );
  const mainRiskWarning =
    revengeRisk?.severity === "HIGH"
      ? "Revenge-trading risk is high. Cooldown beats one more entry."
      : prop?.status === "STOP"
        ? "Prop-firm buffer is breached. Stop trading and protect the account."
        : prop?.status === "CAUTION"
          ? "Prop-firm buffer is in caution mode. Reduce size."
          : stats.maxDd < 0
            ? `Drawdown reached ${money(stats.maxDd)}. Protect downside first.`
            : "No urgent risk warning. Keep size stable.";
  const nextWeekFocus =
    worstSession && worstSession.pnl < 0
      ? `Avoid forcing trades in ${worstSession.label}; trade only your best session.`
      : stats.avgWinLoss && stats.avgWinLoss < 1
        ? "Improve average win/loss by cutting failed trades faster."
        : prop?.status === "CAUTION"
          ? "Rebuild daily and account buffer before chasing the target."
          : "Repeat the cleanest behavior and keep the sample disciplined.";
  const takeaways = [
    stats.pnl >= 0 ? `Week finished positive at ${money(stats.pnl)}.` : `Week needs defense at ${money(stats.pnl)}.`,
    bestSession ? `${bestSession.label} is the best session.` : "Best session needs more data.",
    mainRiskWarning,
  ].slice(0, 3);

  return {
    score,
    grade: gradeForScore(score),
    pnl: stats.pnl,
    winRate: stats.wr,
    profitFactor: stats.pf,
    expectancy: stats.exp,
    tradeCount: stats.count,
    bestDay: rowLabel(bestDay, "Need more days"),
    worstDay: rowLabel(worstDay, "Need more days"),
    bestSession: rowLabel(bestSession, "Need session data"),
    worstSession: rowLabel(worstSession, "Need session data"),
    bestSymbol: rowLabel(bestSymbol, "Need symbol data"),
    biggestMistake: fallbackMistake(stats, patterns),
    bestBehavior: patterns?.strengths?.[0]?.title || fallbackBehavior(stats, prop),
    mainRiskWarning,
    nextWeekFocus,
    takeaways,
    chartPoints,
  };
}

export function buildAiDailyMission(input: AiInsightEngineInput): AiDailyMission {
  const createdAt = input.createdAt || new Date().toISOString();
  const { stats, prop, patterns, revengeRisk } = input;
  const bestSession = bestRow(stats.session);
  const worstSession = worstRow(stats.session);
  const riskLevel: AiInsightPriority =
    prop?.status === "STOP" || revengeRisk?.severity === "HIGH" || stats.drawdownControl < 45
      ? "high"
      : prop?.status === "CAUTION" || revengeRisk?.severity === "MEDIUM" || stats.consistency < 60
        ? "medium"
        : "low";
  const stopAmount = Math.max(100, Math.round(Math.abs(prop?.dailyRemaining || stats.avgLoss || 300) * 0.35 / 50) * 50);
  const title =
    riskLevel === "high"
      ? `Stop after -$${stopAmount}`
      : bestSession
        ? `Only trade ${bestSession.label}`
        : "Max 2 trades today";
  const checklist = [
    {
      id: "trade-count",
      text: riskLevel === "high" ? "Max 1-2 trades. No revenge re-entry." : "Max 2 planned trades today.",
      sourceMetric: "recent_mistakes",
    },
    {
      id: "daily-stop",
      text: `Stop for the day if P&L reaches -$${stopAmount}.`,
      sourceMetric: "risk_limits",
    },
    {
      id: "best-session",
      text: bestSession ? `Trade only ${bestSession.label}; skip ${worstSession?.label || "weak"} conditions.` : "Wait for your highest-quality session before entering.",
      sourceMetric: "best_session",
    },
    {
      id: "news-buffer",
      text: "No trades 5 minutes before high-impact news.",
      sourceMetric: "calendar_context",
    },
  ];
  const reason =
    prop?.status === "STOP"
      ? "Your prop-firm buffer is already in stop mode, so survival matters more than opportunity."
      : prop?.status === "CAUTION"
        ? "Your buffer is in caution mode; one oversized decision can damage the pass path."
        : revengeRisk?.severity === "HIGH"
          ? "Recent behavior shows revenge risk, so the mission limits emotional decisions."
          : patterns?.risks?.[0]?.detail || `This mission protects ${pct(stats.drawdownControl)} risk control and ${pct(stats.consistency)} consistency.`;
  const relatedStats = [
    `Win rate ${pct(stats.wr)}`,
    `PF ${stats.pf.toFixed(2)}`,
    `Risk control ${pct(stats.drawdownControl)}`,
    prop ? `Daily buffer ${money(prop.dailyRemaining)}` : `Expectancy ${money(stats.exp)}`,
  ];

  return {
    id: stableId("discipline", `${createdAt.slice(0, 10)}-${title}`, ["daily_mission"]),
    title,
    reason,
    checklist,
    relatedStats,
    riskLevel,
    createdAt,
  };
}

const riskText = (trade: TradeLike) => `${trade.mood || ""} ${(trade.tags || []).join(" ")}`.toLowerCase();
const isRuleBreak = (trade: TradeLike) => /revenge|overtrade|tilt|fomo|gambling|reckless|rule break|oops/.test(riskText(trade));

const dayPnlMap = (trades: TradeLike[]) =>
  trades.reduce<Record<string, number>>((acc, trade) => {
    if (!trade.date) return acc;
    acc[trade.date] = (acc[trade.date] || 0) + trade.pnl;
    return acc;
  }, {});

const uniqueSortedDates = (trades: TradeLike[]) => [...new Set(trades.map((trade) => trade.date).filter(Boolean) as string[])].sort();

const journalStreak = (trades: TradeLike[]) => {
  const dates = uniqueSortedDates(trades);
  if (!dates.length) return 0;
  let best = 1;
  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const prev = new Date(`${dates[index - 1]}T00:00:00`).getTime();
    const cur = new Date(`${dates[index]}T00:00:00`).getTime();
    if (Math.round((cur - prev) / 86400000) === 1) streak += 1;
    else streak = 1;
    best = Math.max(best, streak);
  }
  return best;
};

const cleanTradeStreak = (trades: TradeLike[]) => {
  let current = 0;
  let best = 0;
  for (const trade of trades) {
    if (isRuleBreak(trade)) current = 0;
    else current += 1;
    best = Math.max(best, current);
  }
  return best;
};

const achievement = (
  id: string,
  icon: string,
  title: string,
  rarity: AiAchievementRarity,
  category: AiInsightCategory,
  progress: number,
  target: number,
  explanation: string,
  whyItMatters: string,
  connectedStats: string[],
): AiTradingAchievement => ({
  id,
  icon,
  title,
  rarity,
  category,
  progress: Math.max(0, Math.min(progress, target)),
  target,
  unlocked: progress >= target,
  explanation,
  whyItMatters,
  connectedStats,
});

export function buildAiAchievements(input: AiInsightEngineInput): AiTradingAchievement[] {
  const { trades, stats, prop, revengeRisk } = input;
  const sorted = [...trades].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const cleanTrades = sorted.filter((trade) => !isRuleBreak(trade)).length;
  const cleanStreak = cleanTradeStreak(sorted);
  const daily = dayPnlMap(sorted);
  const respectedLimitDays = Object.values(daily).filter((pnl) => pnl >= -Math.abs(prop?.dailyLossLimit || 500)).length;
  const losingDays = Object.values(daily).filter((pnl) => pnl < 0).length;
  const overtradeDays = Object.entries(
    sorted.reduce<Record<string, number>>((acc, trade) => {
      if (!trade.date) return acc;
      acc[trade.date] = (acc[trade.date] || 0) + 1;
      return acc;
    }, {}),
  ).filter(([, count]) => count > 3).length;
  const noRevengeThisWeek = revengeRisk?.severity !== "HIGH" && revengeRisk?.severity !== "MEDIUM";
  return [
    achievement("journal_7_day_streak", "J7", "7 Day Journal Streak", "core", "discipline", journalStreak(sorted), 7, "Logged trades across consecutive trading days.", "A consistent journal is the base layer for all useful coaching.", [`Trading days ${uniqueSortedDates(sorted).length}`, `Trades ${stats.count}`]),
    achievement("ten_clean_risk_trades", "R10", "10 Trades Respecting Risk", "core", "risk", cleanTrades, 10, "Trades without revenge, tilt, overtrade, or rule-break markers.", "Prop-firm survival depends on clean risk behavior more than prediction.", [`Clean trades ${cleanTrades}`, `Risk control ${pct(stats.drawdownControl)}`]),
    achievement("daily_loss_limit_respected", "DL", "Daily Loss Limit Respected", "advanced", "risk", respectedLimitDays, Math.max(1, Object.keys(daily).length), "Daily P&L stayed inside the configured loss-limit boundary.", "Respecting the daily stop prevents one session from damaging the account.", [`Limit ${money(-(prop?.dailyLossLimit || 500))}`, `Losing days ${losingDays}`]),
    achievement("no_revenge_week", "NR", "No Revenge Trades This Week", "advanced", "discipline", noRevengeThisWeek ? 1 : 0, 1, "No high or medium revenge-risk signal in the current sample.", "Not re-entering emotionally protects expectancy after losses.", [`Revenge risk ${revengeRisk?.severity || "LOW"}`, `Clean streak ${cleanStreak}`]),
    achievement("plan_5_sessions", "P5", "Followed Plan 5 Sessions", "advanced", "consistency", cleanStreak, 5, "Five consecutive clean trades/sessions without rule-break markers.", "Following the plan repeatedly is more valuable than one lucky result.", [`Clean streak ${cleanStreak}`, `Consistency ${pct(stats.consistency)}`]),
    achievement("expectancy_improved", "EX", "Improved Expectancy", "advanced", "improvement", stats.exp > 0 ? 1 : 0, 1, "Expectancy is positive in the selected sample.", "Positive expectancy means the process is paying after wins and losses are netted.", [`Expectancy ${money(stats.exp)}`, `PF ${stats.pf.toFixed(2)}`]),
    achievement("overtrading_reduced", "OT", "Reduced Overtrading", "advanced", "discipline", overtradeDays === 0 && stats.count > 0 ? 1 : 0, 1, "No day exceeded three logged trades in the current sample.", "Lower decision count usually improves discipline and review quality.", [`Overtrade days ${overtradeDays}`, `Trades ${stats.count}`]),
    achievement("funded_account_protected", "FA", "Protected Funded Account", "prop_firm", "prop_firm", prop?.status === "CLEAR" && (prop?.bufferPct || 0) >= 60 ? 1 : 0, 1, "Account buffer remains clear with meaningful room above danger.", "Funded traders are paid to protect capital first.", [`Status ${prop?.status || "N/A"}`, `Buffer ${pct(prop?.bufferPct)}`]),
    achievement("positive_profit_factor", "PF", "Positive Profit Factor", "core", "improvement", stats.pf >= 1 ? 1 : 0, 1, "Gross wins exceed or match gross losses.", "Profit factor is a direct read on whether wins are paying for losses.", [`PF ${stats.pf.toFixed(2)}`, `Win rate ${pct(stats.wr)}`]),
    achievement("consistency_improved", "CS", "Improved Consistency", "elite", "consistency", stats.consistency, 75, "Consistency score reached a professional threshold.", "Prop firms reward repeatable behavior more than sporadic big days.", [`Consistency ${pct(stats.consistency)}`, `Drawdown ${money(stats.maxDd)}`]),
  ];
}

const averageHoldingMinutes = (trades: TradeLike[]) => {
  const durations = trades.map((trade) => {
    if (!trade.entryTime || !trade.exitTime) return null;
    const [eh, em] = trade.entryTime.split(":").map(Number);
    const [xh, xm] = trade.exitTime.split(":").map(Number);
    if (![eh, em, xh, xm].every(Number.isFinite)) return null;
    const start = eh * 60 + em;
    const end = xh * 60 + xm;
    return end >= start ? end - start : null;
  }).filter((value): value is number => value != null);
  return durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
};

export function buildTradingDNAProfile(input: AiInsightEngineInput): AiTradingDNAProfile {
  const { trades, stats } = input;
  const bestSymbol = bestRow(Object.values(trades.reduce<Record<string, PerformanceRow>>((acc, trade) => {
    const key = trade.symbol || "Unknown";
    if (!acc[key]) acc[key] = { label: key, pnl: 0, count: 0 };
    acc[key].pnl += trade.pnl;
    acc[key].count = (acc[key].count || 0) + 1;
    return acc;
  }, {})));
  const bestSession = bestRow(stats.session);
  const worstSession = worstRow(stats.session);
  const bestSetup = bestRow(stats.bySetup);
  const avgHold = averageHoldingMinutes(trades);
  const overtradeDays = Object.values(trades.reduce<Record<string, number>>((acc, trade) => {
    if (!trade.date) return acc;
    acc[trade.date] = (acc[trade.date] || 0) + 1;
    return acc;
  }, {})).filter((count) => count > 3).length;
  const emotionalBreaks = trades.filter(isRuleBreak).length;
  const traderType = stats.count < 10
    ? "Profile building"
    : stats.consistency >= 70 && overtradeDays === 0
      ? "Selective process trader"
      : bestSession
        ? `Session-specialist ${bestSession.label.toLowerCase()} trader`
        : "Developing futures trader";
  const summary = stats.count < 10
    ? "Trading DNA unlocks after at least 10 logged trades with enough behavioral evidence."
    : `You are strongest as a ${traderType.toLowerCase()}. Your edge appears when trade count stays controlled and ${bestSession?.label || "your best session"} conditions are respected.`;
  return {
    enoughData: stats.count >= 10,
    traderType,
    summary,
    strengths: [bestSession ? `Best session: ${rowLabel(bestSession, "")}` : "Session edge still forming", bestSymbol ? `Best symbol: ${rowLabel(bestSymbol, "")}` : "Symbol edge still forming", stats.pf >= 1 ? `Profit factor ${stats.pf.toFixed(2)}` : "Journal sample is honest enough to reveal leaks"],
    weaknesses: [worstSession && worstSession.pnl < 0 ? `Weak session: ${rowLabel(worstSession, "")}` : "No clear weak session yet", emotionalBreaks ? `${emotionalBreaks} emotional/rule-break markers` : "Emotional markers are contained", stats.maxDd < 0 ? `Drawdown behavior: ${money(stats.maxDd)}` : "Drawdown behavior is stable"],
    bestConditions: [bestSession ? `Trade during ${bestSession.label}` : "Wait for clearer session data", bestSetup ? `Favor ${bestSetup.label}` : "Tag setups to find edge", bestSymbol ? `Focus on ${bestSymbol.label}` : "Keep symbol sample clean"],
    dangerZones: [worstSession && worstSession.pnl < 0 ? `Avoid adding size in ${worstSession.label}` : "Avoid size jumps after wins", overtradeDays ? `${overtradeDays} overtrading days detected` : "Overtrading currently controlled", emotionalBreaks ? "Do not trade immediately after emotional losses" : "Keep emotional notes complete"],
    personalRules: ["Stop after the second loss.", bestSession ? `Prioritize ${bestSession.label} setups.` : "Trade only preplanned setups.", overtradeDays ? "Cap the day at 2 trades until overtrading drops." : "Keep max trades per day at 2-3."],
    growthPotential: stats.exp >= 0 ? "Improve by preserving current expectancy while lowering drawdown." : "Improve by cutting average loss and reducing low-quality entries.",
    metrics: {
      bestSymbol: bestSymbol?.label || "Need data",
      bestSession: bestSession?.label || "Need data",
      bestSetup: bestSetup?.label || "Need tags",
      averageHoldingMinutes: avgHold,
      averageRR: stats.avgRR || 0,
      drawdownBehavior: stats.maxDd < 0 ? `${money(stats.maxDd)} max drawdown` : "No drawdown pressure",
      consistency: stats.consistency,
      emotionalBehavior: emotionalBreaks ? `${emotionalBreaks} emotional/rule-break markers` : "No clear emotional leak",
      overtradingTendency: overtradeDays ? `${overtradeDays} days above 3 trades` : "Controlled",
      recoveryAfterLosses: stats.recoveryFactor > 0 ? `Recovery factor ${stats.recoveryFactor.toFixed(2)}` : "Recovery not proven yet",
    },
  };
}

export function buildBenchmarkProfile(): AiBenchmarkProfile {
  return {
    available: false,
    message: "Available after enough anonymous community data is collected.",
    percentiles: {},
  };
}

function simpleStats(trades: TradeLike[]) {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  return {
    count: trades.length,
    pnl: trades.reduce((sum, trade) => sum + trade.pnl, 0),
    wr: trades.length ? (wins.length / trades.length) * 100 : 0,
    exp: trades.length ? trades.reduce((sum, trade) => sum + trade.pnl, 0) / trades.length : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -grossLoss / losses.length : 0,
    pf: grossLoss ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    emotionalControl: trades.length ? ((trades.length - trades.filter(isRuleBreak).length) / trades.length) * 100 : 0,
  };
}

export function buildImprovementTimeline(input: AiInsightEngineInput): AiImprovementTimeline {
  const trades = [...input.trades].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const now = input.createdAt ? new Date(input.createdAt) : new Date();
  const inRange = (daysBackStart: number, daysBackEnd: number) => trades.filter((trade) => {
    if (!trade.date) return false;
    const date = new Date(`${trade.date}T00:00:00`);
    const from = new Date(now);
    from.setDate(now.getDate() - daysBackStart);
    const to = new Date(now);
    to.setDate(now.getDate() - daysBackEnd);
    return date >= from && date < to;
  });
  const windows: AiImprovementWindow[] = [
    ["Last week", simpleStats(inRange(7, 0)), simpleStats(inRange(14, 7))],
    ["Last month", simpleStats(inRange(30, 0)), simpleStats(inRange(60, 30))],
    ["Last 20 trades", simpleStats(trades.slice(-20)), simpleStats(trades.slice(-40, -20))],
  ].map(([label, current, previous]) => {
    const cur = current as ReturnType<typeof simpleStats>;
    const prev = previous as ReturnType<typeof simpleStats>;
    const currentScore = cur.exp + cur.emotionalControl + Math.min(cur.pf, 3) * 10;
    const previousScore = prev.exp + prev.emotionalControl + Math.min(prev.pf, 3) * 10;
    const delta = currentScore - previousScore;
    return {
      label: label as string,
      current: Number(currentScore.toFixed(1)),
      previous: Number(previousScore.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      improved: delta > 0,
      explanation: delta > 0
        ? `Improved through expectancy ${money(cur.exp)} and emotional control ${pct(cur.emotionalControl)}.`
        : `Declined because expectancy is ${money(cur.exp)} and emotional control is ${pct(cur.emotionalControl)}.`,
    };
  });
  const whatImproved = windows.filter((window) => window.improved).map((window) => `${window.label}: +${window.delta.toFixed(1)}`);
  const whatDeclined = windows.filter((window) => !window.improved).map((window) => `${window.label}: ${window.delta.toFixed(1)}`);
  return {
    windows,
    whatImproved,
    whatDeclined,
    nextFocus: whatDeclined.length ? "Fix the weakest recent window before increasing risk." : "Keep the same process and avoid size creep.",
  };
}

export function buildAiInsights(input: AiInsightEngineInput): AiInsightEngineResult {
  const createdAt = input.createdAt || new Date().toISOString();
  const { trades, stats, patterns, prop, revengeRisk } = input;
  const insights: AiInsight[] = [];
  const bestSession = bestRow(stats.session);
  const worstSession = worstRow(stats.session);
  const bestDay = bestRow(stats.weekday);
  const worstDay = worstRow(stats.weekday);
  const bestSetup = bestRow(stats.bySetup);
  const worstSetup = worstRow(stats.bySetup);
  const losingTrades = trades.filter((trade) => trade.pnl < 0);
  const winningTrades = trades.filter((trade) => trade.pnl > 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
  const totalWin = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);

  if (stats.count === 0) {
    insights.push(createInsight({
      category: "discipline",
      priority: "medium",
      title: "Build the first clean sample",
      summary: "AI Analytics needs journal evidence before it can coach risk, timing, and prop-firm behavior.",
      evidence: ["0 logged trades in the selected month", "No session or setup sample yet"],
      recommendation: "Log the next trade with symbol, P&L, mood, and one execution note.",
      visualType: "rule_card",
      sourceMetrics: ["trade_count"],
      createdAt,
    }));
  }

  if (stats.count >= 1) {
    insights.push(createInsight({
      category: "improvement",
      priority: stats.pnl >= 0 ? "medium" : "high",
      title: stats.pnl >= 0 ? "Protect the green month" : "Stabilize the current month",
      summary: `${stats.count} trades have produced ${money(stats.pnl)} with ${pct(stats.wr)} win rate and ${stats.pf.toFixed(2)} profit factor.`,
      evidence: [`Net P&L ${money(stats.pnl)}`, `Profit factor ${stats.pf.toFixed(2)}`, `Expectancy ${money(stats.exp)}`],
      recommendation: stats.pnl >= 0
        ? "Keep size stable and avoid adding risk after green streaks."
        : "Reduce decision count and trade only the highest-quality setup until expectancy improves.",
      visualType: "progress",
      sourceMetrics: ["net_pnl", "win_rate", "profit_factor", "expectancy"],
      createdAt,
    }));
  }

  if (stats.count >= 5 && (stats.maxDd < 0 || stats.drawdownControl < 65 || totalLoss > totalWin)) {
    insights.push(createInsight({
      category: "risk",
      priority: stats.drawdownControl < 45 || totalLoss > totalWin * 1.25 ? "high" : "medium",
      title: "Risk leak is the first thing to fix",
      summary: `Drawdown is ${money(stats.maxDd)} and risk control is ${pct(stats.drawdownControl)}.`,
      evidence: [`Max drawdown ${money(stats.maxDd)}`, `Gross losses ${money(-totalLoss)}`, `Risk control ${pct(stats.drawdownControl)}`],
      recommendation: "Cut size after the first rule break and stop after two consecutive losses.",
      visualType: "warning",
      sourceMetrics: ["max_drawdown", "risk_control", "gross_loss"],
      createdAt,
    }));
  }

  if (stats.count >= 5 && stats.avgWinLoss && stats.avgWinLoss < 1) {
    insights.push(createInsight({
      category: "discipline",
      priority: "high",
      title: "Average loss is overpowering wins",
      summary: `Average win/loss ratio is ${stats.avgWinLoss.toFixed(2)}, so losses are not being contained fast enough.`,
      evidence: [`Average win ${money(stats.avgWin)}`, `Average loss ${money(stats.avgLoss)}`, `Avg win/loss ${stats.avgWinLoss.toFixed(2)}`],
      recommendation: "Predefine the invalidation level before entry and do not widen the stop after the trade is live.",
      visualType: "rule_card",
      sourceMetrics: ["average_win", "average_loss", "average_win_loss"],
      createdAt,
    }));
  }

  if (bestSession || worstSession) {
    insights.push(createInsight({
      category: "timing",
      priority: worstSession && worstSession.pnl < 0 ? "medium" : "low",
      title: bestSession ? `${bestSession.label} is your cleanest session` : "Session edge is still forming",
      summary: bestSession
        ? `${bestSession.label} leads your session sample at ${money(bestSession.pnl)}.`
        : "Log more trades to reveal your best and weakest sessions.",
      evidence: [
        bestSession ? `Best session ${bestSession.label}: ${money(bestSession.pnl)}` : "No positive session yet",
        worstSession ? `Weakest session ${worstSession.label}: ${money(worstSession.pnl)}` : "No weak session yet",
      ],
      recommendation: worstSession && worstSession.pnl < 0
        ? `Avoid increasing size during ${worstSession.label}; use it as review-only until the sample improves.`
        : "Keep building the session sample before changing your plan.",
      visualType: "calendar",
      sourceMetrics: ["session_pnl", "session_win_rate"],
      createdAt,
    }));
  }

  if (stats.count >= 5 && stats.consistency < 60) {
    insights.push(createInsight({
      category: "consistency",
      priority: "medium",
      title: "Consistency is below prop-firm standard",
      summary: `Consistency is ${pct(stats.consistency)}, which means results are still coming from uneven execution days.`,
      evidence: [`Consistency ${pct(stats.consistency)}`, bestDay ? `Best day ${bestDay.label}: ${money(bestDay.pnl)}` : "No best day yet", worstDay ? `Worst day ${worstDay.label}: ${money(worstDay.pnl)}` : "No worst day yet"],
      recommendation: "Set one max-trade rule for the next session and stop once it is reached.",
      visualType: "streak",
      sourceMetrics: ["consistency", "weekday_pnl"],
      createdAt,
    }));
  }

  if (prop) {
    const status = prop.status || "CLEAR";
    const passProbability = Math.round(prop.passProbability || 0);
    const priority: AiInsightPriority = status === "STOP" || passProbability < 45 ? "high" : status === "CAUTION" || passProbability < 65 ? "medium" : "low";
    insights.push(createInsight({
      category: "prop_firm",
      priority,
      title: status === "STOP" ? "Prop account needs protection now" : status === "CAUTION" ? "Buffer is in caution mode" : "Pass path is intact",
      summary: `${prop.templateLabel || "Selected account"}: ${passProbability}% pass/safety score, ${money(prop.dailyRemaining)} daily buffer, ${money(prop.accountRemaining)} account buffer.`,
      evidence: [`Status ${status}`, `Daily buffer ${money(prop.dailyRemaining)}`, `Account buffer ${money(prop.accountRemaining)}`, `Remaining to pass ${money(prop.remainingToPass)}`],
      recommendation: status === "STOP"
        ? "Stop trading today and review the last sequence before the next session."
        : status === "CAUTION"
          ? "Reduce size and trade only one A+ setup until the buffer recovers."
          : "Protect the buffer; do not increase contracts after one green sequence.",
      visualType: "warning",
      sourceMetrics: ["prop_status", "daily_buffer", "account_buffer", "pass_probability"],
      createdAt,
    }));
  }

  if (revengeRisk?.detected || revengeRisk?.severity === "HIGH" || revengeRisk?.severity === "MEDIUM") {
    insights.push(createInsight({
      category: "discipline",
      priority: revengeRisk.severity === "HIGH" ? "high" : "medium",
      title: "Revenge trading risk is active",
      summary: revengeRisk.reason || "Recent trade behavior shows elevated emotional re-entry risk.",
      evidence: [revengeRisk.severity ? `Severity ${revengeRisk.severity}` : "Detected revenge-risk pattern", `${stats.count} trades in current sample`],
      recommendation: revengeRisk.recommendation || "Take a mandatory cooldown after losses and avoid immediate re-entry.",
      visualType: "warning",
      sourceMetrics: ["revenge_risk", "recent_sequence"],
      createdAt,
    }));
  }

  const strongest = patterns?.strengths?.[0];
  const weakest = patterns?.risks?.[0] || patterns?.opportunity;
  if (strongest && stats.count >= 3) {
    insights.push(createInsight({
      category: "achievement",
      priority: "low",
      title: strongest.title,
      summary: strongest.detail || "Your journal is starting to reveal a repeatable strength.",
      evidence: [`Trade sample ${stats.count}`, `Trading score inputs: win rate ${pct(stats.wr)}, PF ${stats.pf.toFixed(2)}`],
      recommendation: "Keep tagging this behavior so the app can separate real edge from noise.",
      visualType: "progress",
      sourceMetrics: ["pattern_strength", "trade_count"],
      createdAt,
    }));
  }

  if (weakest && stats.count >= 3) {
    insights.push(createInsight({
      category: weakest.tone === "red" ? "risk" : "discipline",
      priority: weakest.tone === "red" ? "high" : "medium",
      title: weakest.title,
      summary: weakest.detail || "This pattern deserves review before the next session.",
      evidence: [`Trade sample ${stats.count}`, bestSetup ? `Best setup ${bestSetup.label}: ${money(bestSetup.pnl)}` : "Setup tags incomplete", worstSetup ? `Weak setup ${worstSetup.label}: ${money(worstSetup.pnl)}` : "No weak setup yet"],
      recommendation: "Write one rule that blocks this mistake before you trade again.",
      visualType: "comparison",
      sourceMetrics: ["pattern_risk", "setup_pnl"],
      createdAt,
    }));
  }

  const sorted = dedupeInsights(insights).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  const groups = categories.reduce((acc, category) => {
    acc[category] = sorted.filter((insight) => insight.category === category);
    return acc;
  }, {} as Record<AiInsightCategory, AiInsight[]>);

  return {
    insights: sorted,
    primary: sorted.slice(0, 5),
    groups,
  };
}
