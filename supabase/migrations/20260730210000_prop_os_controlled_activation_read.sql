-- Phase 1E — Controlled Activation read path (additive only).
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_1E.md
--
-- Option A: production-intended owner-scoped preferences table.
-- Replaces accidental dependency on QA-only prop_os_internal_prefs.
-- Authenticated: SELECT own Prop OS rows; preferences SELECT/INSERT/UPDATE own row.
-- Authenticated: NO writes to engine/score snapshots or service-only tables.
-- Archived accounts remain SELECT-visible to owner (historical read).

-- ---------------------------------------------------------------------------
-- Owner preferences (default account is preference only — not authorization)
-- ---------------------------------------------------------------------------

create table if not exists public.prop_os_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_account_id uuid references public.prop_accounts(id) on delete set null,
  updated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0',
  constraint prop_os_user_preferences_default_owner_chk check (true)
);

comment on table public.prop_os_user_preferences is
  'Prop OS owner preferences. default_account_id is UX preference only — never an ownership boundary.';

create or replace function public.prop_os_enforce_pref_default_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
begin
  if new.default_account_id is null then
    return new;
  end if;
  select user_id into owner from public.prop_accounts where id = new.default_account_id;
  if owner is null or owner is distinct from new.user_id then
    raise exception 'prop_os: default_account_id must belong to preference owner'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.prop_os_enforce_pref_default_owner() from public, anon, authenticated;
grant execute on function public.prop_os_enforce_pref_default_owner() to postgres, service_role;

drop trigger if exists prop_os_user_preferences_default_owner on public.prop_os_user_preferences;
create trigger prop_os_user_preferences_default_owner
  before insert or update on public.prop_os_user_preferences
  for each row execute function public.prop_os_enforce_pref_default_owner();

alter table public.prop_os_user_preferences enable row level security;
alter table public.prop_os_user_preferences force row level security;
revoke all on table public.prop_os_user_preferences from public, anon, authenticated;
grant all on table public.prop_os_user_preferences to postgres, service_role;
grant select, insert, update on table public.prop_os_user_preferences to authenticated;

drop policy if exists prop_os_user_preferences_select_own on public.prop_os_user_preferences;
create policy prop_os_user_preferences_select_own
  on public.prop_os_user_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists prop_os_user_preferences_insert_own on public.prop_os_user_preferences;
create policy prop_os_user_preferences_insert_own
  on public.prop_os_user_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists prop_os_user_preferences_update_own on public.prop_os_user_preferences;
create policy prop_os_user_preferences_update_own
  on public.prop_os_user_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Authenticated owner SELECT on Prop OS read tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'prop_accounts',
    'prop_challenges',
    'prop_challenge_rule_snapshots',
    'prop_trade_assignments',
    'prop_account_events',
    'prop_challenge_transitions',
    'prop_engine_snapshots',
    'prop_score_snapshots',
    'prop_violation_records',
    'prop_data_quality_flags',
    'prop_correction_events',
    'prop_executions'
  ]
  loop
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists prop_os_%I_select_own on public.%I', t, t);
    execute format(
      'create policy prop_os_%I_select_own on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t,
      t
    );
  end loop;
end;
$$;

-- Explicit denials: authenticated must not write snapshots / service-only mutation surfaces.
-- (No INSERT/UPDATE/DELETE policies → deny-by-default under RLS.)

comment on policy prop_os_prop_engine_snapshots_select_own on public.prop_engine_snapshots is
  'Phase 1E: owner read of shadow snapshots. Writes remain service_role only.';
comment on policy prop_os_prop_score_snapshots_select_own on public.prop_score_snapshots is
  'Phase 1E: owner read of score snapshots. Writes remain service_role only.';
