-- Phase 2C remediation — trusted recalculation + canonical trade identity.
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_2C.md

-- ---------------------------------------------------------------------------
-- Trusted recalculation processor role (no App JWT path)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'prop_os_recalc_processor') then
    create role prop_os_recalc_processor nologin;
  end if;
end
$$;

grant usage on schema public to prop_os_recalc_processor;
grant prop_os_recalc_processor to postgres;
grant prop_os_recalc_processor to service_role;

create or replace function public.prop_os_assert_recalc_processor()
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
  -- Primary gate is GRANT EXECUTE. Defense-in-depth: never allow App JWT / anon roles.
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'permission denied for recalculation processor'
      using errcode = '42501';
  end if;
  if active_role in ('authenticated', 'anon', 'public') then
    raise exception 'permission denied for recalculation processor'
      using errcode = '42501';
  end if;
  if active_role in ('postgres', 'service_role', 'prop_os_recalc_processor') then
    return;
  end if;
  if session_user in ('postgres', 'service_role') then
    return;
  end if;
  if pg_catalog.pg_has_role(session_user, 'prop_os_recalc_processor', 'member') then
    return;
  end if;
  raise exception 'permission denied for recalculation processor'
    using errcode = '42501';
end;
$$;

revoke all on function public.prop_os_assert_recalc_processor() from public, anon, authenticated;
grant execute on function public.prop_os_assert_recalc_processor()
  to postgres, service_role, prop_os_recalc_processor;

create or replace function public.prop_os_assignment_current(
  p_user_id uuid,
  p_trade_client_id text
)
returns public.prop_trade_assignment_events
language plpgsql
volatile
security definer
set search_path to pg_catalog, public
as $$
declare
  rec public.prop_trade_assignment_events%rowtype;
begin
  for rec in
    select *
    from public.prop_trade_assignment_events as e
    where e.user_id = p_user_id
      and e.trade_client_id = p_trade_client_id
    order by e.assignment_revision desc, e.created_at desc, e.id desc
  loop
    if rec.state = 'assigned' then
      return rec;
    end if;
    if rec.state = 'removed' then
      return null;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.prop_os_assignment_current(uuid, text) from public, anon;
grant execute on function public.prop_os_assignment_current(uuid, text) to authenticated, service_role, postgres;

-- ---------------------------------------------------------------------------
-- Failure-injection hook (QA / local only; no-op unless GUC set)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_debug_maybe_fail(p_stage text)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  target text;
begin
  begin
    target := nullif(btrim(current_setting('prop_os.fail_after', true)), '');
  exception
    when others then
      target := null;
  end;
  if target is not null and target = p_stage then
    raise exception 'prop_os_injected_failure:%', p_stage
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.prop_os_debug_maybe_fail(text) from public, anon, authenticated;
grant execute on function public.prop_os_debug_maybe_fail(text) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Canonical journal trade identity
--   PK: trade_journal.id (uuid)
--   Owner-scoped immutable provenance alias: trade_journal.client_id
--     UNIQUE (user_id, client_id); immutable after insert
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_trade_journal_forbid_client_id_mutation()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and old.client_id is distinct from new.client_id then
    raise exception 'trade_journal.client_id is immutable after creation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists prop_os_trade_journal_client_id_immutable on public.trade_journal;
create trigger prop_os_trade_journal_client_id_immutable
  before update on public.trade_journal
  for each row execute function public.prop_os_trade_journal_forbid_client_id_mutation();

alter table public.prop_trade_assignment_events
  add column if not exists journal_trade_id uuid;

update public.prop_trade_assignment_events as e
set journal_trade_id = j.id
from public.trade_journal as j
where e.journal_trade_id is null
  and j.user_id = e.user_id
  and j.client_id = e.trade_client_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prop_trade_assignment_events_journal_trade_id_fkey'
  ) then
    alter table public.prop_trade_assignment_events
      add constraint prop_trade_assignment_events_journal_trade_id_fkey
      foreign key (journal_trade_id) references public.trade_journal(id) on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prop_trade_assignment_events_user_trade_fk'
  ) then
    alter table public.prop_trade_assignment_events
      add constraint prop_trade_assignment_events_user_trade_fk
      foreign key (user_id, trade_client_id)
      references public.trade_journal(user_id, client_id)
      on delete restrict;
  end if;
end
$$;

