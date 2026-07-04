export type MarketIntelligenceAction =
  | "market_sentiment"
  | "market_narrative"
  | "watchlist_risk"
  | "volatility_radar"
  | "pre_market_brief"
  | "noise_filter"
  | "opportunity_scanner"
  | "why_market_moving";

export const MARKET_ACTIONS: MarketIntelligenceAction[] = [
  "market_sentiment",
  "market_narrative",
  "watchlist_risk",
  "volatility_radar",
  "pre_market_brief",
  "noise_filter",
  "opportunity_scanner",
  "why_market_moving",
];

export function isMarketIntelligenceAction(value: unknown): value is MarketIntelligenceAction {
  return typeof value === "string" && MARKET_ACTIONS.includes(value as MarketIntelligenceAction);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const arr = value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  return arr.length ? arr.slice(0, 8) : fallback;
}

function riskLevel(value: unknown) {
  return value === "Low" || value === "Medium" || value === "High" || value === "Very High" ? value : "Medium";
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

export function schemaInstruction(action: MarketIntelligenceAction) {
  const schemas: Record<MarketIntelligenceAction, string> = {
    market_sentiment:
      '{"overallBias":"Bearish|Bullish|Mixed","biasPercent":0,"confidence":"Low|Medium|High","drivers":[],"riskSuggestion":"","disclaimer":"This is not financial advice. Use alongside your own trading plan."}',
    market_narrative: '{"title":"Today\'s Story","bullets":[],"disclaimer":"This is not financial advice."}',
    watchlist_risk:
      '{"symbols":[{"symbol":"","risk":"Low|Medium|High","explanation":""}],"disclaimer":"This is not financial advice."}',
    volatility_radar:
      '{"volatility":"Low|Medium|High|Very High","behaviorSuggestion":"","drivers":[],"disclaimer":"This is not financial advice."}',
    pre_market_brief:
      '{"mission":"","macroEvents":[],"fedNotes":"","earnings":[],"highRiskStocks":[],"psychologyReminder":"","expectedVolatility":"","riskSuggestion":"","disclaimer":"This is not financial advice."}',
    noise_filter:
      '{"stories":[{"title":"","whyItMatters":""}],"disclaimer":"This is not financial advice."}',
    opportunity_scanner:
      '{"sectors":[{"name":"","direction":"Up|Down|Neutral","note":""}],"disclaimer":"This is not financial advice."}',
    why_market_moving:
      '{"symbol":"","explanation":"","disclaimer":"This is not financial advice."}',
  };
  return schemas[action];
}

export function normalizeMarketOutput(action: MarketIntelligenceAction, value: Record<string, unknown>) {
  switch (action) {
    case "market_sentiment":
      return {
        overallBias: stringValue(value.overallBias, "Mixed"),
        biasPercent: Math.max(0, Math.min(100, Number(value.biasPercent) || 50)),
        confidence: stringValue(value.confidence, "Medium"),
        drivers: stringArray(value.drivers, ["Recent headlines suggest mixed sentiment."]),
        riskSuggestion: stringValue(value.riskSuggestion, "Reduce position size and protect capital."),
        disclaimer: "This is not financial advice. Use alongside your own trading plan.",
      };
    case "market_narrative":
      return {
        title: stringValue(value.title, "Today's Story"),
        bullets: stringArray(value.bullets, ["Markets are digesting recent macro headlines."]),
        disclaimer: "This is not financial advice.",
      };
    case "watchlist_risk":
      return {
        symbols: Array.isArray(value.symbols)
          ? value.symbols.slice(0, 8).map((row: Record<string, unknown>) => ({
              symbol: stringValue(row.symbol, "—"),
              risk: riskLevel(row.risk) === "Very High" ? "High" : riskLevel(row.risk),
              explanation: stringValue(row.explanation, "Recent headline flow warrants caution."),
            }))
          : [],
        disclaimer: "This is not financial advice.",
      };
    case "volatility_radar":
      return {
        volatility: riskLevel(value.volatility),
        behaviorSuggestion: stringValue(value.behaviorSuggestion, "Trade smaller and wait for clarity."),
        drivers: stringArray(value.drivers, ["Macro headlines", "Session liquidity"]),
        disclaimer: "This is not financial advice.",
      };
    case "pre_market_brief":
      return {
        mission: stringValue(value.mission, "Protect capital and trade planned setups only."),
        macroEvents: stringArray(value.macroEvents, []),
        fedNotes: stringValue(value.fedNotes, "Monitor rates and macro headlines."),
        earnings: stringArray(value.earnings, []),
        highRiskStocks: stringArray(value.highRiskStocks, []),
        psychologyReminder: stringValue(value.psychologyReminder, "Avoid revenge trading."),
        expectedVolatility: stringValue(value.expectedVolatility, "Medium"),
        riskSuggestion: stringValue(value.riskSuggestion, "Reduce size by 50% if volatility expands."),
        disclaimer: "This is not financial advice.",
      };
    case "noise_filter":
      return {
        stories: Array.isArray(value.stories)
          ? value.stories.slice(0, 5).map((row: Record<string, unknown>) => ({
              title: stringValue(row.title, "Market headline"),
              whyItMatters: stringValue(row.whyItMatters, "May affect volatility."),
            }))
          : [],
        disclaimer: "This is not financial advice.",
      };
    case "opportunity_scanner":
      return {
        sectors: Array.isArray(value.sectors)
          ? value.sectors.slice(0, 6).map((row: Record<string, unknown>) => ({
              name: stringValue(row.name, "Sector"),
              direction: stringValue(row.direction, "Neutral"),
              note: stringValue(row.note, "Mixed attention today."),
            }))
          : [],
        disclaimer: "This is not financial advice.",
      };
    case "why_market_moving":
      return {
        symbol: stringValue(value.symbol, "NQ"),
        explanation: stringValue(
          value.explanation,
          "Price action reflects recent macro and headline-driven volatility.",
        ),
        disclaimer: "This is not financial advice.",
      };
  }
}

export function fallbackMarketOutput(action: MarketIntelligenceAction, payload: Record<string, unknown>) {
  const symbol = stringValue(payload.symbol, "NQ");
  switch (action) {
    case "market_sentiment":
      return normalizeMarketOutput(action, {
        overallBias: "Mixed",
        biasPercent: 50,
        confidence: "Medium",
        drivers: ["Headline flow is mixed", "Macro data still settling"],
        riskSuggestion: "Reduce position size by 50%. Avoid revenge trading. Protect capital.",
      });
    case "market_narrative":
      return normalizeMarketOutput(action, {
        title: "Today's Story",
        bullets: ["Tech under review", "Macro headlines driving volatility", "Trade smaller until clarity improves"],
      });
    case "watchlist_risk":
      return normalizeMarketOutput(action, {
        symbols: String(payload.symbols || "NVDA,AAPL")
          .split(/[,\s]+/)
          .filter(Boolean)
          .slice(0, 4)
          .map((item) => ({ symbol: item.toUpperCase(), risk: "Medium", explanation: "Recent news flow needs monitoring." })),
      });
    case "volatility_radar":
      return normalizeMarketOutput(action, {
        volatility: "Medium",
        behaviorSuggestion: "Wait for the first hour to settle before sizing up.",
        drivers: ["Macro releases", "Index leadership shifts"],
      });
    case "pre_market_brief":
      return normalizeMarketOutput(action, {
        mission: "Trade only planned setups. Protect capital first.",
        macroEvents: ["Check economic calendar before the open"],
        psychologyReminder: "No revenge trades after a red start.",
        expectedVolatility: "Medium",
        riskSuggestion: "Cut size if the open is chaotic.",
      });
    case "noise_filter":
      return normalizeMarketOutput(action, {
        stories: [{ title: "Macro headlines dominate", whyItMatters: "Volatility may expand around data releases." }],
      });
    case "opportunity_scanner":
      return normalizeMarketOutput(action, {
        sectors: [
          { name: "Semiconductors", direction: "Up", note: "Headline attention" },
          { name: "Energy", direction: "Neutral", note: "Mixed flow" },
        ],
      });
    case "why_market_moving":
      return normalizeMarketOutput(action, {
        symbol,
        explanation: `${symbol} is moving on headline-driven volatility and macro sensitivity today.`,
      });
  }
}
