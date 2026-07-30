-- Phase 1A — Prop OS Additive Database Foundation (prop-os-schema-v0)
-- Contract: docs/architecture/PROP_OS_PHASE_1A_MIGRATION_CONTRACT.md
-- Additive only. Does NOT alter trade_journal / prop_firms / user_firm_settings / risk_snapshots.
-- Does NOT insert trade assignments or backfill legacy trades.
-- Authenticated/anon: no policies (deny-by-default with RLS enabled). Service role for future writers.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_forbid_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'prop_os: table % is immutable (no %)', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

create or replace function public.prop_os_forbid_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'prop_os: table % is append-only (no DELETE)', tg_table_name
    using errcode = '42501';
end;
$$;

create or replace function public.prop_os_enforce_challenge_account_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  account_owner uuid;
begin
  select user_id into account_owner
  from public.prop_accounts
  where id = new.account_id;

  if account_owner is null then
    raise exception 'prop_os: account % not found', new.account_id
      using errcode = '23503';
  end if;

  if new.user_id is distinct from account_owner then
    raise exception 'prop_os: challenge user_id must match account owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.prop_os_enforce_assignment_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
begin
  if new.account_id is not null then
    select user_id into owner from public.prop_accounts where id = new.account_id;
    if owner is null or owner is distinct from new.user_id then
      raise exception 'prop_os: assignment account must belong to user'
        using errcode = '23514';
    end if;
  end if;

  if new.challenge_id is not null then
    select user_id into owner from public.prop_challenges where id = new.challenge_id;
    if owner is null or owner is distinct from new.user_id then
      raise exception 'prop_os: assignment challenge must belong to user'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prop_os_enforce_challenge_no_silent_overwrite()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Historical attempts: block mutating core identity / freeze fields after insert path.
  if old.account_id is distinct from new.account_id
     or old.user_id is distinct from new.user_id
     or old.rule_set_version is distinct from new.rule_set_version
     or old.starting_balance_minor is distinct from new.starting_balance_minor
     or old.started_at is distinct from new.started_at
     or old.reset_of_challenge_id is distinct from new.reset_of_challenge_id
  then
    raise exception 'prop_os: challenge historical fields are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prop_os_forbid_mutation() from public, anon, authenticated;
revoke all on function public.prop_os_forbid_delete() from public, anon, authenticated;
revoke all on function public.prop_os_enforce_challenge_account_owner() from public, anon, authenticated;
revoke all on function public.prop_os_enforce_assignment_owner() from public, anon, authenticated;
revoke all on function public.prop_os_enforce_challenge_no_silent_overwrite() from public, anon, authenticated;

grant execute on function public.prop_os_forbid_mutation() to postgres, service_role;
grant execute on function public.prop_os_forbid_delete() to postgres, service_role;
grant execute on function public.prop_os_enforce_challenge_account_owner() to postgres, service_role;
grant execute on function public.prop_os_enforce_assignment_owner() to postgres, service_role;
grant execute on function public.prop_os_enforce_challenge_no_silent_overwrite() to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.prop_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_key text,
  label text not null,
  account_size_minor bigint not null check (account_size_minor > 0),
  currency text not null default 'USD',
  firm_timezone text not null,
  status text not null check (status in ('active', 'archived', 'closed')),
  source text not null check (source in ('user_created', 'settings_seed', 'import')),
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists prop_accounts_user_status_idx
  on public.prop_accounts (user_id, status);
create index if not exists prop_accounts_user_firm_key_idx
  on public.prop_accounts (user_id, firm_key);

create table if not exists public.prop_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  phase text not null check (phase in ('evaluation', 'funded')),
  status text not null check (status in (
    'active', 'at_risk', 'breached', 'passed', 'funded', 'reset', 'abandoned'
  )),
  rule_set_version text not null,
  starting_balance_minor bigint not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  reset_of_challenge_id uuid references public.prop_challenges(id) on delete restrict,
  breach_locked boolean not null default false,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prop_challenges_account_status_idx
  on public.prop_challenges (account_id, status);
create index if not exists prop_challenges_user_status_idx
  on public.prop_challenges (user_id, status);
create index if not exists prop_challenges_reset_of_idx
  on public.prop_challenges (reset_of_challenge_id);

