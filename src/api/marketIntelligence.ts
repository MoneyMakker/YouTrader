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
  overallBias: string;
  biasPercent: number;
  confidence: string;
  drivers: string[];
  riskSuggestion: string;
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
  switch (action) {
    case "market_sentiment":
      return {
        overallBias: "Mixed",
        biasPercent: 50,
        confidence: "Medium",
        drivers: ["Macro headlines are mixed", "Volatility may expand around data"],
        riskSuggestion: "Reduce position size by 50%. Avoid revenge trading. Protect capital.",
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

export function fetchMarketSentiment(market = "NQ") {
  return invokeMarketIntelligence<MarketSentimentResult>("market_sentiment", { symbol: market });
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
