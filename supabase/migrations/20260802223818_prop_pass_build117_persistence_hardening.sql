-- Build 117 — complete Prop Pass Trading OS persistence contract.
-- Additive only. 20260802212828 is already applied to staging and remains
-- immutable. Client access is SELECT-only; trusted processors own mutations.

create or replace function public.prop_os_enforce_trading_os_owner()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  owner uuid;
  challenge_owner uuid;
  challenge_account uuid;
  challenge_id_value uuid;
  plan_owner uuid;
  plan_account uuid;
  plan_snapshot_id_value uuid;
begin
  if new.account_id is not null then
    select user_id into owner from public.prop_accounts where id = new.account_id;
    if owner is null or owner is distinct from new.user_id then
      raise exception 'prop_os: account must belong to user' using errcode = '23514';
    end if;
  end if;

  challenge_id_value := nullif(to_jsonb(new)->>'challenge_id', '')::uuid;
  if challenge_id_value is not null then
    select user_id, account_id into challenge_owner, challenge_account
      from public.prop_challenges where id = challenge_id_value;
    if challenge_owner is null
       or challenge_owner is distinct from new.user_id
       or challenge_account is distinct from new.account_id then
      raise exception 'prop_os: challenge must belong to user and account' using errcode = '23514';
    end if;
  end if;

  plan_snapshot_id_value := nullif(to_jsonb(new)->>'plan_snapshot_id', '')::uuid;
  if plan_snapshot_id_value is not null then
    select user_id, account_id into plan_owner, plan_account
      from public.prop_daily_plan_snapshots where id = plan_snapshot_id_value;
    if plan_owner is null
       or plan_owner is distinct from new.user_id
       or plan_account is distinct from new.account_id then
      raise exception 'prop_os: plan snapshot must belong to user and account' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prop_os_enforce_trading_os_owner() from public, anon, authenticated;
grant execute on function public.prop_os_enforce_trading_os_owner() to postgres, service_role;

alter table public.prop_daily_plan_snapshots
  add column if not exists calculation_version text not null default 'legacy',
  add column if not exists rule_version text not null default 'legacy',
  add column if not exists instrument_version text,
  add column if not exists payload_digest text not null default '';

alter table public.prop_pre_trade_assessments
  add column if not exists calculation_version text not null default 'legacy',
  add column if not exists rule_version text not null default 'legacy',
  add column if not exists instrument_version text,
  add column if not exists payload_digest text not null default '';

alter table public.prop_intervention_events
  add column if not exists calculation_version text not null default 'legacy',
  add column if not exists rule_version text not null default 'legacy',
  add column if not exists instrument_version text,
  add column if not exists plan_snapshot_id uuid references public.prop_daily_plan_snapshots(id) on delete restrict;

alter table public.prop_timeline_events
  add column if not exists calculation_version text not null default 'legacy',
  add column if not exists rule_version text not null default 'legacy',
  add column if not exists instrument_version text,
  add column if not exists plan_snapshot_id uuid references public.prop_daily_plan_snapshots(id) on delete restrict;

create table if not exists public.prop_instrument_spec_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete cascade,
  symbol text not null,
  specification_version text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  payload jsonb not null,
  source_note text not null,
  payload_digest text not null,
  created_at timestamptz not null default now(),
  check (length(btrim(symbol)) > 0),
  check (length(btrim(specification_version)) > 0),
  check (effective_to is null or effective_to > effective_from),
  unique (user_id, account_id, symbol, specification_version)
);
create index if not exists prop_instrument_spec_versions_owner_effective_idx
  on public.prop_instrument_spec_versions (user_id, account_id, symbol, effective_from desc);

create table if not exists public.prop_intervention_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  intervention_event_id uuid not null references public.prop_intervention_events(id) on delete restrict,
  override_key text not null,
  confirmation_text text not null,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, override_key)
);
create index if not exists prop_intervention_overrides_owner_account_idx
  on public.prop_intervention_overrides (user_id, account_id, confirmed_at desc);

create table if not exists public.prop_decision_replays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  replay_key text not null,
  trade_client_id text not null,
  trade_revision bigint not null check (trade_revision > 0),
  plan_snapshot_id uuid not null references public.prop_daily_plan_snapshots(id) on delete restrict,
  calculation_version text not null,
  rule_version text not null,
  instrument_version text,
  payload jsonb not null,
  payload_digest text not null,
  created_at timestamptz not null default now(),
  unique (user_id, replay_key)
);
create index if not exists prop_decision_replays_owner_trade_idx
  on public.prop_decision_replays (user_id, account_id, trade_client_id, trade_revision desc);

