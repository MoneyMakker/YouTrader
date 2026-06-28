-- Additive runtime schema used by the current mobile app.
-- Existing risk-coach-schema.sql already creates prop_firms and trade_journal;
-- this migration fills the missing app tables and keeps policies user-scoped.

alter table public.trade_journal
  add column if not exists entry_time text,
  add column if not exists exit_time text;

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
