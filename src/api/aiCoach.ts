import { isSupabaseConfigured, supabase } from "../config/appConfig";
import { t } from "../i18n";

export type AIProviderStatus = "openrouter" | "gemini" | "anthropic" | "nvidia" | "local_fallback" | "quota_exceeded" | "free_preview";

export type AIResponse<T> = {
  data: T;
  providerStatus: AIProviderStatus;
  usedFallback: boolean;
  message?: string;
  quota?: { remaining: number; limit: number; warning?: string };
  rag?: {
    sources: { source: string; document: string; lastUpdated: string; confidence: number; sourceUrl?: string | null }[];
    confidence: number;
    lowConfidence: boolean;
  };
  generatedAt: string;
};

export type AIWeeklyCoach = {
  title: string;
  summary: string;
  topStrengths: string[];
  mainLeaks: string[];
  bestSession: string | null;
  worstSession: string | null;
  riskNotes: string[];
  nextWeekFocus: string[];
  coachMessage: string;
};

export type AIRiskPredictor = {
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  reasons: string[];
  warningSigns: string[];
  recommendedRules: string[];
  maxRiskSuggestion: string;
  coachMessage: string;
};

export type AIJournalSummary = {
  period: string;
  summary: string;
  patternsDetected: string[];
  strengths: string[];
  mistakes: string[];
  behaviorNotes: string[];
  improvementPlan: string[];
};

export type AIDailyPlan = {
  dailyFocus: string;
  riskBudget: string;
  avoidToday: string[];
  tradeRules: string[];
  sessionFocus: string | null;
  newsAwareness: string[];
  coachMessage: string;
};

export type AINewsExplainer = {
  headline: string;
  plainEnglish: string;
  whyItMatters: string;
  marketsPotentiallyAffected: string[];
  riskReminder: string;
  notFinancialAdvice: true;
};

export type AIDailyChallenge = {
  challengeTitle: string;
  challengeDescription: string;
  rules: string[];
  successCriteria: string[];
  difficulty: "easy" | "medium" | "hard";
  whyThisHelps: string;
};

type Action =
  | "weekly_coach"
  | "risk_predictor"
  | "journal_summary"
  | "daily_plan"
  | "news_explainer"
  | "daily_challenge";

type Period = "day" | "week" | "month" | "custom";

function now() {
  return new Date().toISOString();
}

function stats(payload: Record<string, any>) {
  return payload.stats || payload.periodStats || payload;
}

function fallback(action: Action, payload: Record<string, any>): any {
  const s = stats(payload);
  const totalTrades = Number(s.totalTrades || payload.totalTrades || 0);
  const winRate = Number(s.wr || s.winRate || payload.winRate || 0);
  const profitFactor = Number(s.pf || s.profitFactor || payload.profitFactor || 0);
  const bestSession = payload.bestSession || s.bestSession || null;
  const worstSession = payload.worstSession || s.worstSession || null;
  const headline = payload.news?.title || payload.headline || t("aiMarketNewsFallback");

  switch (action) {
    case "weekly_coach":
      return {
        title: t("aiWeeklyCoachTitle"),
        summary: `This review is based on ${totalTrades} logged trades. Win rate is ${Math.round(winRate)}% and profit factor is ${profitFactor.toFixed(2)}.`,
        topStrengths: [t("aiFallbackBuildingJournal"), t("aiFallbackSessionStatsReview")],
        mainLeaks: [t("aiFallbackProtectWeakSessions"), t("aiFallbackAvoidSizeAfterEmotional")],
        bestSession,
        worstSession,
        riskNotes: [t("aiFallbackRespectDailyStop"), t("aiFallbackNoSizeAfterLosses")],
        nextWeekFocus: [t("aiFallbackJournalEveryTrade"), t("aiFallbackTradePlannedSetups")],
        coachMessage: t("aiCoachEducationalDisclaimer"),
      } satisfies AIWeeklyCoach;
    case "risk_predictor":
      return {
        riskLevel: winRate < 45 || totalTrades > 4 ? "high" : winRate < 55 ? "medium" : "low",
        riskScore: Math.max(15, Math.min(88, Math.round(65 - winRate / 2 + totalTrades * 2))),
        reasons: ["Recent journal data suggests checking discipline before trading."],
        warningSigns: ["Overtrading", "Revenge entries", "Oversized trades"],
        recommendedRules: ["Stop after 2 losses", "Predefine max risk", "No trades without invalidation"],
        maxRiskSuggestion: "Keep risk small and fixed until execution is clean.",
        coachMessage: t("aiDisciplineRiskOnly"),
      } satisfies AIRiskPredictor;
    case "journal_summary":
      return {
        period: String(payload.period || "selected period"),
        summary: `Journal review: ${totalTrades} trades, ${Math.round(winRate)}% win rate, ${profitFactor.toFixed(2)} profit factor.`,
        patternsDetected: ["Review best and worst sessions", "Compare setup quality after losses"],
        strengths: ["You are tracking enough data to find process patterns"],
        mistakes: ["Weak contexts need stricter filters"],
        behaviorNotes: ["Add notes about emotion, setup, and rule quality"],
        improvementPlan: ["Pick one leak", "Write one rule", "Review after the next session"],
      } satisfies AIJournalSummary;
    case "daily_plan":
      return {
        dailyFocus: "Trade only planned setups and protect discipline.",
        riskBudget: "Use fixed predefined risk and stop if rules are broken.",
        avoidToday: ["Revenge trades", "Oversized trades", "News impulse entries"],
        tradeRules: ["Define invalidation before entry", "No size increase after a loss", "Journal every trade"],
        sessionFocus: bestSession,
        newsAwareness: ["Treat upcoming news as volatility risk, not a trading signal."],
        coachMessage: t("aiExecutionQualityFirst"),
      } satisfies AIDailyPlan;
    case "news_explainer":
      return {
        headline,
        plainEnglish: "This news may affect expectations and short-term volatility.",
        whyItMatters: "News can change liquidity, spreads, and emotional pressure around market opens.",
        marketsPotentiallyAffected: ["Indexes", "Rates", "Commodities"],
        riskReminder: t("aiNotBuySellSignal"),
        notFinancialAdvice: true,
      } satisfies AINewsExplainer;
    case "daily_challenge":
      return {
        challengeTitle: t("aiNoRevengeChallenge"),
        challengeDescription: "Take only trades from your plan, not from frustration.",
        rules: ["Stop after 2 losses", "No size increases after red trades", "Journal before and after entry"],
        successCriteria: ["No impulse trades", "Every trade has a written reason", "Risk stayed inside the plan"],
        difficulty: "medium",
        whyThisHelps: "Cleaner discipline creates cleaner data and protects drawdown.",
      } satisfies AIDailyChallenge;
  }
}

