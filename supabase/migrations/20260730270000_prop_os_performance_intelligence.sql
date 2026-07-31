-- Phase 3A — Performance Intelligence foundation (prepare only).
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_3A.md
--
-- Immutable snapshots + calc queue + current projection.
-- App authenticated: SELECT own only.
-- Complete/fail: postgres / service_role / prop_os_recalc_processor only.

-- ---------------------------------------------------------------------------
-- Immutable intelligence snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.prop_performance_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  scope_kind text not null check (
    scope_kind in ('challenge', 'account', 'recent_trades', 'date_range')
  ),
  scope_key text not null,
  scope_json jsonb not null,
  assignment_revision bigint not null,
  input_revision text not null,
  metric_spec_version text not null,
  engine_version text not null,
  status text not null check (
    status in (
      'current',
      'outdated',
      'insufficient_data',
      'incomplete_data',
      'unsupported',
      'integrity_error'
    )
  ),
  dataset_summary jsonb not null,
  performance jsonb not null,
  risk jsonb not null,
  sequences jsonb not null,
  segments jsonb not null,
  findings jsonb not null,
  identity_hash text not null,
  source_trade_count integer not null check (source_trade_count >= 0),
  earliest_trade_at timestamptz,
  latest_trade_at timestamptz,
  calculated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0',
  created_at timestamptz not null default now(),
  constraint prop_pi_snapshots_scope_challenge check (
    (scope_kind = 'challenge' and challenge_id is not null)
    or (scope_kind <> 'challenge')
  )
);

create index if not exists prop_pi_snapshots_user_scope_idx
  on public.prop_performance_intelligence_snapshots (
    user_id, scope_key, assignment_revision desc, calculated_at desc
  );

create index if not exists prop_pi_snapshots_account_idx
  on public.prop_performance_intelligence_snapshots (account_id, calculated_at desc);

alter table public.prop_performance_intelligence_snapshots enable row level security;
alter table public.prop_performance_intelligence_snapshots force row level security;

revoke all on table public.prop_performance_intelligence_snapshots
  from public, anon, authenticated;
grant all on table public.prop_performance_intelligence_snapshots
  to postgres, service_role, prop_os_recalc_processor;
grant select on table public.prop_performance_intelligence_snapshots to authenticated;

drop policy if exists prop_pi_snapshots_select_own
  on public.prop_performance_intelligence_snapshots;
create policy prop_pi_snapshots_select_own
  on public.prop_performance_intelligence_snapshots
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists prop_pi_snapshots_forbid_mutation
  on public.prop_performance_intelligence_snapshots;
create trigger prop_pi_snapshots_forbid_mutation
  before update or delete on public.prop_performance_intelligence_snapshots
  for each row execute function public.prop_os_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Current compatible snapshot projection (recoverable from immutables)
-- ---------------------------------------------------------------------------

create table if not exists public.prop_performance_intelligence_current (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_key text not null,
  snapshot_id uuid not null
    references public.prop_performance_intelligence_snapshots(id) on delete restrict,
  assignment_revision bigint not null,
  input_revision text not null,
  metric_spec_version text not null,
  engine_version text not null,
  status text not null,
  updated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0',
  primary key (user_id, scope_key)
);

alter table public.prop_performance_intelligence_current enable row level security;
alter table public.prop_performance_intelligence_current force row level security;

revoke all on table public.prop_performance_intelligence_current
  from public, anon, authenticated;
grant all on table public.prop_performance_intelligence_current
  to postgres, service_role, prop_os_recalc_processor;
grant select on table public.prop_performance_intelligence_current to authenticated;

drop policy if exists prop_pi_current_select_own
  on public.prop_performance_intelligence_current;
create policy prop_pi_current_select_own
  on public.prop_performance_intelligence_current
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Calculation queue / state
-- ---------------------------------------------------------------------------

create table if not exists public.prop_performance_intelligence_calc (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_key text not null,
  scope_json jsonb not null,
  account_id uuid not null references public.prop_accounts(id) on delete restrict,
  assignment_revision bigint not null,
  state text not null check (
    state in ('queued', 'running', 'completed', 'failed')
  ),
  snapshot_id uuid
    references public.prop_performance_intelligence_snapshots(id) on delete set null,
  reason_code text,
  client_request_id text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0',
  primary key (user_id, scope_key)
);

