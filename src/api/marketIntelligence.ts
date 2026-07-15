import { isSupabaseConfigured, supabase } from "../config/appConfig";
import { AI_DAILY_LIMIT_MESSAGE } from "../config/monetization";
import { t } from "../i18n";
import { logger } from "../lib/logger";

export type MarketIntelligenceAction =
  | "market_sentiment"
  | "market_narrative"
  | "watchlist_risk"
  | "volatility_radar"
  | "pre_market_brief"
  | "noise_filter"
  | "opportunity_scanner"
  | "why_market_moving";

export type MarketSentimentResult = {
  marketSentiment: string;
  confidence: string;
  drivers: string[];
  riskSuggestion: string;
  symbolBiases: { symbol: string; bias: string; reason: string }[];
  timestamp: string;
  inputHeadlineCount: number;
  disclaimer: string;
};

export type MarketNarrativeResult = {
  title: string;
  bullets: string[];
  disclaimer: string;
};

export type WatchlistRiskResult = {
  symbols: { symbol: string; risk: string; explanation: string }[];
  disclaimer: string;
};

export type VolatilityRadarResult = {
  volatility: string;
  behaviorSuggestion: string;
  drivers: string[];
  disclaimer: string;
};

export type PreMarketBriefResult = {
  mission: string;
  macroEvents: string[];
  fedNotes: string;
  earnings: string[];
  highRiskStocks: string[];
  psychologyReminder: string;
  expectedVolatility: string;
  riskSuggestion: string;
  disclaimer: string;
};

export type NoiseFilterResult = {
  stories: { title: string; whyItMatters: string }[];
  disclaimer: string;
};

export type OpportunityScannerResult = {
  sectors: { name: string; direction: string; note: string }[];
  disclaimer: string;
};

export type WhyMarketMovingResult = {
  symbol: string;
  explanation: string;
  disclaimer: string;
};

export type MarketIntelResponse<T> = {
  data: T;
  usedFallback: boolean;
  message?: string;
  providerStatus?: string;
  quota?: { remaining: number; limit: number };
};

function localFallback<T>(action: MarketIntelligenceAction, payload: Record<string, unknown>): T {
  const headlines = Array.isArray(payload.headlines) ? payload.headlines as Record<string, unknown>[] : [];
  const headlineText = headlines.map((item) => `${item.title || ""} ${item.summary || ""}`).join(" ").toLowerCase();
  const riskWords = ["inflation", "cpi", "fed", "yields", "war", "tariff", "selloff", "recession", "jobs"];
  const positiveWords = ["rally", "beats", "growth", "cut", "eases", "record", "optimism"];
  const riskScore = riskWords.reduce((sum, word) => sum + (headlineText.includes(word) ? 1 : 0), 0);
  const positiveScore = positiveWords.reduce((sum, word) => sum + (headlineText.includes(word) ? 1 : 0), 0);
  const headlineDrivenSentiment = headlines.length < 3
    ? "Mixed"
    : riskScore > positiveScore
      ? "Risk-off"
      : positiveScore > riskScore
        ? "Constructive"
        : "Mixed";
  switch (action) {
    case "market_sentiment":
      return {
        marketSentiment: headlineDrivenSentiment,
        confidence: headlines.length < 3 ? "Low" : "Medium",
        drivers: headlines.length
          ? headlines.slice(0, 3).map((item) => String(item.title || "Visible headline").slice(0, 110))
          : ["No visible headlines were supplied", "Volatility may expand around data"],
        riskSuggestion: headlines.length < 3 ? "Headline sample is thin. Keep risk conservative until fresh context is available." : "Use headlines as volatility context only. Reduce size if volatility expands.",
        symbolBiases: String(payload.symbols || payload.symbol || "NQ")
          .split(/[,\s]+/)
          .filter(Boolean)
          .slice(0, 5)
          .map((symbol) => ({ symbol: symbol.toUpperCase(), bias: headlineDrivenSentiment, reason: "Derived from visible headline mix." })),
        timestamp: new Date().toISOString(),
        inputHeadlineCount: headlines.length,
        disclaimer: "This is not financial advice. Use alongside your own trading plan.",
      } as T;
    case "market_narrative":
      return {
        title: "Today's Story",
        bullets: ["Tech under pressure", "Bond yields in focus", "Afternoon volatility possible"],
        disclaimer: "This is not financial advice.",
      } as T;
    case "watchlist_risk":
      return {
        symbols: String(payload.symbols || "NVDA")
          .split(/[,\s]+/)
          .filter(Boolean)
          .slice(0, 4)
          .map((symbol) => ({ symbol: symbol.toUpperCase(), risk: "Medium", explanation: "Monitor headline flow." })),
        disclaimer: "This is not financial advice.",
      } as T;
    case "volatility_radar":
      return {
        volatility: "Medium",
        behaviorSuggestion: "Trade smaller until the open settles.",
        drivers: ["Macro releases", "Index leadership"],
        disclaimer: "This is not financial advice.",
      } as T;
    case "pre_market_brief":
      return {
        mission: "Protect capital and trade only planned setups.",
        macroEvents: ["Review today's economic calendar"],
        fedNotes: "Watch rates and macro headlines.",
        earnings: [],
        highRiskStocks: [],
        psychologyReminder: "No revenge trading.",
        expectedVolatility: "Medium",
        riskSuggestion: "Cut size if volatility expands.",
        disclaimer: "This is not financial advice.",
      } as T;
    case "noise_filter":
      return {
        stories: [{ title: "Macro headlines dominate", whyItMatters: "May affect session volatility." }],
        disclaimer: "This is not financial advice.",
      } as T;
    case "opportunity_scanner":
      return {
        sectors: [
          { name: "Semiconductors", direction: "Up", note: "Attention rising" },
          { name: "Energy", direction: "Down", note: "Mixed flow" },
        ],
        disclaimer: "This is not financial advice.",
      } as T;
    case "why_market_moving":
      return {
        symbol: String(payload.symbol || "NQ"),
        explanation: "Index movement reflects headline-driven macro sensitivity today.",
        disclaimer: "This is not financial advice.",
      } as T;
  }
}

