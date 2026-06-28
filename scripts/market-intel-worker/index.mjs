import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
loadEnv(path.join(ROOT, "scripts/market-intel-worker/.env"));

const SUPABASE_URL = mustEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
const ENABLE_LOCAL_LLM_SUMMARIES = process.env.ENABLE_LOCAL_LLM_SUMMARIES === "true";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const TODAY = new Date().toISOString().slice(0, 10);
const ASSETS = ["ES", "NQ", "GOLD", "OIL", "BTC", "ETH"];
const CALENDAR_KEYWORDS = /(CPI|PPI|FOMC|NFP|nonfarm|GDP|unemployment|Fed|Powell|rate decision|crude oil inventories|EIA petroleum)/i;

const NEWS_FEEDS = [
  { source: "Google News Macro", url: "https://news.google.com/rss/search?q=(FOMC%20OR%20CPI%20OR%20PPI%20OR%20NFP%20OR%20inflation%20OR%20interest%20rates)%20markets&hl=en-US&gl=US&ceid=US:en" },
  { source: "Google News Futures", url: "https://news.google.com/rss/search?q=(ES%20OR%20NQ%20OR%20Nasdaq%20futures%20OR%20S%26P%20futures%20OR%20gold%20OR%20crude%20oil%20OR%20Bitcoin%20OR%20Ethereum)&hl=en-US&gl=US&ceid=US:en" },
];

const PROP_FIRM_PAGES = [
  { firm: "Topstep", category: "rules", url: "https://www.topstep.com/rules/" },
  { firm: "Topstep", category: "payouts", url: "https://www.topstep.com/payouts/" },
  { firm: "Apex", category: "rules", url: "https://apextraderfunding.com/member-faq/" },
  { firm: "Take Profit Trader", category: "rules", url: "https://takeprofittrader.com/rules/" },
  { firm: "FundingPips", category: "rules", url: "https://fundingpips.com/faq/" },
  { firm: "MyFundedFutures", category: "rules", url: "https://myfundedfutures.com/rules/" },
  { firm: "Tradeify", category: "rules", url: "https://tradeify.co/rules/" },
  { firm: "Bulenox", category: "rules", url: "https://bulenox.com/faq/" },
];

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith("#")) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function mustEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isoFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextWeekday(base, weekday, minDays = 0) {
  const start = addDays(base, minDays);
  const diff = (weekday - start.getUTCDay() + 7) % 7;
  return addDays(start, diff || 7);
}

function firstWeekdayOfNextMonth(base, weekday) {
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const diff = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(first, diff);
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html) {
  return cleanHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function detectAssets(text) {
  const lower = text.toLowerCase();
  return ASSETS.filter((asset) => {
    if (asset === "ES") return /\bs&p|spx|es\b|equity futures/.test(lower);
    if (asset === "NQ") return /\bnasdaq|nq\b|tech/.test(lower);
    if (asset === "GOLD") return /\bgold|xau|treasury|yield|dollar/.test(lower);
    if (asset === "OIL") return /\boil|crude|wti|brent|inventory/.test(lower);
    if (asset === "BTC") return /\bbitcoin|btc|crypto/.test(lower);
    if (asset === "ETH") return /\bethereum|eth|crypto/.test(lower);
    return false;
  });
}

function detectTopics(text) {
  const lower = text.toLowerCase();
  return ["fed", "cpi", "ppi", "fomc", "nfp", "interest rates", "inflation", "macro risk", "market-moving headlines"]
    .filter((topic) => lower.includes(topic));
}

function impactFromText(text) {
  const lower = text.toLowerCase();
  if (/(fomc|cpi|ppi|nfp|payroll|rate decision|fed|powell|inflation)/.test(lower)) return "HIGH";
  if (/(oil|inventory|treasury|yield|dollar|bitcoin|ethereum|gdp|unemployment)/.test(lower)) return "MED";
  return "LOW";
}

function biasFromText(text) {
  const lower = text.toLowerCase();
  const riskOff = /(hot inflation|higher yields|rate hike|hawkish|selloff|recession|war|risk-off)/.test(lower);
  const riskOn = /(cooling inflation|rate cut|dovish|rally|risk-on|soft landing)/.test(lower);
  return Object.fromEntries(ASSETS.map((asset) => {
    if (riskOff) return [asset, asset === "GOLD" ? "LONG" : "SHORT"];
    if (riskOn) return [asset, asset === "GOLD" ? "SHORT" : "LONG"];
    return [asset, "NEUTRAL"];
  }));
}

async function request(pathname, options = {}) {
  const url = new URL(`/rest/v1/${pathname}`, SUPABASE_URL);
  for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: options.prefer || "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return [];
  return request(table, {
    method: "POST",
    query: onConflict ? { on_conflict: onConflict } : {},
    prefer: "resolution=merge-duplicates,return=representation",
    body: rows,
  });
}

async function startRun(runType) {
  const [row] = await request("market_intel_runs", {
    method: "POST",
    body: [{ run_type: runType, status: "started" }],
  });
  return row.id;
}

async function finishRun(id, status, itemsProcessed, errorMessage = "") {
  await request("market_intel_runs", {
    method: "PATCH",
    query: { id: `eq.${id}` },
    body: { status, finished_at: new Date().toISOString(), items_processed: itemsProcessed, error_message: errorMessage },
  });
}

async function collectNews() {
  const rows = [];
  for (const feed of NEWS_FEEDS) {
    const xml = await fetch(feed.url).then((res) => res.text());
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 20)) {
      const title = cleanHtml(item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)?.[1] || item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
      const summary = cleanHtml(item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i)?.[1] || "");
      const url = cleanHtml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
      const publishedAt = new Date(cleanHtml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || Date.now())).toISOString();
      const text = `${title} ${summary}`;
      if (!title || !/(ES|NQ|gold|oil|BTC|ETH|Fed|CPI|PPI|FOMC|NFP|interest|inflation|macro|market)/i.test(text)) continue;
      rows.push({
        source: feed.source,
        url,
        title,
        summary: summary.slice(0, 600),
        assets: detectAssets(text),
        topics: detectTopics(text),
        impact: impactFromText(text),
        bias: biasFromText(text),
        content_hash: hash(`${feed.source}:${url || title}`),
        published_at: publishedAt,
        fetched_at: new Date().toISOString(),
        status: "published",
      });
    }
  }
  return upsert("market_news_items", rows, "content_hash");
}

