-- Phase 3A remediation — PI processor isolation, atomic publication, uniqueness.
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_3A.md

-- ---------------------------------------------------------------------------
-- Dedicated Performance Intelligence processor role
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'prop_os_performance_intelligence_processor'
  ) then
    create role prop_os_performance_intelligence_processor nologin;
  end if;
end
$$;

grant usage on schema public to prop_os_performance_intelligence_processor;
grant prop_os_performance_intelligence_processor to postgres;
grant prop_os_performance_intelligence_processor to service_role;

create or replace function public.prop_os_assert_pi_processor()
returns void
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
declare
  jwt_role text := coalesce(nullif(btrim(current_setting('request.jwt.claim.role', true)), ''), '');
  active_role text := coalesce(nullif(btrim(current_setting('role', true)), ''), current_user);
begin
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'permission denied for performance intelligence processor'
      using errcode = '42501';
  end if;
  if active_role in ('authenticated', 'anon', 'public') then
    raise exception 'permission denied for performance intelligence processor'
      using errcode = '42501';
  end if;
  -- Explicit deny: assignment/challenge recalculation processor is NOT PI processor.
  if active_role = 'prop_os_recalc_processor'
     and not pg_catalog.pg_has_role(session_user, 'prop_os_performance_intelligence_processor', 'member')
     and session_user not in ('postgres', 'service_role') then
    raise exception 'permission denied for performance intelligence processor'
      using errcode = '42501';
  end if;
  if active_role in (
    'postgres',
    'service_role',
    'prop_os_performance_intelligence_processor'
  ) then
    return;
  end if;
  if session_user in ('postgres', 'service_role') then
    return;
  end if;
  if pg_catalog.pg_has_role(
    session_user,
    'prop_os_performance_intelligence_processor',
    'member'
  ) then
    return;
  end if;
  raise exception 'permission denied for performance intelligence processor'
    using errcode = '42501';
end;
$$;

revoke all on function public.prop_os_assert_pi_processor() from public, anon, authenticated;
grant execute on function public.prop_os_assert_pi_processor()
  to postgres, service_role, prop_os_performance_intelligence_processor;

-- ---------------------------------------------------------------------------
-- Revoke PI table/function privileges from assignment recalc processor
-- ---------------------------------------------------------------------------

revoke all on table public.prop_performance_intelligence_snapshots
  from prop_os_recalc_processor;
revoke all on table public.prop_performance_intelligence_current
  from prop_os_recalc_processor;
revoke all on table public.prop_performance_intelligence_calc
  from prop_os_recalc_processor;
revoke all on table public.prop_performance_intelligence_findings
  from prop_os_recalc_processor;

grant select, insert on table public.prop_performance_intelligence_snapshots
  to prop_os_performance_intelligence_processor;
grant select, insert, update on table public.prop_performance_intelligence_current
  to prop_os_performance_intelligence_processor;
grant select, insert, update on table public.prop_performance_intelligence_calc
  to prop_os_performance_intelligence_processor;
grant select, insert on table public.prop_performance_intelligence_findings
  to prop_os_performance_intelligence_processor;

grant all on table public.prop_performance_intelligence_snapshots
  to postgres, service_role;
grant all on table public.prop_performance_intelligence_current
  to postgres, service_role;
grant all on table public.prop_performance_intelligence_calc
  to postgres, service_role;
grant all on table public.prop_performance_intelligence_findings
  to postgres, service_role;

revoke execute on function public.prop_os_pi_mark_outdated_for_user(uuid)
  from prop_os_recalc_processor;
grant execute on function public.prop_os_pi_mark_outdated_for_user(uuid)
  to postgres, service_role, prop_os_performance_intelligence_processor;

revoke execute on function public.prop_os_cmd_complete_performance_intelligence(uuid, text, bigint, jsonb)
  from prop_os_recalc_processor;
revoke execute on function public.prop_os_cmd_fail_performance_intelligence(uuid, text, bigint, text)
  from prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- Logical snapshot identity uniqueness (DB-level)
