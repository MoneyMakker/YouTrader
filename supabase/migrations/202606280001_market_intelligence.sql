create extension if not exists pgcrypto;

create table if not exists public.market_news_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  url text,
  title text not null,
  summary text not null default '',
  assets text[] not null default '{}',
  topics text[] not null default '{}',
  impact text not null default 'LOW' check (impact in ('LOW', 'MED', 'HIGH')),
  bias jsonb not null default '{}'::jsonb,
  content_hash text not null unique,
  published_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.market_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null unique,
  title text not null default 'Daily Brief',
  market_regime text not null default 'Neutral',
  summary text not null default '',
  key_macro_events text[] not null default '{}',
  top_risks text[] not null default '{}',
  assets_to_watch text[] not null default '{}',
  volatility_warning text not null default '',
  prop_firm_caution text not null default '',
  what_not_to_do text not null default '',
  generated_by text not null default 'deterministic',
  generated_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.market_watchlists (
  id uuid primary key default gen_random_uuid(),
  watchlist_date date not null unique,
  items jsonb not null default '[]'::jsonb,
  disclaimer text not null default 'Educational market context only. Not financial advice.',
  generated_by text not null default 'deterministic',
  generated_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.market_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_key text not null unique default 'global',
  macro_tone text not null default 'Neutral',
  risk_mode text not null default 'Balanced',
  strongest_headlines text[] not null default '{}',
  asset_impact jsonb not null default '[]'::jsonb,
  important_calendar_events text[] not null default '{}',
  prop_firm_risk_warnings text[] not null default '{}',
  updated_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.prop_firm_updates (
  id uuid primary key default gen_random_uuid(),
  firm text not null,
  category text not null default 'rules',
  url text not null,
  page_title text not null default '',
  key_text text not null default '',
  content_hash text not null,
  detected_change_summary text not null default '',
  changed_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  unique (firm, url, content_hash)
);

create table if not exists public.economic_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_date date not null,
  event_time text not null default 'TBD',
  importance text not null default 'LOW' check (importance in ('LOW', 'MED', 'HIGH')),
  affected_assets text[] not null default '{}',
  previous text not null default '',
  forecast text not null default '',
  actual text not null default '',
  source text not null default 'manual',
  source_url text,
  updated_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  unique (source, event_name, event_date, event_time)
);

create table if not exists public.market_intel_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null check (status in ('started', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_processed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.market_news_items enable row level security;
alter table public.market_daily_briefs enable row level security;
alter table public.market_watchlists enable row level security;
alter table public.market_summaries enable row level security;
alter table public.prop_firm_updates enable row level security;
alter table public.economic_events enable row level security;
alter table public.market_intel_runs enable row level security;

drop policy if exists "Read published market news" on public.market_news_items;
create policy "Read published market news"
  on public.market_news_items for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Read published daily briefs" on public.market_daily_briefs;
create policy "Read published daily briefs"
  on public.market_daily_briefs for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Read published watchlists" on public.market_watchlists;
create policy "Read published watchlists"
  on public.market_watchlists for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Read published market summaries" on public.market_summaries;
create policy "Read published market summaries"
  on public.market_summaries for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Read published prop firm updates" on public.prop_firm_updates;
create policy "Read published prop firm updates"
  on public.prop_firm_updates for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Read published economic events" on public.economic_events;
create policy "Read published economic events"
  on public.economic_events for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Read market intel run status" on public.market_intel_runs;
create policy "Read market intel run status"
  on public.market_intel_runs for select
  to authenticated
  using (status = 'success');
