create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_app_state_updated_idx
on public.user_app_state(updated_at desc);

alter table public.user_app_state enable row level security;

drop policy if exists "Users manage own app state" on public.user_app_state;
create policy "Users manage own app state"
on public.user_app_state for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_app_state to authenticated;
