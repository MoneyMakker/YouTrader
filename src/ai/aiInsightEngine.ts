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