create table if not exists public.prop_processed_journal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  event_key text not null,
  event_type text not null check (event_type in ('trade_saved', 'trade_edited', 'trade_deleted', 'trade_assigned', 'trade_unassigned')),
  journal_trade_id uuid references public.trade_journal(id) on delete restrict,
  trade_client_id text not null,
  trade_revision bigint not null check (trade_revision > 0),
  calculation_version text not null,
  prior_event_key text,
  input_digest text not null,
  processing_state text not null default 'pending' check (processing_state in ('pending', 'applied', 'superseded', 'failed')),
  result_digest text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_key),
  unique (user_id, account_id, trade_client_id, trade_revision, event_type)
);
create index if not exists prop_processed_journal_events_owner_account_idx
  on public.prop_processed_journal_events (user_id, account_id, created_at desc);
create index if not exists prop_processed_journal_events_pending_idx
  on public.prop_processed_journal_events (processing_state, created_at)
  where processing_state in ('pending', 'failed');

create table if not exists public.prop_account_runtime_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete cascade,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  state_revision bigint not null check (state_revision >= 0),
  calculation_version text not null,
  rule_version text not null,
  instrument_version text,
  lifecycle_status text not null,
  last_processed_event_key text,
  payload jsonb not null,
  payload_digest text not null,
  calculated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id)
);
create index if not exists prop_account_runtime_states_owner_status_idx
  on public.prop_account_runtime_states (user_id, lifecycle_status, updated_at desc);

do $$
declare t text;
begin
  foreach t in array array[
    'prop_instrument_spec_versions', 'prop_intervention_overrides',
    'prop_decision_replays', 'prop_processed_journal_events',
    'prop_account_runtime_states'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to postgres, service_role', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists prop_os_%I_select_own on public.%I', t, t);
    execute format(
      'create policy prop_os_%I_select_own on public.%I for select to authenticated using ((select auth.uid()) is not null and user_id = (select auth.uid()))',
      t, t
    );
    execute format('drop trigger if exists prop_os_%I_owner_check on public.%I', t, t);
    execute format(
      'create trigger prop_os_%I_owner_check before insert or update on public.%I for each row execute function public.prop_os_enforce_trading_os_owner()',
      t, t
    );
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'prop_instrument_spec_versions', 'prop_intervention_overrides',
    'prop_decision_replays'
  ] loop
    execute format('drop trigger if exists prop_os_%I_append_only on public.%I', t, t);
    execute format(
      'create trigger prop_os_%I_append_only before update or delete on public.%I for each row execute function public.prop_os_forbid_mutation()',
      t, t
    );
  end loop;
end;
$$;

comment on table public.prop_processed_journal_events is
  'Trusted processed-event ledger. Durable identity is account + trade + revision + event type.';
comment on table public.prop_account_runtime_states is
  'Current rebuildable Prop Pass projection; immutable plans and replays remain separate evidence.';

create or replace function public.prop_os_processor_claim_journal_event(
  p_user_id uuid,
  p_account_id uuid,
  p_challenge_id uuid,
  p_event_key text,
  p_event_type text,
  p_journal_trade_id uuid,
  p_trade_client_id text,
  p_trade_revision bigint,
  p_calculation_version text,
  p_prior_event_key text,
  p_input_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare existing public.prop_processed_journal_events%rowtype;
begin
  insert into public.prop_processed_journal_events (
    user_id, account_id, challenge_id, event_key, event_type,
    journal_trade_id, trade_client_id, trade_revision, calculation_version,
    prior_event_key, input_digest
  ) values (
    p_user_id, p_account_id, p_challenge_id, p_event_key, p_event_type,
    p_journal_trade_id, p_trade_client_id, p_trade_revision, p_calculation_version,
    p_prior_event_key, p_input_digest
  )
  on conflict (user_id, event_key) do nothing;

  select * into existing from public.prop_processed_journal_events
    where user_id = p_user_id and event_key = p_event_key for update;
  if not found then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if existing.input_digest is distinct from p_input_digest
     or existing.account_id is distinct from p_account_id
     or existing.trade_revision is distinct from p_trade_revision
     or existing.event_type is distinct from p_event_type then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'journal_event_identity_mismatch');
  end if;
  return jsonb_build_object(
    'kind', case when existing.processing_state = 'applied' then 'already_applied' else 'claimed' end,
    'eventId', existing.id,
    'processingState', existing.processing_state,
    'resultDigest', existing.result_digest
  );