drop trigger if exists prop_challenges_owner_check on public.prop_challenges;
create trigger prop_challenges_owner_check
  before insert or update on public.prop_challenges
  for each row execute function public.prop_os_enforce_challenge_account_owner();

drop trigger if exists prop_challenges_no_silent_overwrite on public.prop_challenges;
create trigger prop_challenges_no_silent_overwrite
  before update on public.prop_challenges
  for each row execute function public.prop_os_enforce_challenge_no_silent_overwrite();

drop trigger if exists prop_challenges_forbid_delete on public.prop_challenges;
create trigger prop_challenges_forbid_delete
  before delete on public.prop_challenges
  for each row execute function public.prop_os_forbid_delete();

create table if not exists public.prop_challenge_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null unique references public.prop_challenges(id) on delete restrict,
  rule_set_version text not null,
  snapshot jsonb not null,
  template_key text,
  template_version_at_capture text,
  captured_at timestamptz not null,
  schema_version text not null default 'prop-os-schema-v0'
);

drop trigger if exists prop_challenge_rule_snapshots_immutable on public.prop_challenge_rule_snapshots;
create trigger prop_challenge_rule_snapshots_immutable
  before update or delete on public.prop_challenge_rule_snapshots
  for each row execute function public.prop_os_forbid_mutation();

create table if not exists public.prop_trade_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_client_id text not null,
  account_id uuid references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  assignment_state text not null check (
    assignment_state in ('unassigned', 'manual', 'verified_import', 'excluded', 'invalid')
  ),
  assigned_at timestamptz,
  assigned_by text check (
    assigned_by is null
    or assigned_by in ('user', 'system_import', 'admin_correction')
  ),
  provenance jsonb not null default '{}'::jsonb,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trade_client_id),
  constraint prop_trade_assignments_state_shape check (
    (
      assignment_state = 'unassigned'
      and challenge_id is null
    )
    or (
      assignment_state in ('manual', 'verified_import')
      and challenge_id is not null
    )
    or (
      assignment_state in ('excluded', 'invalid')
    )
  )
);

create index if not exists prop_trade_assignments_challenge_idx
  on public.prop_trade_assignments (challenge_id);
create index if not exists prop_trade_assignments_user_state_idx
  on public.prop_trade_assignments (user_id, assignment_state);

drop trigger if exists prop_trade_assignments_owner_check on public.prop_trade_assignments;
create trigger prop_trade_assignments_owner_check
  before insert or update on public.prop_trade_assignments
  for each row execute function public.prop_os_enforce_assignment_owner();

create table if not exists public.prop_executions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  account_id uuid references public.prop_accounts(id) on delete restrict,
  trade_client_id text,
  occurred_at timestamptz not null,
  broker_sequence bigint,
  realized_pnl_minor bigint,
  fees_minor bigint,
  contracts numeric,
  voided boolean not null default false,
  corrects_event_id text,
  source text not null,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists prop_executions_challenge_occurred_idx
  on public.prop_executions (challenge_id, occurred_at);
create index if not exists prop_executions_trade_client_idx
  on public.prop_executions (trade_client_id);

drop trigger if exists prop_executions_forbid_delete on public.prop_executions;
create trigger prop_executions_forbid_delete
  before delete on public.prop_executions
  for each row execute function public.prop_os_forbid_delete();

create table if not exists public.prop_account_events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.prop_challenges(id) on delete restrict,
  kind text not null check (
    kind in ('equity_mark', 'day_boundary', 'challenge_reset', 'official_correction')
  ),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists prop_account_events_challenge_occurred_idx
  on public.prop_account_events (challenge_id, occurred_at);

drop trigger if exists prop_account_events_forbid_mutation on public.prop_account_events;
create trigger prop_account_events_forbid_mutation
  before update or delete on public.prop_account_events
  for each row execute function public.prop_os_forbid_mutation();

create table if not exists public.prop_challenge_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.prop_challenges(id) on delete restrict,
  from_status text,
  to_status text not null,
  reason_code text not null,
  evidence jsonb not null default '{}'::jsonb,
  actor text not null,
  at timestamptz not null,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now()
);

create index if not exists prop_challenge_transitions_challenge_at_idx
  on public.prop_challenge_transitions (challenge_id, at);

drop trigger if exists prop_challenge_transitions_forbid_mutation on public.prop_challenge_transitions;
create trigger prop_challenge_transitions_forbid_mutation
  before update or delete on public.prop_challenge_transitions
  for each row execute function public.prop_os_forbid_mutation();