create index if not exists prop_trade_assignment_events_journal_trade_idx
  on public.prop_trade_assignment_events (user_id, journal_trade_id, assignment_revision desc);

comment on column public.prop_trade_assignment_events.journal_trade_id is
  'Canonical journal trade PK (trade_journal.id). Required for new assignment events.';
comment on column public.prop_trade_assignment_events.trade_client_id is
  'Owner-scoped immutable provenance alias (trade_journal.client_id). Not a substitute PK.';

-- ---------------------------------------------------------------------------
-- Helpers: bump / queue / projection — inject fail stages for atomicity QA
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_assignment_bump_revision(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  rev bigint;
begin
  insert into public.prop_os_assignment_revisions (user_id, revision, updated_at)
  values (p_user_id, 1, now())
  on conflict (user_id) do update
    set revision = public.prop_os_assignment_revisions.revision + 1,
        updated_at = now()
  returning revision into rev;
  perform public.prop_os_debug_maybe_fail('revision');
  return rev;
end;
$$;

revoke all on function public.prop_os_assignment_bump_revision(uuid) from public, anon, authenticated;
grant execute on function public.prop_os_assignment_bump_revision(uuid) to service_role, postgres;

create or replace function public.prop_os_assignment_queue_recalc(
  p_user_id uuid,
  p_challenge_id uuid,
  p_revision bigint
)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  insert into public.prop_os_challenge_recalc (
    challenge_id, user_id, state, assignment_revision, updated_at
  ) values (
    p_challenge_id, p_user_id, 'queued', p_revision, now()
  )
  on conflict (challenge_id) do update
    set state = 'queued',
        assignment_revision = greatest(
          public.prop_os_challenge_recalc.assignment_revision,
          excluded.assignment_revision
        ),
        reason_code = null,
        updated_at = now(),
        user_id = excluded.user_id;
  perform public.prop_os_debug_maybe_fail('queue');
end;
$$;

revoke all on function public.prop_os_assignment_queue_recalc(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.prop_os_assignment_queue_recalc(uuid, uuid, bigint)
  to service_role, postgres;

create or replace function public.prop_os_assignment_upsert_projection(
  p_user_id uuid,
  p_trade_client_id text,
  p_account_id uuid,
  p_challenge_id uuid,
  p_source text,
  p_at timestamptz,
  p_remove boolean
)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  db_state text;
  actor text;
begin
  if p_remove then
    insert into public.prop_trade_assignments (
      id, user_id, trade_client_id, account_id, challenge_id,
      assignment_state, assigned_at, assigned_by, provenance, schema_version, created_at, updated_at
    ) values (
      gen_random_uuid(), p_user_id, p_trade_client_id, null, null,
      'unassigned', null, null,
      jsonb_build_object('actor', 'user', 'source', 'assignment_remove', 'reason', 'removed', 'at', p_at),
      'prop-os-schema-v0', p_at, p_at
    )
    on conflict (user_id, trade_client_id) do update
      set account_id = null,
          challenge_id = null,
          assignment_state = 'unassigned',
          assigned_at = null,
          assigned_by = null,
          provenance = excluded.provenance,
          updated_at = p_at;
    perform public.prop_os_debug_maybe_fail('projection');
    return;
  end if;

  db_state := case when p_source = 'verified_import' then 'verified_import' else 'manual' end;
  actor := 'user';

  insert into public.prop_trade_assignments (
    id, user_id, trade_client_id, account_id, challenge_id,
    assignment_state, assigned_at, assigned_by, provenance, schema_version, created_at, updated_at
  ) values (
    gen_random_uuid(), p_user_id, p_trade_client_id, p_account_id, p_challenge_id,
    db_state, p_at, actor,
    jsonb_build_object('actor', actor, 'source', p_source, 'reason', 'assign', 'at', p_at),
    'prop-os-schema-v0', p_at, p_at
  )
  on conflict (user_id, trade_client_id) do update
    set account_id = excluded.account_id,
        challenge_id = excluded.challenge_id,
        assignment_state = excluded.assignment_state,
        assigned_at = excluded.assigned_at,
        assigned_by = excluded.assigned_by,
        provenance = excluded.provenance,
        updated_at = p_at;
  perform public.prop_os_debug_maybe_fail('projection');
end;
$$;

revoke all on function public.prop_os_assignment_upsert_projection(uuid, text, uuid, uuid, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.prop_os_assignment_upsert_projection(uuid, text, uuid, uuid, text, timestamptz, boolean)
  to service_role, postgres;

-- Event-stage injection (fires once per inserted assignment event)
create or replace function public.prop_os_assignment_event_after_insert()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  perform public.prop_os_debug_maybe_fail('event');
  return new;
end;
$$;

drop trigger if exists prop_trade_assignment_events_fail_after on public.prop_trade_assignment_events;
create trigger prop_trade_assignment_events_fail_after
  after insert on public.prop_trade_assignment_events
  for each row execute function public.prop_os_assignment_event_after_insert();

-- ---------------------------------------------------------------------------
-- Rebuild current projection from append-only events
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_assignment_rebuild_projection(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  tid text;
  cur public.prop_trade_assignment_events%rowtype;
  rebuilt int := 0;
begin
  perform public.prop_os_assert_recalc_processor();

  for tid in
    select distinct e.trade_client_id
    from public.prop_trade_assignment_events as e
    where e.user_id = p_user_id
  loop
    cur := public.prop_os_assignment_current(p_user_id, tid);
    if cur is null then
      perform public.prop_os_assignment_upsert_projection(
        p_user_id, tid, null, null, 'manual', now(), true
      );
    else
      perform public.prop_os_assignment_upsert_projection(
        p_user_id, tid, cur.account_id, cur.challenge_id, cur.source, cur.effective_at, false
      );
    end if;
    rebuilt := rebuilt + 1;
  end loop;

  return jsonb_build_object('kind', 'success', 'rebuilt', rebuilt);
end;
$$;

revoke all on function public.prop_os_assignment_rebuild_projection(uuid)
  from public, anon, authenticated;
grant execute on function public.prop_os_assignment_rebuild_projection(uuid)
  to postgres, service_role, prop_os_recalc_processor;

-- Compare live projection vs rebuild-derived current (read-only parity check)
create or replace function public.prop_os_assignment_projection_parity(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
declare
  mismatches jsonb := '[]'::jsonb;
  tid text;
  cur public.prop_trade_assignment_events%rowtype;
  proj public.prop_trade_assignments%rowtype;
  multi int;
begin
  select count(*) into multi
  from (
    select trade_client_id
    from public.prop_trade_assignments
    where user_id = p_user_id
      and challenge_id is not null
      and assignment_state in ('manual', 'verified_import')
    group by trade_client_id
    having count(*) > 1
  ) as d;
  if multi > 0 then
    mismatches := mismatches || jsonb_build_array(jsonb_build_object(
      'tradeClientId', '*',
      'reason', 'multiple_current_challenges'
    ));
  end if;

  for tid in
    select distinct x from (
      select e.trade_client_id as x from public.prop_trade_assignment_events as e where e.user_id = p_user_id
      union
      select a.trade_client_id as x from public.prop_trade_assignments as a where a.user_id = p_user_id
    ) as u
  loop
    cur := public.prop_os_assignment_current(p_user_id, tid);
    select * into proj
    from public.prop_trade_assignments as a
    where a.user_id = p_user_id and a.trade_client_id = tid;

    if cur is null then
      if found and proj.challenge_id is not null and proj.assignment_state in ('manual', 'verified_import') then
        mismatches := mismatches || jsonb_build_array(jsonb_build_object(
          'tradeClientId', tid,
          'reason', 'projection_assigned_events_unassigned'
        ));
      end if;
    else
      if not found
         or proj.challenge_id is distinct from cur.challenge_id
         or proj.account_id is distinct from cur.account_id
         or proj.assignment_state not in ('manual', 'verified_import')
      then
        mismatches := mismatches || jsonb_build_array(jsonb_build_object(
          'tradeClientId', tid,
          'reason', 'projection_mismatch',
          'eventChallengeId', cur.challenge_id,
          'projChallengeId', proj.challenge_id
        ));
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'kind', case when jsonb_array_length(mismatches) = 0 then 'success' else 'mismatch' end,
    'mismatches', mismatches
  );
end;
$$;

revoke all on function public.prop_os_assignment_projection_parity(uuid)
  from public, anon, authenticated;
grant execute on function public.prop_os_assignment_projection_parity(uuid)
  to postgres, service_role, prop_os_recalc_processor, authenticated;

-- ---------------------------------------------------------------------------
-- Snapshot readiness for a queued assignment revision
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_recalc_snapshots_ready(
  p_challenge_id uuid,
  p_assignment_revision bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
declare
  prefix text := 'asg-rev-' || p_assignment_revision::text || ':';
  eng int;
  score int;
begin
  select count(*) into eng
  from public.prop_engine_snapshots as s
  where s.challenge_id = p_challenge_id
    and s.input_revision like prefix || '%';
  select count(*) into score
  from public.prop_score_snapshots as s
  where s.challenge_id = p_challenge_id
    and s.input_revision like prefix || '%';
  return eng >= 1 and score >= 1;
end;
$$;

revoke all on function public.prop_os_recalc_snapshots_ready(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.prop_os_recalc_snapshots_ready(uuid, bigint)
  to postgres, service_role, prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- Processor receipts (no auth.uid() — owner derived from challenge server-side)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_processor_lookup_receipt(
  p_user_id uuid,
  p_request_id text,
  p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  rec public.prop_os_command_receipts%rowtype;
begin
  perform public.prop_os_assert_recalc_processor();

  select * into rec
  from public.prop_os_command_receipts as r
  where r.user_id = p_user_id
    and r.client_request_id = p_request_id;

  if not found then
    return null;
  end if;

  if rec.request_hash is distinct from p_hash then
    return jsonb_build_object(
      'kind', 'conflict',
      'reasonCode', 'idempotency_hash_mismatch'
    );
  end if;

  return jsonb_build_object(
    'kind', rec.result_status,
    'value', rec.result_body,
    'reasonCode', rec.reason_code
  );
end;
$$;

revoke all on function public.prop_os_cmd_processor_lookup_receipt(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.prop_os_cmd_processor_lookup_receipt(uuid, text, text)
  to postgres, service_role, prop_os_recalc_processor;

create or replace function public.prop_os_cmd_processor_store_receipt(
  p_user_id uuid,
  p_request_id text,
  p_command_type text,
  p_hash text,
  p_result_status text,
  p_result_body jsonb,
  p_reason_code text,
  p_entity_ids jsonb
)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  perform public.prop_os_assert_recalc_processor();
  insert into public.prop_os_command_receipts (
    user_id, client_request_id, command_type, request_hash,
    result_status, result_body, reason_code, entity_ids
  ) values (
    p_user_id, p_request_id, p_command_type, p_hash,
    p_result_status, coalesce(p_result_body, '{}'::jsonb), p_reason_code,
    coalesce(p_entity_ids, '{}'::jsonb)
  )
  on conflict (user_id, client_request_id) do nothing;
end;
$$;

revoke all on function public.prop_os_cmd_processor_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.prop_os_cmd_processor_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb)
  to postgres, service_role, prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- Processor: mark running (server-owned revision)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_processor_mark_recalc_running(
  p_challenge_id uuid,
  p_claimed_assignment_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  job public.prop_os_challenge_recalc%rowtype;
begin
  perform public.prop_os_assert_recalc_processor();

  select * into job
  from public.prop_os_challenge_recalc as r
  where r.challenge_id = p_challenge_id
  for update;
  if not found then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;
  if job.assignment_revision is distinct from p_claimed_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;
  if job.state = 'completed' and job.assignment_revision = p_claimed_assignment_revision then
    return jsonb_build_object(
      'kind', 'success',
      'value', jsonb_build_object(
        'challengeId', p_challenge_id,
        'assignmentRevision', job.assignment_revision,
        'state', 'completed',
        'idempotent', true
      )
    );
  end if;
  if job.state not in ('queued', 'running', 'failed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;

  update public.prop_os_challenge_recalc
     set state = 'running',
         updated_at = now()
   where challenge_id = p_challenge_id;

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', job.assignment_revision,
      'userId', job.user_id,
      'state', 'running'
    )
  );
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_processor_mark_recalc_running(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.prop_os_cmd_processor_mark_recalc_running(uuid, bigint)
  to postgres, service_role, prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- Processor complete / fail — replaces App-callable paths
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_complete_recalculation(
  p_request_id text,
  p_request_hash text,
  p_challenge_id uuid,
  p_assignment_revision bigint,
  p_snapshot_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  prior jsonb;
  ch public.prop_challenges%rowtype;
  job public.prop_os_challenge_recalc%rowtype;
  owner_id uuid;
  snap_rev bigint;
begin
  perform public.prop_os_assert_recalc_processor();

  select * into ch from public.prop_challenges as c where c.id = p_challenge_id for update;
  if not found then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  owner_id := ch.user_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(owner_id::text || ':complete_recalc:' || p_request_id, 0)
  );

  prior := public.prop_os_cmd_processor_lookup_receipt(owner_id, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into job
  from public.prop_os_challenge_recalc as r
  where r.challenge_id = p_challenge_id
  for update;
  if not found then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;

  -- Server-owned revision is authoritative; client claim must match exactly.
  if job.assignment_revision is distinct from p_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;

  if job.state = 'completed'
     and job.assignment_revision = p_assignment_revision
     and job.snapshot_revision is not null
  then
    perform public.prop_os_cmd_processor_store_receipt(
      owner_id, p_request_id, 'complete_recalculation', p_request_hash,
      'success',
      jsonb_build_object(
        'challengeId', p_challenge_id,
        'assignmentRevision', job.assignment_revision,
        'snapshotRevision', job.snapshot_revision,
        'idempotent', true
      ),
      null,
      jsonb_build_object('challengeId', p_challenge_id)
    );
    return jsonb_build_object(
      'kind', 'success',
      'value', jsonb_build_object(
        'challengeId', p_challenge_id,
        'assignmentRevision', job.assignment_revision,
        'snapshotRevision', job.snapshot_revision,
        'idempotent', true
      )
    );
  end if;

  if job.state not in ('queued', 'running', 'failed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;

  if not public.prop_os_recalc_snapshots_ready(p_challenge_id, job.assignment_revision) then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'snapshots_incomplete');
  end if;

  -- Snapshot revision is server-derived from the queued assignment revision.
  -- Client claim must match when supplied (> 0); owner IDs never accepted from client.
  snap_rev := job.assignment_revision;
  if p_snapshot_revision is not null
     and p_snapshot_revision > 0
     and p_snapshot_revision is distinct from snap_rev
  then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'snapshot_revision_mismatch');
  end if;

  update public.prop_os_challenge_recalc
     set state = 'completed',
         snapshot_revision = snap_rev,
         reason_code = null,
         updated_at = now()
   where challenge_id = p_challenge_id
     and assignment_revision = job.assignment_revision;

  if not found then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;

  perform public.prop_os_cmd_processor_store_receipt(
    owner_id, p_request_id, 'complete_recalculation', p_request_hash,
    'success',
    jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', job.assignment_revision,
      'snapshotRevision', snap_rev
    ),
    null,
    jsonb_build_object('challengeId', p_challenge_id)
  );

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', job.assignment_revision,
      'snapshotRevision', snap_rev
    )
  );
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_complete_recalculation(text, text, uuid, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.prop_os_cmd_complete_recalculation(text, text, uuid, bigint, bigint)
  to postgres, service_role, prop_os_recalc_processor;

create or replace function public.prop_os_cmd_fail_recalculation(
  p_request_id text,
  p_request_hash text,
  p_challenge_id uuid,
  p_assignment_revision bigint,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  prior jsonb;
  ch public.prop_challenges%rowtype;
  job public.prop_os_challenge_recalc%rowtype;
  owner_id uuid;
  prev_snap bigint;
begin
  perform public.prop_os_assert_recalc_processor();

  select * into ch from public.prop_challenges as c where c.id = p_challenge_id for update;
  if not found then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  owner_id := ch.user_id;

  prior := public.prop_os_cmd_processor_lookup_receipt(owner_id, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into job
  from public.prop_os_challenge_recalc as r
  where r.challenge_id = p_challenge_id
  for update;
  if not found then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;
  if job.assignment_revision is distinct from p_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;

  -- Failure must not promote any snapshot to current.
  prev_snap := job.snapshot_revision;

  update public.prop_os_challenge_recalc
     set state = 'failed',
         reason_code = coalesce(nullif(btrim(p_reason_code), ''), 'recalc_failed'),
         snapshot_revision = prev_snap,
         updated_at = now()
   where challenge_id = p_challenge_id
     and assignment_revision = job.assignment_revision;

  perform public.prop_os_cmd_processor_store_receipt(
    owner_id, p_request_id, 'fail_recalculation', p_request_hash,
    'success',
    jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', job.assignment_revision,
      'reasonCode', coalesce(nullif(btrim(p_reason_code), ''), 'recalc_failed'),
      'snapshotRevisionUnchanged', prev_snap
    ),
    null,
    jsonb_build_object('challengeId', p_challenge_id)
  );

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', job.assignment_revision,
      'reasonCode', coalesce(nullif(btrim(p_reason_code), ''), 'recalc_failed'),
      'snapshotRevisionUnchanged', prev_snap
    )
  );
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_fail_recalculation(text, text, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.prop_os_cmd_fail_recalculation(text, text, uuid, bigint, text)
  to postgres, service_role, prop_os_recalc_processor;

-- ---------------------------------------------------------------------------
-- Patch assign: require journal_trade_id on new events + receipt fail stage
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_assign_trades(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_challenge_id uuid,
  p_trade_client_ids text[],
  p_source text default 'manual',
  p_reason_code text default null,
  p_allow_reassign boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  ch public.prop_challenges%rowtype;
  src text;
  ids text[];
  tid text;
  jr record;
  cur public.prop_trade_assignment_events%rowtype;
  occurred_at timestamptz;
  rev bigint;
  now_ts timestamptz := now();
  ev_id uuid;
  events jsonb := '[]'::jsonb;
  affected uuid[] := array[]::uuid[];
  affected_unique uuid[];
  exec_id text;
  i int;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':assign_trades:' || p_request_id, 0)
  );

  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  src := coalesce(nullif(p_source, ''), 'manual');
  if src not in ('manual', 'verified_import', 'system_suggestion') then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('source', 'invalid'));
  end if;

  select array_agg(distinct x order by x) into ids
  from unnest(coalesce(p_trade_client_ids, array[]::text[])) as x
  where length(btrim(x)) > 0;

  if ids is null or coalesce(array_length(ids, 1), 0) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('tradeClientIds', 'required'));
  end if;
  if array_length(ids, 1) > 50 then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'bulk_limit_exceeded');
  end if;

  select * into acct from public.prop_accounts as a where a.id = p_account_id for update;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if acct.status in ('archived', 'closed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'archived');
  end if;

  select * into ch from public.prop_challenges as c where c.id = p_challenge_id for update;
  if not found or ch.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if ch.account_id is distinct from p_account_id then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'cross_account_selection');
  end if;
  if ch.status not in ('active', 'at_risk') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'challenge_not_accepting');
  end if;

  foreach tid in array ids loop
    select * into jr
    from public.trade_journal as t
    where t.user_id = uid
      and t.client_id = tid
      and t.deleted_at is null;

    if not found then
      return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object(tid, 'incomplete'));
    end if;
    if jr.id is null then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'missing_identity');
    end if;
    if jr.pnl is null then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'missing_pnl');
    end if;

    occurred_at := coalesce(
      nullif(btrim(jr.exit_time), '')::timestamptz,
      nullif(btrim(jr.entry_time), '')::timestamptz,
      case
        when jr.trade_date is null then null
        else (jr.trade_date::text)::timestamptz
      end
    );
    if occurred_at is null then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'missing_timestamp');
    end if;
    if occurred_at < ch.started_at then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'outside_challenge_window');
    end if;
    if ch.ended_at is not null and occurred_at > ch.ended_at then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'outside_challenge_window');
    end if;

    cur := public.prop_os_assignment_current(uid, tid);
    if cur is not null and cur.challenge_id is distinct from p_challenge_id then
      if coalesce(p_allow_reassign, false) is not true then
        return jsonb_build_object('kind', 'conflict', 'reasonCode', 'reassignment_required');
      end if;
    end if;
  end loop;

  rev := public.prop_os_assignment_bump_revision(uid);
  affected := array_append(affected, p_challenge_id);

  foreach tid in array ids loop
    cur := public.prop_os_assignment_current(uid, tid);
    select * into jr
    from public.trade_journal as t
    where t.user_id = uid and t.client_id = tid and t.deleted_at is null;

    -- Use field null-checks: composite IS NOT NULL is unreliable for some returns.
    if cur.id is not null and cur.challenge_id is not distinct from p_challenge_id then
      events := events || jsonb_build_array(jsonb_build_object(
        'id', cur.id,
        'tradeClientId', tid,
        'journalTradeId', cur.journal_trade_id,
        'challengeId', p_challenge_id,
        'state', 'assigned',
        'assignmentRevision', cur.assignment_revision
      ));
      continue;
    end if;

    if cur.id is not null and cur.challenge_id is not null then
      affected := array_append(affected, cur.challenge_id);
      insert into public.prop_trade_assignment_events (
        id, user_id, trade_client_id, journal_trade_id, account_id, challenge_id, source, state,
        effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
        assignment_revision, created_at
      ) values (
        gen_random_uuid(), uid, tid,
        coalesce(cur.journal_trade_id, jr.id),
        cur.account_id, cur.challenge_id, cur.source, 'superseded',
        now_ts, 'user', p_request_id, 'superseded_by_reassign', cur.id, rev, now_ts
      );
    end if;

    occurred_at := coalesce(
      nullif(btrim(jr.exit_time), '')::timestamptz,
      nullif(btrim(jr.entry_time), '')::timestamptz,
      case
        when jr.trade_date is null then null
        else (jr.trade_date::text)::timestamptz
      end
    );
    ev_id := gen_random_uuid();

    insert into public.prop_trade_assignment_events (
      id, user_id, trade_client_id, journal_trade_id, account_id, challenge_id, source, state,
      effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
      assignment_revision, created_at
    ) values (
      ev_id, uid, tid, jr.id, p_account_id, p_challenge_id, src, 'assigned',
      now_ts, 'user', p_request_id, p_reason_code, cur.id, rev, now_ts
    );

    perform public.prop_os_assignment_upsert_projection(
      uid, tid, p_account_id, p_challenge_id, src, now_ts, false
    );

    exec_id := 'asg:' || p_challenge_id::text || ':' || tid || ':' || rev::text;
    insert into public.prop_executions (
      id, user_id, challenge_id, account_id, trade_client_id, occurred_at,
      broker_sequence, realized_pnl_minor, fees_minor, contracts, voided, source, schema_version
    ) values (
      exec_id, uid, p_challenge_id, p_account_id, tid, occurred_at,
      null, round(jr.pnl * 100)::bigint, 0, jr.contracts, false, 'assignment', 'prop-os-schema-v0'
    )
    on conflict (user_id, id) do nothing;

    events := events || jsonb_build_array(jsonb_build_object(
      'id', ev_id,
      'tradeClientId', tid,
      'journalTradeId', jr.id,
      'challengeId', p_challenge_id,
      'state', 'assigned',
      'assignmentRevision', rev
    ));
  end loop;

  select array_agg(distinct x) into affected_unique from unnest(affected) as x;
  affected := coalesce(affected_unique, array[]::uuid[]);
  if coalesce(array_length(affected, 1), 0) > 0 then
    for i in 1 .. array_length(affected, 1) loop
      perform public.prop_os_assignment_queue_recalc(uid, affected[i], rev);
    end loop;
  end if;

  perform public.prop_os_debug_maybe_fail('receipt');

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'assign_trades', p_request_hash,
    'success',
    jsonb_build_object(
      'events', events,
      'assignmentRevision', rev,
      'affectedChallengeIds', coalesce(to_jsonb(affected), '[]'::jsonb),
      'recalculation', jsonb_build_object('kind', 'queued', 'assignmentRevision', rev)
    ),
    null,
    jsonb_build_object('accountId', p_account_id, 'challengeId', p_challenge_id, 'assignmentRevision', rev)
  );

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'events', events,
      'assignmentRevision', rev,
      'affectedChallengeIds', coalesce(to_jsonb(affected), '[]'::jsonb),
      'recalculation', jsonb_build_object('kind', 'queued', 'assignmentRevision', rev)
    )
  );
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when sqlstate 'P0001' then
    return jsonb_build_object('kind', 'unexpected_error');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_assign_trades(text, text, uuid, uuid, text[], text, text, boolean)
  from public, anon;
