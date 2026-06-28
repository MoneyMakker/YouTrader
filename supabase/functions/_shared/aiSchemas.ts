export type AICoachAction =
  | "weekly_coach"
  | "risk_predictor"
  | "journal_summary"
  | "daily_plan"
  | "news_explainer"
  | "daily_challenge";

export type AICoachPeriod = "day" | "week" | "month" | "custom";

export type AICoachRequest = {
  action: AICoachAction;
  period?: AICoachPeriod;
  payload?: Record<string, unknown>;
};

export type ProviderStatus = "nvidia" | "local_fallback" | "quota_exceeded" | "free_preview";

export const AI_ACTIONS: AICoachAction[] = [
  "weekly_coach",
  "risk_predictor",
  "journal_summary",
  "daily_plan",
  "news_explainer",
  "daily_challenge",
];

export function isAICoachAction(value: unknown): value is AICoachAction {
  return typeof value === "string" && AI_ACTIONS.includes(value as AICoachAction);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const arr = value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  return arr.length ? arr.slice(0, 8) : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function riskLevel(value: unknown) {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function difficulty(value: unknown) {
  return value === "easy" || value === "medium" || value === "hard" ? value : "medium";
}

export function safeParseJsonObject(content: string) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response was not JSON");
    return JSON.parse(match[0]);
  }
}

export function normalizeAIOutput(action: AICoachAction, value: Record<string, unknown>) {
  switch (action) {
    case "weekly_coach":
      return {
        title: stringValue(value.title, "Weekly Trading Coach"),
        summary: stringValue(value.summary, "Your journal is building enough signal for a weekly review."),
        topStrengths: stringArray(value.topStrengths, ["You are tracking trades consistently."]),
        mainLeaks: stringArray(value.mainLeaks, ["Keep risk and execution notes precise."]),
        bestSession: nullableString(value.bestSession),
        worstSession: nullableString(value.worstSession),
        riskNotes: stringArray(value.riskNotes, ["Do not increase size after losses or emotional trades."]),
        nextWeekFocus: stringArray(value.nextWeekFocus, ["Trade only planned setups and document every entry."]),
        coachMessage: stringValue(value.coachMessage, "Focus on discipline, consistency, and clean journaling next week."),
      };
    case "risk_predictor":
      return {
        riskLevel: riskLevel(value.riskLevel),
        riskScore: Math.max(0, Math.min(100, Math.round(numberValue(value.riskScore, 50)))),
        reasons: stringArray(value.reasons, ["Recent journal behavior needs a risk check."]),
        warningSigns: stringArray(value.warningSigns, ["Overtrading after a loss", "Increasing size without a plan"]),
        recommendedRules: stringArray(value.recommendedRules, ["Stop after 2 losses", "No revenge trades"]),
        maxRiskSuggestion: stringValue(value.maxRiskSuggestion, "Keep risk small and predefined today."),
        coachMessage: stringValue(value.coachMessage, "Your job today is to protect discipline, not predict direction."),
      };
    case "journal_summary":
      return {
        period: stringValue(value.period, "selected period"),
        summary: stringValue(value.summary, "Your journal shows useful performance and behavior patterns."),
        patternsDetected: stringArray(value.patternsDetected, ["Review best and worst sessions."]),
        strengths: stringArray(value.strengths, ["You are building process data."]),
        mistakes: stringArray(value.mistakes, ["Keep notes detailed enough to spot repeat leaks."]),
        behaviorNotes: stringArray(value.behaviorNotes, ["Avoid changing risk after emotional trades."]),
        improvementPlan: stringArray(value.improvementPlan, ["Write one rule before the next session."]),
      };
    case "daily_plan":
      return {
        dailyFocus: stringValue(value.dailyFocus, "Trade only planned, journaled setups."),
        riskBudget: stringValue(value.riskBudget, "Use a fixed, predefined risk budget today."),
        avoidToday: stringArray(value.avoidToday, ["Revenge trades", "Oversized trades", "Unplanned entries"]),
        tradeRules: stringArray(value.tradeRules, ["Define invalidation before entry", "Stop after rule breaks"]),
        sessionFocus: nullableString(value.sessionFocus),
        newsAwareness: stringArray(value.newsAwareness, ["Treat major news as volatility risk, not a signal."]),
        coachMessage: stringValue(value.coachMessage, "Protect your process before chasing P&L."),
      };
    case "news_explainer":
      return {
        headline: stringValue(value.headline, "Market news"),
        plainEnglish: stringValue(value.plainEnglish, "This news may affect volatility and trader behavior."),
        whyItMatters: stringValue(value.whyItMatters, "News can change liquidity, spreads, and emotional decision making."),
        marketsPotentiallyAffected: stringArray(value.marketsPotentiallyAffected, ["Indexes", "Rates", "Commodities"]),
        riskReminder: stringValue(value.riskReminder, "Do not treat this as a buy or sell signal. Manage risk first."),
        notFinancialAdvice: true,
      };
    case "daily_challenge":
      return {
        challengeTitle: stringValue(value.challengeTitle, "No Revenge Trade Challenge"),
        challengeDescription: stringValue(value.challengeDescription, "Protect your discipline by avoiding impulse trades today."),
        rules: stringArray(value.rules, ["Wait for planned setups", "Stop after 2 losses"]),
        successCriteria: stringArray(value.successCriteria, ["Every trade is journaled", "No trade is taken from frustration"]),
        difficulty: difficulty(value.difficulty),
        whyThisHelps: stringValue(value.whyThisHelps, "Small discipline wins compound into cleaner execution."),
      };
  }
}

export function schemaInstruction(action: AICoachAction) {
  const schemas: Record<AICoachAction, string> = {
    weekly_coach:
      '{"title":"","summary":"","topStrengths":[],"mainLeaks":[],"bestSession":null,"worstSession":null,"riskNotes":[],"nextWeekFocus":[],"coachMessage":""}',
    risk_predictor:
      '{"riskLevel":"low|medium|high","riskScore":0,"reasons":[],"warningSigns":[],"recommendedRules":[],"maxRiskSuggestion":"","coachMessage":""}',
    journal_summary:
      '{"period":"","summary":"","patternsDetected":[],"strengths":[],"mistakes":[],"behaviorNotes":[],"improvementPlan":[]}',
    daily_plan:
      '{"dailyFocus":"","riskBudget":"","avoidToday":[],"tradeRules":[],"sessionFocus":null,"newsAwareness":[],"coachMessage":""}',
    news_explainer:
      '{"headline":"","plainEnglish":"","whyItMatters":"","marketsPotentiallyAffected":[],"riskReminder":"","notFinancialAdvice":true}',
    daily_challenge:
      '{"challengeTitle":"","challengeDescription":"","rules":[],"successCriteria":[],"difficulty":"easy|medium|hard","whyThisHelps":""}',
  };
  return schemas[action];
}