create table if not exists public.prop_engine_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.prop_challenges(id) on delete restrict,
  calculation_version text not null,
  rule_set_version text not null,
  input_revision text not null,
  calculated_at timestamptz not null,
  status text not null,
  payload jsonb not null,
  confidence jsonb not null,
  limitations jsonb not null default '[]'::jsonb,
  readiness_model_version text,
  confidence_policy_version text not null,
  fixture_contract_version text,
  backfill_version text,
  migration_plan_version text,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  unique (challenge_id, calculated_at, calculation_version, input_revision)
);

create index if not exists prop_engine_snapshots_user_calculated_idx
  on public.prop_engine_snapshots (user_id, calculated_at desc);
create index if not exists prop_engine_snapshots_challenge_calculated_idx
  on public.prop_engine_snapshots (challenge_id, calculated_at desc);

drop trigger if exists prop_engine_snapshots_forbid_mutation on public.prop_engine_snapshots;
create trigger prop_engine_snapshots_forbid_mutation
  before update or delete on public.prop_engine_snapshots
  for each row execute function public.prop_os_forbid_mutation();

create table if not exists public.prop_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.prop_challenges(id) on delete restrict,
  calculation_version text not null,
  rule_set_version text not null,
  input_revision text not null,
  calculated_at timestamptz not null,
  status text not null,
  payload jsonb not null,
  confidence jsonb not null,
  limitations jsonb not null default '[]'::jsonb,
  readiness_model_version text,
  confidence_policy_version text not null,
  fixture_contract_version text,
  backfill_version text,
  migration_plan_version text,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  unique (challenge_id, calculated_at, calculation_version, input_revision)
);

create index if not exists prop_score_snapshots_user_calculated_idx
  on public.prop_score_snapshots (user_id, calculated_at desc);
create index if not exists prop_score_snapshots_challenge_calculated_idx
  on public.prop_score_snapshots (challenge_id, calculated_at desc);

drop trigger if exists prop_score_snapshots_forbid_mutation on public.prop_score_snapshots;
create trigger prop_score_snapshots_forbid_mutation
  before update or delete on public.prop_score_snapshots
  for each row execute function public.prop_os_forbid_mutation();

create table if not exists public.prop_violation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.prop_challenges(id) on delete restrict,
  code text not null,
  at timestamptz not null,
  trade_client_id text,
  severity text not null check (severity in ('warn', 'hard')),
  irreversible boolean not null default true,
  cleared_by_event_id text,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now()
);

create index if not exists prop_violation_records_challenge_at_idx
  on public.prop_violation_records (challenge_id, at);

drop trigger if exists prop_violation_records_forbid_delete on public.prop_violation_records;
create trigger prop_violation_records_forbid_delete
  before delete on public.prop_violation_records
  for each row execute function public.prop_os_forbid_delete();

create table if not exists public.prop_data_quality_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null,
  subject_id text not null,
  flag text not null,
  severity text not null,
  details jsonb not null default '{}'::jsonb,
  backfill_version text,
  detected_at timestamptz not null,
  schema_version text not null default 'prop-os-schema-v0'
);

create index if not exists prop_data_quality_flags_user_subject_idx
  on public.prop_data_quality_flags (user_id, subject_type, subject_id);

create table if not exists public.prop_correction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('void_trade', 'correct_trade', 'clear_breach', 'reassign')
  ),
  payload jsonb not null,
  reason text not null,
  at timestamptz not null,
  actor text not null,
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now()
);

create index if not exists prop_correction_events_user_at_idx
  on public.prop_correction_events (user_id, at desc);

drop trigger if exists prop_correction_events_forbid_mutation on public.prop_correction_events;
create trigger prop_correction_events_forbid_mutation
  before update or delete on public.prop_correction_events
  for each row execute function public.prop_os_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Grants + RLS (deny-by-default for anon/authenticated)
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
    'prop_executions',
    'prop_account_events',
    'prop_challenge_transitions',
    'prop_engine_snapshots',
    'prop_score_snapshots',
    'prop_violation_records',
    'prop_data_quality_flags',
    'prop_correction_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to postgres, service_role', t);
  end loop;
end;
$$;

-- Intentionally NO policies for anon/authenticated in Phase 1A.
-- Tables exist but are inert to the mobile client until a later gate adds scoped policies.