async function checkPropFirms() {
  const rows = [];
  for (const page of PROP_FIRM_PAGES) {
    try {
      const html = await fetch(page.url).then((res) => res.text());
      const keyText = cleanHtml(html)
        .split(/(?=rule|payout|drawdown|daily loss|scaling|evaluation|account size|discount|promo)/i)
        .join(" ")
        .slice(0, 2500);
      const contentHash = hash(`${page.firm}:${page.url}:${keyText}`);
      const existing = await request("prop_firm_updates", {
        query: { firm: `eq.${page.firm}`, url: `eq.${page.url}`, order: "changed_at.desc", limit: "1" },
      });
      const previousHash = existing?.[0]?.content_hash;
      rows.push({
        firm: page.firm,
        category: page.category,
        url: page.url,
        page_title: titleFromHtml(html),
        key_text: keyText,
        content_hash: contentHash,
        detected_change_summary: previousHash && previousHash !== contentHash
          ? "Important rule or offer text changed since the previous monitor run."
          : "Baseline monitor snapshot. No prior changed version detected.",
        changed_at: previousHash === contentHash && existing?.[0]?.changed_at ? existing[0].changed_at : new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        status: "published",
      });
    } catch (error) {
      console.warn(`Prop firm check failed for ${page.firm}: ${error.message}`);
    }
  }
  return upsert("prop_firm_updates", rows, "firm,url,content_hash");
}

function normalizeCalendarEvent(event, source, sourceUrl = "") {
  const eventName = String(event.name || event.event || event.title || event.event_name || "").trim();
  if (!eventName || !CALENDAR_KEYWORDS.test(eventName)) return null;
  const text = `${eventName} ${event.importance || event.impact || ""} ${event.assets || ""}`;
  const eventDate = String(event.date || event.event_date || TODAY).slice(0, 10);
  return {
    event_name: eventName,
    event_date: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : TODAY,
    event_time: String(event.time || event.event_time || "TBD"),
    importance: impactFromText(text),
    affected_assets: detectAssets(text).length ? detectAssets(text) : ["ES", "NQ", "GOLD"],
    previous: String(event.previous || ""),
    forecast: String(event.forecast || event.consensus || ""),
    actual: String(event.actual || ""),
    source,
    source_url: sourceUrl,
    updated_at: new Date().toISOString(),
    status: "published",
  };
}

async function collectConfiguredCalendar() {
  const sourceUrl = process.env.ECONOMIC_CALENDAR_JSON_URL;
  if (!sourceUrl) return [];
  try {
    const data = await fetch(sourceUrl).then((res) => {
      if (!res.ok) throw new Error(`calendar source HTTP ${res.status}`);
      return res.json();
    });
    const raw = Array.isArray(data) ? data : data.events || data.data || [];
    return raw.map((event) => normalizeCalendarEvent(event, "calendar-json", sourceUrl)).filter(Boolean);
  } catch (error) {
    console.warn(`Configured calendar source failed: ${error.message}`);
    return [];
  }
}

