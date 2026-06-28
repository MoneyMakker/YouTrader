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