create index if not exists prop_pi_calc_state_idx
  on public.prop_performance_intelligence_calc (state, updated_at);

alter table public.prop_performance_intelligence_calc enable row level security;
alter table public.prop_performance_intelligence_calc force row level security;

revoke all on table public.prop_performance_intelligence_calc
  from public, anon, authenticated;
grant all on table public.prop_performance_intelligence_calc
  to postgres, service_role, prop_os_recalc_processor;
grant select on table public.prop_performance_intelligence_calc to authenticated;

drop policy if exists prop_pi_calc_select_own
  on public.prop_performance_intelligence_calc;
create policy prop_pi_calc_select_own
  on public.prop_performance_intelligence_calc
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Optional finding index for internal reads (immutable rows)
-- ---------------------------------------------------------------------------

create table if not exists public.prop_performance_intelligence_findings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.prop_performance_intelligence_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  finding_id text not null,
  finding_spec_version text not null,
  category text not null,
  polarity text not null,
  metric_key text not null,
  sample_size integer not null,
  reason_code text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, finding_id)
);

create index if not exists prop_pi_findings_user_idx
  on public.prop_performance_intelligence_findings (user_id, created_at desc);

alter table public.prop_performance_intelligence_findings enable row level security;
alter table public.prop_performance_intelligence_findings force row level security;

revoke all on table public.prop_performance_intelligence_findings
  from public, anon, authenticated;
grant all on table public.prop_performance_intelligence_findings
  to postgres, service_role, prop_os_recalc_processor;
grant select on table public.prop_performance_intelligence_findings to authenticated;

drop policy if exists prop_pi_findings_select_own
  on public.prop_performance_intelligence_findings;
create policy prop_pi_findings_select_own
  on public.prop_performance_intelligence_findings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists prop_pi_findings_forbid_mutation
  on public.prop_performance_intelligence_findings;
create trigger prop_pi_findings_forbid_mutation
  before update or delete on public.prop_performance_intelligence_findings
  for each row execute function public.prop_os_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Mark outdated on assignment revision bump (hook helper)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_pi_mark_outdated_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  update public.prop_performance_intelligence_current as c
  set status = 'outdated',
      updated_at = now()
  where c.user_id = p_user_id
    and c.status = 'current';

  update public.prop_performance_intelligence_calc as q
  set state = 'queued',
      reason_code = 'assignment_revision_changed',
      updated_at = now()
  where q.user_id = p_user_id
    and q.state in ('completed', 'failed');
end;
$$;

revoke all on function public.prop_os_pi_mark_outdated_for_user(uuid)
  from public, anon, authenticated;
