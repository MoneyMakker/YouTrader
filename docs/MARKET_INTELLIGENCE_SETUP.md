# Market Intelligence Setup

YouTrader market intelligence is designed as shared cached data. Users read the same published Supabase rows. The app does not trigger crawling, scraping, or AI generation.

## What Was Added

- Supabase tables and RLS in `supabase/migrations/202606280001_market_intelligence.sql`
- Worker scaffold in `scripts/market-intel-worker`
- News tab upgraded to a Market Intelligence screen that reads cached data only
- Optional local Ollama summarization for backend workers, disabled by default

## Deploy Database

Apply the migration in Supabase SQL editor or with the Supabase CLI:

```bash
supabase db push
```

RLS allows `anon` and authenticated users to read only `status = 'published'` rows. There are no client insert/update/delete policies. Backend writes use the service role key outside the mobile app.

## Worker Setup

```bash
cp scripts/market-intel-worker/.env.example scripts/market-intel-worker/.env
```

Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `ECONOMIC_CALENDAR_JSON_URL`
- `ENABLE_LOCAL_LLM_SUMMARIES=true`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

Run:

```bash
npm run market-intel
```

Individual jobs:

```bash
npm run market-intel:news
npm run market-intel:prop-firms
npm run market-intel:calendar
npm run market-intel:daily-brief
npm run market-intel:watchlist
npm run market-intel:summary
```

## Scheduling

Recommended cadence:

- Market news: every 1-3 hours
- Prop firms: every 6-12 hours
- Economic calendar: daily
- Daily brief: once per day before the session
- Watchlist: once per morning
- Market summary: every few hours

Low-cost schedulers:

- GitHub Actions cron
- Local Mac cron
- Cheap VPS cron
- Render cron job
- Railway cron

Supabase Edge Functions can schedule simple TypeScript jobs, but Crawl4AI/browser-style Python crawling is better kept in a separate worker. Do not install crawler dependencies into the Expo app.

## Cost Rules

- Free users can read cached published intelligence.
- Pro users currently read the same shared cached intelligence.
- No user triggers crawler jobs.
- No user triggers paid OpenAI, Claude, Gemini, or hosted model calls.
- Ollama is optional and local-only for backend summaries.

## GitHub Actions Automation

The free scheduler is `.github/workflows/market-intelligence.yml`. It uses GitHub Actions cron and repository secrets. It does not require paid hosting.

Schedule:

- Market news + market summary: every 3 hours
- Prop firm monitor: every 12 hours
- Economic calendar + daily brief + watchlist: once every morning
- Manual workflow dispatch: can run `all` or a specific job

Add secrets exactly here:

1. Open the GitHub repository.
2. Go to **Settings**.
3. Go to **Secrets and variables**.
4. Open **Actions**.
5. Click **New repository secret**.
6. Add required secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Optional secret:
   - `ECONOMIC_CALENDAR_JSON_URL`

`ENABLE_LOCAL_LLM_SUMMARIES=false` is set directly in the workflow. Do not add OpenAI, Claude, Gemini, or other paid AI keys for this pipeline. Never put `SUPABASE_SERVICE_ROLE_KEY` into Expo public env variables.

## Economic Calendar Fallback

Calendar priority:

1. `ECONOMIC_CALENDAR_JSON_URL` if configured.
2. Deterministic macro fallback if no source is configured or the source fails.

The fallback publishes educational high-impact placeholders for the current week/month: CPI, PPI, FOMC, NFP, GDP, unemployment, Fed speakers, crude oil inventories, and rate decisions. It stores `event_name`, `event_date`, `event_time`, `importance`, `affected_assets`, `previous`, `forecast`, `actual`, `source`, `updated_at`, and `status`.

The fallback is not financial advice and is not a signal. It only keeps the cached calendar section populated until a real free JSON source is configured.

## App Read-Only Contract

The mobile app reads these published tables only:

- `market_news_items`
- `market_daily_briefs`
- `market_watchlists`
- `market_summaries`
- `prop_firm_updates`
- `economic_events`

The app must never trigger worker jobs, crawlers, scraping, or paid AI generation.