end;
$$;

create or replace function public.prop_os_processor_complete_journal_event(
  p_user_id uuid,
  p_event_key text,
  p_result_digest text,
  p_state_revision bigint,
  p_calculation_version text,
  p_rule_version text,
  p_instrument_version text,
  p_lifecycle_status text,
  p_state_payload jsonb,
  p_state_digest text,
  p_calculated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare event_row public.prop_processed_journal_events%rowtype;
declare runtime_row public.prop_account_runtime_states%rowtype;
begin
  select * into event_row from public.prop_processed_journal_events
    where user_id = p_user_id and event_key = p_event_key for update;
  if not found then
    return jsonb_build_object('kind', 'not_found');
  end if;
  if event_row.processing_state = 'applied' then
    if event_row.result_digest is distinct from p_result_digest then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'journal_event_result_mismatch');
    end if;
    return jsonb_build_object('kind', 'already_applied', 'stateRevision', p_state_revision);
  end if;

  select * into runtime_row from public.prop_account_runtime_states
    where user_id = p_user_id and account_id = event_row.account_id for update;
  if found and runtime_row.state_revision > p_state_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_state_revision');
  end if;
  if found and runtime_row.state_revision = p_state_revision
     and runtime_row.payload_digest is distinct from p_state_digest then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'state_revision_digest_mismatch');
  end if;

  insert into public.prop_account_runtime_states (
    user_id, account_id, challenge_id, state_revision, calculation_version,
    rule_version, instrument_version, lifecycle_status, last_processed_event_key,
    payload, payload_digest, calculated_at, updated_at
  ) values (
    p_user_id, event_row.account_id, event_row.challenge_id, p_state_revision,
    p_calculation_version, p_rule_version, p_instrument_version,
    p_lifecycle_status, p_event_key, p_state_payload, p_state_digest,
    p_calculated_at, now()
  )
  on conflict (user_id, account_id) do update set
    challenge_id = excluded.challenge_id,
    state_revision = excluded.state_revision,
    calculation_version = excluded.calculation_version,
    rule_version = excluded.rule_version,
    instrument_version = excluded.instrument_version,
    lifecycle_status = excluded.lifecycle_status,
    last_processed_event_key = excluded.last_processed_event_key,
    payload = excluded.payload,
    payload_digest = excluded.payload_digest,
    calculated_at = excluded.calculated_at,
    updated_at = excluded.updated_at;

  update public.prop_processed_journal_events set
    processing_state = 'applied', result_digest = p_result_digest,
    applied_at = coalesce(applied_at, now()), updated_at = now()
    where id = event_row.id;
  return jsonb_build_object('kind', 'applied', 'stateRevision', p_state_revision);
end;
$$;

create or replace function public.prop_os_processor_fail_journal_event(
  p_user_id uuid,
  p_event_key text,
  p_result_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  update public.prop_processed_journal_events set
    processing_state = 'failed', result_digest = p_result_digest, updated_at = now()
    where user_id = p_user_id and event_key = p_event_key and processing_state <> 'applied';
  if not found then return jsonb_build_object('kind', 'not_found_or_applied'); end if;
  return jsonb_build_object('kind', 'failed');
end;
$$;

revoke all on function public.prop_os_processor_claim_journal_event(uuid, uuid, uuid, text, text, uuid, text, bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.prop_os_processor_complete_journal_event(uuid, text, text, bigint, text, text, text, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.prop_os_processor_fail_journal_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.prop_os_processor_claim_journal_event(uuid, uuid, uuid, text, text, uuid, text, bigint, text, text, text) to postgres, service_role;
grant execute on function public.prop_os_processor_complete_journal_event(uuid, text, text, bigint, text, text, text, text, jsonb, text, timestamptz) to postgres, service_role;
grant execute on function public.prop_os_processor_fail_journal_event(uuid, text, text) to postgres, service_role;