grant execute on function public.prop_os_pi_mark_outdated_for_user(uuid)
  to postgres, service_role, prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- App request calculation (owner-scoped, allowlisted; does NOT write snapshot)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_request_performance_intelligence(
  p_client_request_id text,
  p_payload_hash text,
  p_account_id uuid,
  p_scope_json jsonb,
  p_scope_key text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  v_uid uuid;
  v_rev bigint;
  v_acc public.prop_accounts%rowtype;
  v_existing public.prop_performance_intelligence_calc%rowtype;
begin
  -- Enforces auth + kill switch (commands_enabled) + allowlist.
  begin
    v_uid := public.prop_os_cmd_assert_authorized();
  exception
    when insufficient_privilege then
      return jsonb_build_object('kind', 'forbidden', 'reasonCode', 'kill_switch_or_allowlist');
    when others then
      if sqlstate = '42501' then
        return jsonb_build_object('kind', 'forbidden', 'reasonCode', 'kill_switch_or_allowlist');
      end if;
      raise;
  end;

  select * into v_acc
  from public.prop_accounts a
  where a.id = p_account_id and a.user_id = v_uid;
  if not found then
    return jsonb_build_object('kind', 'forbidden', 'reasonCode', 'account_not_owned');
  end if;
  if coalesce(v_acc.status, '') = 'archived' then
    return jsonb_build_object('kind', 'failed', 'reasonCode', 'account_archived');
  end if;

  select coalesce(r.revision, 0) into v_rev
  from public.prop_os_assignment_revisions r
  where r.user_id = v_uid;
  v_rev := coalesce(v_rev, 0);

  select * into v_existing
  from public.prop_performance_intelligence_calc c
  where c.user_id = v_uid and c.scope_key = p_scope_key;

  if found then
    if v_existing.state = 'running' and v_existing.assignment_revision = v_rev then
      return jsonb_build_object(
        'kind', 'running',
        'scopeKey', p_scope_key,
        'assignmentRevision', v_rev
      );
    end if;
    if v_existing.state = 'completed'
       and v_existing.assignment_revision = v_rev
       and v_existing.snapshot_id is not null then
      return jsonb_build_object(
        'kind', 'completed',
        'scopeKey', p_scope_key,
        'assignmentRevision', v_rev,
        'snapshotId', v_existing.snapshot_id
      );
    end if;
    if v_existing.assignment_revision > v_rev then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_request');
    end if;
  end if;

  insert into public.prop_performance_intelligence_calc as c (
    user_id, scope_key, scope_json, account_id, assignment_revision,
    state, client_request_id, requested_at, updated_at
  ) values (
    v_uid, p_scope_key, p_scope_json, p_account_id, v_rev,
    'queued', p_client_request_id, now(), now()
  )
  on conflict (user_id, scope_key) do update
    set scope_json = excluded.scope_json,
        account_id = excluded.account_id,
        assignment_revision = excluded.assignment_revision,
        state = 'queued',
        client_request_id = excluded.client_request_id,
        reason_code = null,
        updated_at = now();

  return jsonb_build_object(
    'kind', 'queued',
    'scopeKey', p_scope_key,
    'assignmentRevision', v_rev
  );
end;
$$;

revoke all on function public.prop_os_cmd_request_performance_intelligence(
  text, text, uuid, jsonb, text
) from public, anon;
grant execute on function public.prop_os_cmd_request_performance_intelligence(
  text, text, uuid, jsonb, text
) to authenticated, service_role, postgres;

-- ---------------------------------------------------------------------------
-- Trusted processor: complete calculation (writes immutable snapshot)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_complete_performance_intelligence(
  p_user_id uuid,
  p_scope_key text,
  p_assignment_revision bigint,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  v_rev bigint;
  v_id uuid;
  v_input_rev text;
  v_status text;
  v_account uuid;
  v_existing uuid;
begin
  perform public.prop_os_assert_recalc_processor();

  select coalesce(r.revision, 0) into v_rev
  from public.prop_os_assignment_revisions r
  where r.user_id = p_user_id;
  v_rev := coalesce(v_rev, 0);

  if p_assignment_revision <> v_rev then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_assignment_revision');
  end if;

  v_input_rev := p_snapshot->>'inputRevision';
  v_status := coalesce(p_snapshot->>'status', 'current');
  v_account := (p_snapshot->>'accountId')::uuid;

  -- Idempotent: same input revision already current
  select c.snapshot_id into v_existing
  from public.prop_performance_intelligence_current c
  where c.user_id = p_user_id
    and c.scope_key = p_scope_key
    and c.input_revision = v_input_rev
    and c.assignment_revision = p_assignment_revision;
  if v_existing is not null then
    update public.prop_performance_intelligence_calc
    set state = 'completed',
        snapshot_id = v_existing,
        updated_at = now()
    where user_id = p_user_id and scope_key = p_scope_key;
    return jsonb_build_object(
      'kind', 'success',
      'snapshotId', v_existing,
      'idempotent', true
    );
  end if;

  insert into public.prop_performance_intelligence_snapshots (
    user_id, account_id, challenge_id, scope_kind, scope_key, scope_json,
    assignment_revision, input_revision, metric_spec_version, engine_version,
    status, dataset_summary, performance, risk, sequences, segments, findings,
    identity_hash, source_trade_count, earliest_trade_at, latest_trade_at,
    calculated_at, schema_version
  ) values (
    p_user_id,
    v_account,
    nullif(p_snapshot->>'challengeId', '')::uuid,
    coalesce(p_snapshot->'scope'->>'kind', 'account'),
    p_scope_key,
    coalesce(p_snapshot->'scope', '{}'::jsonb),
    p_assignment_revision,
    v_input_rev,
    coalesce(p_snapshot->>'metricSpecVersion', 'pi-metric-spec-v0'),
    coalesce(p_snapshot->>'engineVersion', 'pi-engine-v0'),
    v_status,
    coalesce(p_snapshot->'datasetSummary', '{}'::jsonb),
    coalesce(p_snapshot->'performance', '{}'::jsonb),
    coalesce(p_snapshot->'risk', '{}'::jsonb),
    coalesce(p_snapshot->'sequences', '{}'::jsonb),
    coalesce(p_snapshot->'segments', '[]'::jsonb),
    coalesce(p_snapshot->'findings', '[]'::jsonb),
    coalesce(p_snapshot->'datasetSummary'->>'identityHash', 'unknown'),
    coalesce((p_snapshot->'datasetSummary'->>'tradeCount')::integer, 0),
    nullif(p_snapshot->'sourceRange'->>'earliestTradeAt', '')::timestamptz,
    nullif(p_snapshot->'sourceRange'->>'latestTradeAt', '')::timestamptz,
    coalesce((p_snapshot->>'calculatedAt')::timestamptz, now()),
    coalesce(p_snapshot->>'schemaVersion', 'prop-os-schema-v0')
  )
  returning id into v_id;

  insert into public.prop_performance_intelligence_findings (
    snapshot_id, user_id, finding_id, finding_spec_version, category, polarity,
    metric_key, sample_size, reason_code, evidence
  )
  select
    v_id,
    p_user_id,
    f->>'id',
    coalesce(f->>'findingSpecVersion', 'pi-finding-spec-v0'),
    coalesce(f->>'category', 'performance'),
    coalesce(f->>'polarity', 'neutral'),
    coalesce(f->>'metricKey', 'unknown'),
    coalesce((f->>'sampleSize')::integer, 0),
    coalesce(f->>'reasonCode', 'unknown'),
    coalesce(f->'evidence', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_snapshot->'findings', '[]'::jsonb)) as f
  where f->>'id' is not null
  on conflict (snapshot_id, finding_id) do nothing;

  insert into public.prop_performance_intelligence_current as cur (
    user_id, scope_key, snapshot_id, assignment_revision, input_revision,
    metric_spec_version, engine_version, status, updated_at
  ) values (
    p_user_id, p_scope_key, v_id, p_assignment_revision, v_input_rev,
    coalesce(p_snapshot->>'metricSpecVersion', 'pi-metric-spec-v0'),
    coalesce(p_snapshot->>'engineVersion', 'pi-engine-v0'),
    v_status, now()
  )
  on conflict (user_id, scope_key) do update
    set snapshot_id = excluded.snapshot_id,
        assignment_revision = excluded.assignment_revision,
        input_revision = excluded.input_revision,
        metric_spec_version = excluded.metric_spec_version,
        engine_version = excluded.engine_version,
        status = excluded.status,
        updated_at = now();

  update public.prop_performance_intelligence_calc
  set state = 'completed',
      snapshot_id = v_id,
      reason_code = null,
      updated_at = now()
  where user_id = p_user_id and scope_key = p_scope_key;

  return jsonb_build_object('kind', 'success', 'snapshotId', v_id);
end;
$$;

revoke all on function public.prop_os_cmd_complete_performance_intelligence(
  uuid, text, bigint, jsonb
) from public, anon, authenticated;
grant execute on function public.prop_os_cmd_complete_performance_intelligence(
  uuid, text, bigint, jsonb
) to postgres, service_role, prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- Trusted processor: fail calculation (no snapshot promotion)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_fail_performance_intelligence(
  p_user_id uuid,
  p_scope_key text,
  p_assignment_revision bigint,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  v_rev bigint;
begin
  perform public.prop_os_assert_recalc_processor();

  select coalesce(r.revision, 0) into v_rev
  from public.prop_os_assignment_revisions r
  where r.user_id = p_user_id;
  v_rev := coalesce(v_rev, 0);

  if p_assignment_revision <> v_rev then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_assignment_revision');
  end if;

  update public.prop_performance_intelligence_calc
  set state = 'failed',
      reason_code = left(coalesce(p_reason_code, 'failed'), 120),
      updated_at = now()
  where user_id = p_user_id and scope_key = p_scope_key;

  return jsonb_build_object('kind', 'success');
end;
$$;

revoke all on function public.prop_os_cmd_fail_performance_intelligence(
  uuid, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.prop_os_cmd_fail_performance_intelligence(
  uuid, text, bigint, text
) to postgres, service_role, prop_os_recalc_processor;