function deterministicCalendarFallback() {
  const base = new Date(`${TODAY}T12:00:00.000Z`);
  const cpi = nextWeekday(base, 2, 1);
  const ppi = addDays(cpi, 1);
  const inventories = nextWeekday(base, 3, 0);
  const fedSpeaker = nextWeekday(base, 4, 0);
  const fomc = firstWeekdayOfNextMonth(base, 3);
  const nfp = firstWeekdayOfNextMonth(base, 5);
  const gdp = nextWeekday(base, 4, 7);
  const unemployment = nfp;
  const rateDecision = fomc;
  return [
    { name: "CPI Inflation", date: isoFromDate(cpi), time: "08:30 AM", importance: "HIGH", assets: "ES NQ GOLD BTC ETH", previous: "", forecast: "", actual: "" },
    { name: "PPI Inflation", date: isoFromDate(ppi), time: "08:30 AM", importance: "HIGH", assets: "ES NQ GOLD", previous: "", forecast: "", actual: "" },
    { name: "Crude Oil Inventories", date: isoFromDate(inventories), time: "10:30 AM", importance: "MED", assets: "OIL ES", previous: "", forecast: "", actual: "" },
    { name: "Fed Speaker", date: isoFromDate(fedSpeaker), time: "TBD", importance: "MED", assets: "ES NQ GOLD", previous: "", forecast: "", actual: "" },
    { name: "FOMC Rate Decision", date: isoFromDate(rateDecision), time: "02:00 PM", importance: "HIGH", assets: "ES NQ GOLD BTC ETH", previous: "", forecast: "", actual: "" },
    { name: "Nonfarm Payrolls (NFP)", date: isoFromDate(nfp), time: "08:30 AM", importance: "HIGH", assets: "ES NQ GOLD", previous: "", forecast: "", actual: "" },
    { name: "Unemployment Rate", date: isoFromDate(unemployment), time: "08:30 AM", importance: "HIGH", assets: "ES NQ GOLD", previous: "", forecast: "", actual: "" },
    { name: "GDP Growth Rate", date: isoFromDate(gdp), time: "08:30 AM", importance: "HIGH", assets: "ES NQ GOLD", previous: "", forecast: "", actual: "" },
  ].map((event) => normalizeCalendarEvent(event, "deterministic-macro-fallback", ""));
}

async function collectCalendar() {
  const configuredRows = await collectConfiguredCalendar();
  const rows = configuredRows.length ? configuredRows : deterministicCalendarFallback();
  return upsert("economic_events", rows, "source,event_name,event_date,event_time");
}

async function latest(table, query = {}) {
  return request(table, { query });
}

async function generateDailyBrief() {
  const [news, events, prop] = await Promise.all([
    latest("market_news_items", { status: "eq.published", order: "published_at.desc", limit: "8" }),
    latest("economic_events", { status: "eq.published", event_date: `gte.${TODAY}`, order: "event_date.asc", limit: "8" }),
    latest("prop_firm_updates", { status: "eq.published", order: "changed_at.desc", limit: "4" }),
  ]);
  const highRisk = [...news, ...events].filter((item) => item.impact === "HIGH" || item.importance === "HIGH");
  let summary = `${highRisk.length ? "High-impact macro catalysts are active." : "Macro tone is mixed with no dominant high-impact cache yet."} Watch liquidity, spread expansion, and funded-account rule limits.`;
  const generatedBy = ENABLE_LOCAL_LLM_SUMMARIES ? "ollama-or-deterministic" : "deterministic";
  const local = await optionalOllama(`Write a concise trader daily brief from these cached facts: ${JSON.stringify({ news: news.slice(0, 5), events: events.slice(0, 5), prop: prop.slice(0, 3) })}`);
  if (local) summary = local.slice(0, 900);
  return upsert("market_daily_briefs", [{
    brief_date: TODAY,
    title: "Daily Brief",
    market_regime: highRisk.length >= 2 ? "Event-driven volatility" : "Balanced macro risk",
    summary,
    key_macro_events: events.slice(0, 5).map((e) => `${e.event_time} ${e.event_name}`),
    top_risks: highRisk.slice(0, 4).map((e) => e.title || e.event_name),
    assets_to_watch: Array.from(new Set(news.flatMap((n) => n.assets || []))).slice(0, 6),
    volatility_warning: "Expect volatility expansion near red-folder macro releases and headline shocks.",
    prop_firm_caution: prop.length ? "Check payout, drawdown, and daily-loss rules before trading funded accounts." : "No prop firm changes are currently published.",
    what_not_to_do: "Do not chase the first data-release impulse or size up to recover losses.",
    generated_by: generatedBy,
    generated_at: new Date().toISOString(),
    status: "published",
  }], "brief_date");
}