grant execute on function public.prop_os_cmd_assign_trades(text, text, uuid, uuid, text[], text, text, boolean)
  to authenticated;

-- Privilege matrix comment for Ops / QA
comment on function public.prop_os_cmd_complete_recalculation(text, text, uuid, bigint, bigint) is
  'Trusted processor only. PUBLIC/anon/authenticated EXECUTE revoked. Owner IDs and revisions derived from server-owned prop_os_challenge_recalc + prop_challenges.';
comment on function public.prop_os_cmd_fail_recalculation(text, text, uuid, bigint, text) is
  'Trusted processor only. Does not mark snapshots current. PUBLIC/anon/authenticated EXECUTE revoked.';

-- ---------------------------------------------------------------------------
-- Patch remove: persist journal_trade_id + receipt fail stage
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_remove_trade_assignments(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_trade_client_ids text[],
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  ids text[];
  tid text;
  cur public.prop_trade_assignment_events%rowtype;
  rev bigint;
  now_ts timestamptz := now();
  events jsonb := '[]'::jsonb;
  affected uuid[] := array[]::uuid[];
  affected_unique uuid[];
  cid uuid;
  ev_id uuid;
  jid uuid;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':remove_assignments:' || p_request_id, 0)
  );

  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select array_agg(distinct x order by x) into ids
  from unnest(coalesce(p_trade_client_ids, array[]::text[])) as x
  where length(btrim(x)) > 0;

  if ids is null or coalesce(array_length(ids, 1), 0) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('tradeClientIds', 'required'));
  end if;
  if array_length(ids, 1) > 50 then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'bulk_limit_exceeded');
  end if;

  select * into acct from public.prop_accounts as a where a.id = p_account_id for update;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  rev := public.prop_os_assignment_bump_revision(uid);

  foreach tid in array ids loop
    cur := public.prop_os_assignment_current(uid, tid);
    if cur is null then
      continue;
    end if;
    if cur.challenge_id is not null then
      affected := array_append(affected, cur.challenge_id);
    end if;

    jid := cur.journal_trade_id;
    if jid is null then
      select t.id into jid
      from public.trade_journal as t
      where t.user_id = uid and t.client_id = tid;
    end if;

    insert into public.prop_trade_assignment_events (
      id, user_id, trade_client_id, journal_trade_id, account_id, challenge_id, source, state,
      effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
      assignment_revision, created_at
    ) values (
      gen_random_uuid(), uid, tid, jid, cur.account_id, cur.challenge_id, cur.source, 'superseded',
      now_ts, 'user', p_request_id, 'superseded_by_remove', cur.id, rev, now_ts
    );

    ev_id := gen_random_uuid();
    insert into public.prop_trade_assignment_events (
      id, user_id, trade_client_id, journal_trade_id, account_id, challenge_id, source, state,
      effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
      assignment_revision, created_at
    ) values (
      ev_id, uid, tid, jid, cur.account_id, cur.challenge_id, cur.source, 'removed',
      now_ts, 'user', p_request_id, coalesce(p_reason_code, 'user_removed'), cur.id, rev, now_ts
    );

    perform public.prop_os_assignment_upsert_projection(
      uid, tid, null, null, cur.source, now_ts, true
    );

    events := events || jsonb_build_array(jsonb_build_object(
      'id', ev_id,
      'tradeClientId', tid,
      'journalTradeId', jid,
      'challengeId', cur.challenge_id,
      'state', 'removed',
      'assignmentRevision', rev
    ));
  end loop;

  select array_agg(distinct x) into affected_unique
  from unnest(affected) as x
  where x is not null;
  affected := coalesce(affected_unique, array[]::uuid[]);
  if coalesce(array_length(affected, 1), 0) > 0 then
    foreach cid in array affected loop
      perform public.prop_os_assignment_queue_recalc(uid, cid, rev);
    end loop;
  end if;

  perform public.prop_os_debug_maybe_fail('receipt');

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'remove_trade_assignments', p_request_hash,
    'success',
    jsonb_build_object(
      'events', events,
      'assignmentRevision', rev,
      'affectedChallengeIds', coalesce(to_jsonb(affected), '[]'::jsonb),
      'recalculation', jsonb_build_object('kind', 'queued', 'assignmentRevision', rev)
    ),
    null,
    jsonb_build_object('accountId', p_account_id, 'assignmentRevision', rev)
  );

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'events', events,
      'assignmentRevision', rev,
      'affectedChallengeIds', coalesce(to_jsonb(affected), '[]'::jsonb),
      'recalculation', jsonb_build_object('kind', 'queued', 'assignmentRevision', rev)
    )
  );
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when sqlstate 'P0001' then
    return jsonb_build_object('kind', 'unexpected_error');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_remove_trade_assignments(text, text, uuid, text[], text)
  from public, anon;
grant execute on function public.prop_os_cmd_remove_trade_assignments(text, text, uuid, text[], text)
  to authenticated;