-- ---------------------------------------------------------------------------

create unique index if not exists prop_pi_snapshots_logical_identity_uidx
  on public.prop_performance_intelligence_snapshots (
    user_id,
    scope_key,
    assignment_revision,
    input_revision,
    metric_spec_version,
    engine_version
  );

alter table public.prop_performance_intelligence_current
  drop constraint if exists prop_pi_current_status_check;
alter table public.prop_performance_intelligence_current
  add constraint prop_pi_current_status_check check (
    status in (
      'current',
      'outdated',
      'insufficient_data',
      'incomplete_data',
      'unsupported',
      'integrity_error'
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic publication with failure injection stages
-- Stages: queue_claim → snapshot_insert → finding_insert
--         → current_projection → queue_completion → receipt_completion
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
  v_metric text;
  v_engine text;
  v_client_req text;
  v_payload_hash text;
begin
  perform public.prop_os_assert_pi_processor();

  select coalesce(r.revision, 0) into v_rev
  from public.prop_os_assignment_revisions r
  where r.user_id = p_user_id;
  v_rev := coalesce(v_rev, 0);

  if p_assignment_revision <> v_rev then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_assignment_revision');
  end if;

  v_input_rev := p_snapshot->>'inputRevision';
  if v_input_rev is null or btrim(v_input_rev) = '' then
    return jsonb_build_object('kind', 'failed', 'reasonCode', 'missing_input_revision');
  end if;

  v_status := coalesce(p_snapshot->>'status', 'current');
  v_account := (p_snapshot->>'accountId')::uuid;
  v_metric := coalesce(p_snapshot->>'metricSpecVersion', 'pi-metric-spec-v0');
  v_engine := coalesce(p_snapshot->>'engineVersion', 'pi-engine-v0');
  v_client_req := coalesce(
    nullif(btrim(p_snapshot->>'clientRequestId'), ''),
    'pi-pub-' || left(encode(sha256((p_user_id::text || p_scope_key || v_input_rev)::bytea), 'hex'), 24)
  );
  v_payload_hash := coalesce(
    nullif(btrim(p_snapshot->>'payloadHash'), ''),
    left(encode(sha256((v_input_rev || v_metric || v_engine)::bytea), 'hex'), 32)
  );

  select c.snapshot_id into v_existing
  from public.prop_performance_intelligence_current c
  where c.user_id = p_user_id
    and c.scope_key = p_scope_key
    and c.input_revision = v_input_rev
    and c.assignment_revision = p_assignment_revision
    and c.metric_spec_version = v_metric
    and c.engine_version = v_engine;
  if v_existing is not null then
    update public.prop_performance_intelligence_calc
    set state = 'completed',
        snapshot_id = v_existing,
        reason_code = null,
        updated_at = now()
    where user_id = p_user_id and scope_key = p_scope_key;
    insert into public.prop_os_command_receipts as r (
      user_id, client_request_id, command_type, request_hash,
      result_status, result_body, reason_code, entity_ids
    ) values (
      p_user_id, v_client_req, 'complete_performance_intelligence', v_payload_hash,
      'success',
      jsonb_build_object('kind', 'success', 'snapshotId', v_existing, 'idempotent', true),
      null,
      jsonb_build_object('snapshotId', v_existing, 'scopeKey', p_scope_key)
    )
    on conflict (user_id, client_request_id) do nothing;
    return jsonb_build_object(
      'kind', 'success',
      'snapshotId', v_existing,
      'idempotent', true
    );
  end if;

  select s.id into v_existing
  from public.prop_performance_intelligence_snapshots s
  where s.user_id = p_user_id
    and s.scope_key = p_scope_key
    and s.assignment_revision = p_assignment_revision
    and s.input_revision = v_input_rev
    and s.metric_spec_version = v_metric
    and s.engine_version = v_engine
  limit 1;
  if v_existing is not null then
    insert into public.prop_performance_intelligence_current as cur (
      user_id, scope_key, snapshot_id, assignment_revision, input_revision,
      metric_spec_version, engine_version, status, updated_at
    ) values (
      p_user_id, p_scope_key, v_existing, p_assignment_revision, v_input_rev,
      v_metric, v_engine, v_status, now()
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
    set state = 'completed', snapshot_id = v_existing, reason_code = null, updated_at = now()
    where user_id = p_user_id and scope_key = p_scope_key;
    return jsonb_build_object(
      'kind', 'success',
      'snapshotId', v_existing,
      'idempotent', true
    );
  end if;

  -- 1) queue claim
  update public.prop_performance_intelligence_calc
  set state = 'running',
      assignment_revision = p_assignment_revision,
      updated_at = now()
  where user_id = p_user_id and scope_key = p_scope_key;
  perform public.prop_os_debug_maybe_fail('pi_queue_claim');

  -- 2) immutable snapshot insert
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
    v_metric,
    v_engine,
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
  perform public.prop_os_debug_maybe_fail('pi_snapshot_insert');

  -- 3) findings
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
  perform public.prop_os_debug_maybe_fail('pi_finding_insert');

  -- 4) current projection
  insert into public.prop_performance_intelligence_current as cur (
    user_id, scope_key, snapshot_id, assignment_revision, input_revision,
    metric_spec_version, engine_version, status, updated_at
  ) values (
    p_user_id, p_scope_key, v_id, p_assignment_revision, v_input_rev,
    v_metric, v_engine, v_status, now()
  )
  on conflict (user_id, scope_key) do update
    set snapshot_id = excluded.snapshot_id,
        assignment_revision = excluded.assignment_revision,
        input_revision = excluded.input_revision,
        metric_spec_version = excluded.metric_spec_version,
        engine_version = excluded.engine_version,
        status = excluded.status,
        updated_at = now();
  perform public.prop_os_debug_maybe_fail('pi_current_projection');

  -- 5) queue completion
  update public.prop_performance_intelligence_calc
  set state = 'completed',
      snapshot_id = v_id,
      reason_code = null,
      updated_at = now()
  where user_id = p_user_id and scope_key = p_scope_key;
  perform public.prop_os_debug_maybe_fail('pi_queue_completion');

  -- 6) receipt
  insert into public.prop_os_command_receipts as r (
    user_id, client_request_id, command_type, request_hash,
    result_status, result_body, reason_code, entity_ids
  ) values (
    p_user_id, v_client_req, 'complete_performance_intelligence', v_payload_hash,
    'success',
    jsonb_build_object('kind', 'success', 'snapshotId', v_id),
    null,
    jsonb_build_object('snapshotId', v_id, 'scopeKey', p_scope_key)
  )
  on conflict (user_id, client_request_id) do update
    set result_status = excluded.result_status,
        result_body = excluded.result_body,
        entity_ids = excluded.entity_ids;
  perform public.prop_os_debug_maybe_fail('pi_receipt_completion');

  return jsonb_build_object('kind', 'success', 'snapshotId', v_id);