async function invokeAI<T>(action: Action, period: Period, payload: Record<string, unknown>): Promise<AIResponse<T>> {
  const fallbackData = fallback(action, payload) as T;

  try {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: fallbackData,
        providerStatus: "local_fallback",
        usedFallback: true,
        message: t("aiCloudNotConfigured"),
        generatedAt: now(),
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        data: fallbackData,
        providerStatus: "local_fallback",
        usedFallback: true,
        message: t("aiCloudSignInRequired"),
        generatedAt: now(),
      };
    }

    const { data, error } = await supabase.functions.invoke("ai-coach", {
      body: { action, period, payload },
    });

    if (error || !data?.data) {
      const limitMessage = data?.message?.includes("limit") ? data.message : undefined;
      return {
        data: fallbackData,
        providerStatus: data?.providerStatus === "quota_exceeded" ? "quota_exceeded" : "local_fallback",
        usedFallback: true,
        message: limitMessage || data?.message || t("aiCloudUnavailable"),
        generatedAt: now(),
      };
    }

    return {
      data: data.data as T,
      providerStatus: data.providerStatus || "nvidia",
      usedFallback: !!data.usedFallback,
      message: data.quota?.warning || data.message,
      quota: data.quota,
      rag: data.rag,
      generatedAt: now(),
    };
  } catch {
    return {
      data: fallbackData,
      providerStatus: "local_fallback",
      usedFallback: true,
      message: "Cloud AI is unavailable. Showing local YouTrader analysis.",
      generatedAt: now(),
    };
  }
}

export function fetchAIWeeklyCoach(payload: Record<string, unknown>) {
  return invokeAI<AIWeeklyCoach>("weekly_coach", "week", payload);
}

export function fetchAIRiskPredictor(payload: Record<string, unknown>) {
  return invokeAI<AIRiskPredictor>("risk_predictor", "day", payload);
}

export function fetchAIJournalSummary(payload: Record<string, unknown>) {
  return invokeAI<AIJournalSummary>("journal_summary", "month", payload);
}

export function fetchAIDailyPlan(payload: Record<string, unknown>) {
  return invokeAI<AIDailyPlan>("daily_plan", "day", payload);
}

export function fetchAINewsExplainer(newsItem: Record<string, unknown>) {
  return invokeAI<AINewsExplainer>("news_explainer", "day", { news: newsItem });
}

export function fetchAIDailyChallenge(payload: Record<string, unknown>) {
  return invokeAI<AIDailyChallenge>("daily_challenge", "day", payload);
}
