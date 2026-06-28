-- Additive runtime schema used by the current mobile app.
-- Keep this migration self-contained so a fresh Supabase project can be built
-- from supabase/migrations without first running standalone schema files.

create table if not exists public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  account_name text not null,
  account_size numeric not null check (account_size > 0),
  daily_loss_limit numeric not null check (daily_loss_limit > 0),
  max_loss_limit numeric not null check (max_loss_limit > 0),
  evaluation_contracts integer not null check (evaluation_contracts > 0),
  live_contracts integer not null check (live_contracts > 0),
  trailing_drawdown boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_firm_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prop_firm_id uuid references public.prop_firms(id) on delete set null,
  mode text not null default 'evaluation' check (mode in ('evaluation', 'live')),
  account_size numeric not null check (account_size > 0),
  daily_loss_limit numeric not null check (daily_loss_limit > 0),
  max_loss_limit numeric not null check (max_loss_limit > 0),
  max_contracts integer not null check (max_contracts > 0),
  alerts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  trade_date date not null,
  symbol text not null,
  direction text not null check (direction in ('LONG', 'SHORT')),
  entry_time text,
  exit_time text,
  contracts numeric not null default 1 check (contracts > 0),
  entry numeric,
  exit numeric,
  stop_loss numeric,
  take_profit numeric,
  pnl numeric not null default 0,
  mood text,
  notes text,
  screenshot_url text,
  voice_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, client_id)
);

create table if not exists public.risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prop_firm_id uuid references public.prop_firms(id) on delete set null,
  snapshot_date date not null,
  mode text not null check (mode in ('evaluation', 'live')),
  day_pnl numeric not null default 0,
  week_pnl numeric not null default 0,
  month_pnl numeric not null default 0,
  total_pnl numeric not null default 0,
  daily_loss_buffer numeric not null default 0,
  account_buffer numeric not null default 0,
  expectancy numeric not null default 0,
  sharpe_ratio numeric not null default 0,
  consistency_score numeric not null default 0,
  loss_streak integer not null default 0,
  recommended_family text not null check (recommended_family in ('micro', 'emini')),
  recommended_contracts integer not null default 0,
  coach_message text not null,
  created_at timestamptz not null default now()
);

alter table public.trade_journal
  add column if not exists client_id text,
  add column if not exists deleted_at timestamptz,
  add column if not exists entry_time text,
  add column if not exists exit_time text;

update public.trade_journal
set client_id = id::text
where client_id is null;

alter table public.trade_journal
  alter column client_id set not null;

create unique index if not exists trade_journal_user_client_id_key
on public.trade_journal(user_id, client_id);

create index if not exists trade_journal_user_date_idx
on public.trade_journal(user_id, trade_date desc);

create index if not exists trade_journal_user_updated_idx
on public.trade_journal(user_id, updated_at desc);

create index if not exists risk_snapshots_user_date_idx
on public.risk_snapshots(user_id, snapshot_date desc);

alter table public.prop_firms enable row level security;
alter table public.user_firm_settings enable row level security;
alter table public.trade_journal enable row level security;
alter table public.risk_snapshots enable row level security;

drop policy if exists "Prop firm templates are readable" on public.prop_firms;
create policy "Prop firm templates are readable"
on public.prop_firms for select
to authenticated
using (true);

drop policy if exists "Users manage own firm settings" on public.user_firm_settings;
create policy "Users manage own firm settings"
on public.user_firm_settings for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own trades" on public.trade_journal;
create policy "Users manage own trades"
on public.trade_journal for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own risk snapshots" on public.risk_snapshots;
create policy "Users manage own risk snapshots"
on public.risk_snapshots for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select on public.prop_firms to authenticated;
grant select, insert, update, delete on public.user_firm_settings to authenticated;
grant select, insert, update, delete on public.trade_journal to authenticated;
grant select, insert, update, delete on public.risk_snapshots to authenticated;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_id text not null,
  status text not null,
  product_id text,
  store text,
  environment text,
  expires_at timestamptz,
  original_transaction_id text,
  latest_transaction_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entitlement_id)
);

create index if not exists user_subscriptions_user_entitlement_idx
on public.user_subscriptions(user_id, entitlement_id);

create index if not exists user_subscriptions_active_idx
on public.user_subscriptions(user_id, entitlement_id, status, expires_at);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscriptions" on public.user_subscriptions;
create policy "Users read own subscriptions"
on public.user_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.user_subscriptions to authenticated;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (
    action in (
      'weekly_coach',
      'risk_predictor',
      'journal_summary',
      'daily_plan',
      'news_explainer',
      'daily_challenge'
    )
  ),
  period_key text not null,
  provider text not null default 'local',
  used_fallback boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_action_created_idx
on public.ai_usage_events(user_id, action, created_at desc);

create index if not exists ai_usage_events_user_period_idx
on public.ai_usage_events(user_id, period_key);

alter table public.ai_usage_events enable row level security;

drop policy if exists "Users read own ai usage events" on public.ai_usage_events;
create policy "Users read own ai usage events"
on public.ai_usage_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own ai usage events" on public.ai_usage_events;
create policy "Users insert own ai usage events"
on public.ai_usage_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

grant select, insert on public.ai_usage_events to authenticated;

create table if not exists public.achievement_share_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  achievement_title text not null,
  is_pro_snapshot boolean not null default false,
  shared_at timestamptz not null default now()
);

create index if not exists achievement_share_usage_user_shared_idx
on public.achievement_share_usage(user_id, shared_at desc);

alter table public.achievement_share_usage enable row level security;

drop policy if exists "Users read own achievement share usage" on public.achievement_share_usage;
create policy "Users read own achievement share usage"
on public.achievement_share_usage for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own achievement share usage" on public.achievement_share_usage;
create policy "Users insert own achievement share usage"
on public.achievement_share_usage for insert
to authenticated
with check ((select auth.uid()) = user_id);

grant select, insert on public.achievement_share_usage to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.trade_journal;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

insert into public.prop_firms
  (slug, name, account_name, account_size, daily_loss_limit, max_loss_limit, evaluation_contracts, live_contracts, trailing_drawdown, rules)
values
  ('topstep-50k', 'Topstep', '50K Combine', 50000, 1000, 2000, 5, 3, false, '{"style":"static drawdown"}'),
  ('apex-50k', 'Apex', '50K Evaluation', 50000, 1250, 2500, 10, 5, true, '{"style":"trailing drawdown"}'),
  ('take-profit-trader-50k', 'Take Profit Trader', '50K Pro', 50000, 1100, 2200, 5, 3, false, '{"style":"static drawdown"}'),
  ('lucid-100k', 'Lucid', '100K Evaluation', 100000, 2000, 3000, 10, 6, true, '{"style":"trailing drawdown"}')
on conflict (slug) do update set
  name = excluded.name,
  account_name = excluded.account_name,
  account_size = excluded.account_size,
  daily_loss_limit = excluded.daily_loss_limit,
  max_loss_limit = excluded.max_loss_limit,
  evaluation_contracts = excluded.evaluation_contracts,
  live_contracts = excluded.live_contracts,
  trailing_drawdown = excluded.trailing_drawdown,
  rules = excluded.rules;