end;
$$;

revoke all on function public.prop_os_cmd_complete_performance_intelligence(
  uuid, text, bigint, jsonb
) from public, anon, authenticated, prop_os_recalc_processor;
grant execute on function public.prop_os_cmd_complete_performance_intelligence(
  uuid, text, bigint, jsonb
) to postgres, service_role, prop_os_performance_intelligence_processor;

grant execute on function public.prop_os_debug_maybe_fail(text)
  to prop_os_performance_intelligence_processor;

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
  perform public.prop_os_assert_pi_processor();

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
) from public, anon, authenticated, prop_os_recalc_processor;
grant execute on function public.prop_os_cmd_fail_performance_intelligence(
  uuid, text, bigint, text
) to postgres, service_role, prop_os_performance_intelligence_processor;

-- ---------------------------------------------------------------------------
-- Projection rebuild parity
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_pi_rebuild_current_projection(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  rebuilt int := 0;
  r record;
begin
  perform public.prop_os_assert_pi_processor();

  for r in
    select distinct on (s.scope_key)
      s.scope_key,
      s.id as snapshot_id,
      s.assignment_revision,
      s.input_revision,
      s.metric_spec_version,
      s.engine_version,
      s.status
    from public.prop_performance_intelligence_snapshots s
    where s.user_id = p_user_id
      and s.status in (
        'current', 'insufficient_data', 'incomplete_data', 'unsupported', 'outdated'
      )
    order by s.scope_key, s.assignment_revision desc, s.calculated_at desc, s.id desc
  loop
    insert into public.prop_performance_intelligence_current as cur (
      user_id, scope_key, snapshot_id, assignment_revision, input_revision,
      metric_spec_version, engine_version, status, updated_at
    ) values (
      p_user_id, r.scope_key, r.snapshot_id, r.assignment_revision, r.input_revision,
      r.metric_spec_version, r.engine_version, r.status, now()
    )
    on conflict (user_id, scope_key) do update
      set snapshot_id = excluded.snapshot_id,
          assignment_revision = excluded.assignment_revision,
          input_revision = excluded.input_revision,
          metric_spec_version = excluded.metric_spec_version,
          engine_version = excluded.engine_version,
          status = excluded.status,
          updated_at = now();
    rebuilt := rebuilt + 1;
  end loop;

  return jsonb_build_object('kind', 'success', 'rebuiltScopes', rebuilt);
end;
$$;

revoke all on function public.prop_os_pi_rebuild_current_projection(uuid)
  from public, anon, authenticated, prop_os_recalc_processor;
grant execute on function public.prop_os_pi_rebuild_current_projection(uuid)
  to postgres, service_role, prop_os_performance_intelligence_processor;

create or replace function public.prop_os_pi_projection_parity(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
declare
  mismatches int := 0;
  live_count int := 0;
  expected_count int := 0;
begin
  select count(*) into live_count
  from public.prop_performance_intelligence_current c
  where c.user_id = p_user_id;

  select count(*) into expected_count
  from (
    select distinct on (s.scope_key) s.scope_key
    from public.prop_performance_intelligence_snapshots s
    where s.user_id = p_user_id
      and s.status in (
        'current', 'insufficient_data', 'incomplete_data', 'unsupported', 'outdated'
      )
    order by s.scope_key, s.assignment_revision desc, s.calculated_at desc, s.id desc
  ) x;

  select count(*) into mismatches
  from public.prop_performance_intelligence_current c
  where c.user_id = p_user_id
    and not exists (
      select 1
      from (
        select distinct on (s.scope_key)
          s.scope_key,
          s.id as snapshot_id,
          s.assignment_revision,
          s.input_revision,
          s.metric_spec_version,
          s.engine_version
        from public.prop_performance_intelligence_snapshots s
        where s.user_id = p_user_id
          and s.status in (
            'current', 'insufficient_data', 'incomplete_data', 'unsupported', 'outdated'
          )
        order by s.scope_key, s.assignment_revision desc, s.calculated_at desc, s.id desc
      ) e
      where e.scope_key = c.scope_key
        and e.snapshot_id = c.snapshot_id
        and e.assignment_revision = c.assignment_revision
        and e.input_revision = c.input_revision
        and e.metric_spec_version = c.metric_spec_version
        and e.engine_version = c.engine_version
    );

  return jsonb_build_object(
    'kind', case when mismatches = 0 and live_count = expected_count then 'parity' else 'drift' end,
    'liveCount', live_count,
    'expectedCount', expected_count,
    'mismatches', mismatches
  );
end;
$$;

revoke all on function public.prop_os_pi_projection_parity(uuid)
  from public, anon;
grant execute on function public.prop_os_pi_projection_parity(uuid)
  to authenticated, service_role, postgres, prop_os_performance_intelligence_processor;

-- PI processor must NOT receive assignment complete grants (default deny; no grant).