async function generateWatchlist() {
  const news = await latest("market_news_items", { status: "eq.published", order: "published_at.desc", limit: "30" });
  const items = ASSETS.map((asset) => {
    const related = news.filter((item) => (item.assets || []).includes(asset)).slice(0, 3);
    const high = related.some((item) => item.impact === "HIGH");
    const directional = related.map((item) => item.bias?.[asset]).filter((x) => x && x !== "NEUTRAL");
    const bias = directional[0] || "NEUTRAL";
    return {
      asset,
      bias,
      confidence: high ? "MED" : related.length >= 2 ? "MED" : "LOW",
      reason: related.length ? `Recent cached headlines mention ${asset} with ${high ? "high" : "moderate"} macro sensitivity.` : "No strong cached headline cluster yet.",
      related_news_events: related.map((item) => item.title).join(" | "),
      caution: "Educational market context only. Not financial advice.",
      timestamp: new Date().toISOString(),
    };
  });
  return upsert("market_watchlists", [{
    watchlist_date: TODAY,
    items,
    disclaimer: "Educational market context only. Not financial advice.",
    generated_by: "deterministic",
    generated_at: new Date().toISOString(),
    status: "published",
  }], "watchlist_date");
}

async function generateSummary() {
  const [news, events, prop] = await Promise.all([
    latest("market_news_items", { status: "eq.published", order: "published_at.desc", limit: "10" }),
    latest("economic_events", { status: "eq.published", event_date: `gte.${TODAY}`, order: "event_date.asc", limit: "6" }),
    latest("prop_firm_updates", { status: "eq.published", order: "changed_at.desc", limit: "5" }),
  ]);
  const assetImpact = ASSETS.map((asset) => {
    const related = news.filter((item) => (item.assets || []).includes(asset));
    const tone = related.map((item) => item.bias?.[asset]).find((x) => x && x !== "NEUTRAL") || "NEUTRAL";
    return { asset, tone, impact: related[0]?.title || "No major cached impact." };
  });
  return upsert("market_summaries", [{
    summary_key: "global",
    macro_tone: news.some((n) => n.impact === "HIGH") ? "Headline-sensitive" : "Mixed",
    risk_mode: news.some((n) => /risk-off|selloff|hawkish/i.test(`${n.title} ${n.summary}`)) ? "Risk-off" : "Balanced",
    strongest_headlines: news.slice(0, 5).map((n) => n.title),
    asset_impact: assetImpact,
    important_calendar_events: events.slice(0, 5).map((e) => `${e.event_date} ${e.event_time} ${e.event_name}`),
    prop_firm_risk_warnings: prop.slice(0, 5).map((p) => `${p.firm}: ${p.detected_change_summary}`),
    updated_at: new Date().toISOString(),
    status: "published",
  }], "summary_key");
}

async function optionalOllama(prompt) {
  if (!ENABLE_LOCAL_LLM_SUMMARIES) return "";
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data.response || "").trim();
  } catch {
    return "";
  }
}

async function runJob(name, fn) {
  const runId = await startRun(name);
  try {
    const rows = await fn();
    await finishRun(runId, "success", rows?.length || 0);
    console.log(`${name}: ${rows?.length || 0} rows`);
  } catch (error) {
    await finishRun(runId, "failed", 0, error.message);
    throw error;
  }
}

const jobs = {
  news: collectNews,
  "prop-firms": checkPropFirms,
  calendar: collectCalendar,
  "daily-brief": generateDailyBrief,
  watchlist: generateWatchlist,
  summary: generateSummary,
};

function normalizeSelectedJobs(argv) {
  const raw = argv.slice(2);
  if (!raw.length) return ["all"];
  return raw.flatMap((item) => item.split(",")).map((item) => item.replace(/^--/, "").trim()).filter(Boolean);
}

const selectedJobs = normalizeSelectedJobs(process.argv);
const runAll = selectedJobs.includes("all");
const queue = runAll ? ["news", "prop-firms", "calendar", "daily-brief", "watchlist", "summary"] : selectedJobs;
for (const name of queue) {
  if (!jobs[name]) {
    console.error(`Unknown job "${name}". Use one of: ${Object.keys(jobs).join(", ")}, all`);
    process.exit(1);
  }
  await runJob(name, jobs[name]);
}
