-- Assessment persistence contract for the anonymous-to-authenticated funnel.
-- Source-only in this task: do not deploy without explicit authorization.
create table if not exists public.assessment_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  model_version text not null,
  answers jsonb not null default '{}'::jsonb,
  readiness_result jsonb not null default '{}'::jsonb,
  prop_pass_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.assessment_sessions enable row level security;

revoke all on public.assessment_sessions from anon;
grant select, insert, update on public.assessment_sessions to authenticated;

drop policy if exists assessment_sessions_owner_select on public.assessment_sessions;
create policy assessment_sessions_owner_select
  on public.assessment_sessions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists assessment_sessions_owner_insert on public.assessment_sessions;
create policy assessment_sessions_owner_insert
  on public.assessment_sessions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists assessment_sessions_owner_update on public.assessment_sessions;
create policy assessment_sessions_owner_update
  on public.assessment_sessions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