export async function invokeMarketIntelligence<T>(
  action: MarketIntelligenceAction,
  payload: Record<string, unknown> = {},
): Promise<MarketIntelResponse<T>> {
  const fallback = localFallback<T>(action, payload);
  try {
    if (!isSupabaseConfigured || !supabase) {
      return { data: fallback, usedFallback: true, message: t("marketIntelSignInSupabase") };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { data: fallback, usedFallback: true, message: t("marketIntelSignInPro") };
    }

    logger.info(`[YouTrader:brave-news] invoke ${action}`);
    const { data, error } = await supabase.functions.invoke("market-intelligence", {
      body: { action, payload },
    });

    if (error) {
      const message = data?.error === "quota_exceeded" || data?.message?.includes("limit")
        ? AI_DAILY_LIMIT_MESSAGE
        : data?.error || "Market intelligence is temporarily unavailable.";
      logger.warn(`[YouTrader:brave-news] invoke_failed ${action}`, { message });
      return { data: fallback, usedFallback: true, message };
    }

    if (data?.error) {
      return {
        data: fallback,
        usedFallback: true,
        message: data.message || AI_DAILY_LIMIT_MESSAGE,
      };
    }

    return {
      data: (data?.data || fallback) as T,
      usedFallback: !!data?.usedFallback,
      message: data?.message,
      providerStatus: data?.providerStatus,
      quota: data?.quota,
    };
  } catch {
    return { data: fallback, usedFallback: true, message: t("marketIntelUnavailable") };
  }
}

export function fetchMarketSentiment(
  market = "NQ",
  headlines: { title: string; summary?: string; source?: string; time?: string; impact?: string; symbols?: string[] }[] = [],
  headlineHash?: string,
) {
  return invokeMarketIntelligence<MarketSentimentResult>("market_sentiment", { symbol: market, headlines, headlineHash });
}

export function fetchMarketNarrative() {
  return invokeMarketIntelligence<MarketNarrativeResult>("market_narrative");
}

export function fetchWatchlistRisk(symbols: string) {
  return invokeMarketIntelligence<WatchlistRiskResult>("watchlist_risk", { symbols });
}

export function fetchVolatilityRadar() {
  return invokeMarketIntelligence<VolatilityRadarResult>("volatility_radar");
}

export function fetchPreMarketBrief() {
  return invokeMarketIntelligence<PreMarketBriefResult>("pre_market_brief");
}

export function fetchNoiseFilter() {
  return invokeMarketIntelligence<NoiseFilterResult>("noise_filter");
}

export function fetchOpportunityScanner() {
  return invokeMarketIntelligence<OpportunityScannerResult>("opportunity_scanner");
}

export function fetchWhyMarketMoving(symbol: string) {
  return invokeMarketIntelligence<WhyMarketMovingResult>("why_market_moving", { symbol });
}
