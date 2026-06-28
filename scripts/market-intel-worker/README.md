# YouTrader Market Intelligence Worker

This worker collects shared market intelligence on a schedule and writes cached results to Supabase. The mobile app only reads published cached rows with the anon key. It never runs crawlers, scrapers, paid AI, or per-user generation.

## Setup

1. Apply `supabase/migrations/202606280001_market_intelligence.sql`.
2. Copy `.env.example` to `.env`.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run a job:

```bash
node scripts/market-intel-worker/index.mjs all
```

## Jobs

```bash
node scripts/market-intel-worker/index.mjs news
node scripts/market-intel-worker/index.mjs prop-firms
node scripts/market-intel-worker/index.mjs calendar
node scripts/market-intel-worker/index.mjs daily-brief
node scripts/market-intel-worker/index.mjs watchlist
node scripts/market-intel-worker/index.mjs summary
node scripts/market-intel-worker/index.mjs all
```

## Suggested Cron

- News: every 1-3 hours
- Prop firms: every 6-12 hours
- Economic calendar: daily
- Daily brief: once per morning
- Watchlist: once per morning
- Market summary: every few hours

Examples:

```cron
0 */2 * * * cd /app && node scripts/market-intel-worker/index.mjs news
15 */6 * * * cd /app && node scripts/market-intel-worker/index.mjs prop-firms
30 5 * * * cd /app && node scripts/market-intel-worker/index.mjs calendar
45 6 * * * cd /app && node scripts/market-intel-worker/index.mjs daily-brief
0 7 * * * cd /app && node scripts/market-intel-worker/index.mjs watchlist
30 */3 * * * cd /app && node scripts/market-intel-worker/index.mjs summary
```

Good low-cost hosts: GitHub Actions cron, local Mac cron, a cheap VPS, Render cron, or Railway cron. Supabase Edge Functions are not used for Crawl4AI-style crawling because that environment is not a good fit for Python/browser crawler dependencies.

## Optional Local LLM

Set `ENABLE_LOCAL_LLM_SUMMARIES=true` with `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to let a local Ollama model refine deterministic summaries. If Ollama is missing or fails, the worker falls back to deterministic output.

No OpenAI, Claude, Gemini, or paid hosted model is used by default.

## GitHub Actions

`.github/workflows/market-intelligence.yml` runs this worker on GitHub Actions using repository secrets.

Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `ECONOMIC_CALENDAR_JSON_URL`. Add them in GitHub: Repository -> Settings -> Secrets and variables -> Actions -> New repository secret.

The workflow sets `ENABLE_LOCAL_LLM_SUMMARIES=false`, so it does not call paid AI or local Ollama in CI.

The CLI accepts one job, `all`, or comma-separated jobs, for example:

```bash
node scripts/market-intel-worker/index.mjs news,summary
node scripts/market-intel-worker/index.mjs calendar,daily-brief,watchlist
```

If `ECONOMIC_CALENDAR_JSON_URL` is not configured, the calendar job writes deterministic high-impact macro fallback rows instead of returning zero rows.
