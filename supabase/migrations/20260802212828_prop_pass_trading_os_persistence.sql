-- Build 117 — Prop Pass Trading OS persistence.
-- Additive only. Client reads are owner-scoped; mutations remain behind the
-- existing service/command boundary. No provider credentials are stored here.

create or replace function public.prop_os_enforce_trading_os_owner()
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
      raise exception 'prop_os: account must belong to user' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prop_os_enforce_trading_os_owner() from public, anon, authenticated;
grant execute on function public.prop_os_enforce_trading_os_owner() to postgres, service_role;

create table if not exists public.prop_daily_plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  trading_day date not null,
  plan_key text not null,
  generated_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, plan_key)
);
create index if not exists prop_daily_plan_snapshots_account_day_idx on public.prop_daily_plan_snapshots (account_id, trading_day desc);

create table if not exists public.prop_pre_trade_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  assessment_key text not null,
  plan_snapshot_id uuid references public.prop_daily_plan_snapshots(id) on delete restrict,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, assessment_key)
);
create index if not exists prop_pre_trade_assessments_account_created_idx on public.prop_pre_trade_assessments (account_id, created_at desc);

create table if not exists public.prop_rule_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.prop_accounts(id) on delete cascade,
  template_key text not null,
  version integer not null default 1 check (version > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, template_key)
);
create index if not exists prop_rule_templates_user_updated_idx on public.prop_rule_templates (user_id, updated_at desc);

create table if not exists public.prop_intervention_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  event_key text not null,
  trade_client_id text,
  rule_id text,
  severity text not null check (severity in ('info', 'warning', 'danger', 'stop')),
  payload jsonb not null,
  override_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists prop_intervention_events_account_created_idx on public.prop_intervention_events (account_id, created_at desc);

create table if not exists public.prop_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  event_key text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  trade_client_id text,
  rule_id text,
  account_snapshot jsonb not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists prop_timeline_events_account_occurred_idx on public.prop_timeline_events (account_id, occurred_at desc);

create table if not exists public.prop_live_risk_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id)
);

create table if not exists public.prop_payout_withdrawal_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id)
);

create table if not exists public.prop_kill_switch_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id)
);

create table if not exists public.prop_position_size_progressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  event_key text not null,
  previous_stage text,
  new_stage text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists prop_position_size_progressions_account_occurred_idx on public.prop_position_size_progressions (account_id, occurred_at desc);

create table if not exists public.prop_recovery_mode_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id)
);

do $$
declare t text;
begin
  foreach t in array array[
    'prop_daily_plan_snapshots', 'prop_pre_trade_assessments', 'prop_rule_templates',
    'prop_intervention_events', 'prop_timeline_events', 'prop_live_risk_settings',
    'prop_payout_withdrawal_settings', 'prop_kill_switch_settings',
    'prop_position_size_progressions', 'prop_recovery_mode_states'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to postgres, service_role', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists prop_os_%I_select_own on public.%I', t, t);
    execute format('create policy prop_os_%I_select_own on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'prop_daily_plan_snapshots', 'prop_pre_trade_assessments', 'prop_rule_templates',
    'prop_intervention_events', 'prop_timeline_events', 'prop_live_risk_settings',
    'prop_payout_withdrawal_settings', 'prop_kill_switch_settings',
    'prop_position_size_progressions', 'prop_recovery_mode_states'
  ] loop
    execute format('drop trigger if exists prop_os_%I_owner_check on public.%I', t, t);
    execute format('create trigger prop_os_%I_owner_check before insert or update on public.%I for each row execute function public.prop_os_enforce_trading_os_owner()', t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'prop_daily_plan_snapshots', 'prop_pre_trade_assessments', 'prop_intervention_events',
    'prop_timeline_events', 'prop_position_size_progressions'
  ] loop
    execute format('drop trigger if exists prop_os_%I_append_only on public.%I', t, t);
    execute format('create trigger prop_os_%I_append_only before update or delete on public.%I for each row execute function public.prop_os_forbid_mutation()', t, t);
  end loop;
end;
$$;
