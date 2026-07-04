type BraveNewsResult = {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: string;
};

type CacheEntry = { expiresAt: number; results: BraveNewsResult[] };

const CACHE_TTL_MS = 7 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

const DEFAULT_MARKETS = ["NQ", "ES", "SPY", "QQQ", "NASDAQ", "S&P 500", "NVDA", "AAPL", "TSLA", "META", "AMD"];

export function defaultMarketSymbols() {
  return DEFAULT_MARKETS;
}

export async function fetchBraveMarketNews(input: {
  query?: string;
  symbols?: string[];
  count?: number;
}): Promise<BraveNewsResult[]> {
  const apiKey = env("BRAVE_SEARCH_API_KEY");
  if (!apiKey) {
    console.warn("[YouTrader:brave-news] missing_api_key");
    return [];
  }

  const symbols = (input.symbols?.length ? input.symbols : DEFAULT_MARKETS).slice(0, 6);
  const query = input.query || `${symbols.join(" OR ")} market news last hour`;
  const count = Math.min(10, Math.max(3, input.count || 5));
  const cacheKey = `${query}:${count}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log("[YouTrader:brave-news] cache_hit", { query: query.slice(0, 40) });
    return cached.results;
  }

  const url = new URL("https://api.search.brave.com/res/v1/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("freshness", "pd");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    console.error("[YouTrader:brave-news] fetch_failed", { status: response.status });
    return cached?.results || [];
  }

  const json = await response.json();
  const results: BraveNewsResult[] = (json?.results || []).slice(0, count).map((item: Record<string, unknown>) => ({
    title: String(item.title || "Market headline"),
    url: String(item.url || ""),
    description: String(item.description || item.snippet || ""),
    age: item.age ? String(item.age) : undefined,
    source: item.meta_url?.hostname ? String((item.meta_url as { hostname?: string }).hostname) : undefined,
  }));

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, results });
  console.log("[YouTrader:brave-news] fetch_ok", { count: results.length });
  return results;
}

export function formatBraveArticlesForPrompt(articles: BraveNewsResult[]) {
  if (!articles.length) return "No recent headlines returned.";
  return articles
    .map((article, index) =>
      [`HEADLINE ${index + 1}`, article.title, article.description, article.source ? `Source: ${article.source}` : null]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
