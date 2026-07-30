-- Phase 2C — Trade assignment commands (append-only events + hardened RPCs).
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_2C.md
--
-- Events are append-only. Current assignment is derived from history and
-- mirrored into prop_trade_assignments (Phase 1D projection).

-- ---------------------------------------------------------------------------
-- Append-only assignment events
-- ---------------------------------------------------------------------------

create table if not exists public.prop_trade_assignment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_client_id text not null,
  account_id uuid references public.prop_accounts(id) on delete restrict,
  challenge_id uuid references public.prop_challenges(id) on delete restrict,
  source text not null check (
    source in ('manual', 'verified_import', 'system_suggestion')
  ),
  state text not null check (
    state in ('assigned', 'superseded', 'removed')
  ),
  effective_at timestamptz not null,
  actor text not null,
  client_request_id text not null,
  reason_code text,
  superseded_assignment_id uuid,
  assignment_revision bigint not null,
  created_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0',
  constraint prop_trade_assignment_events_assigned_shape check (
    (state = 'assigned' and challenge_id is not null and account_id is not null)
    or (state in ('superseded', 'removed'))
  )
);

create index if not exists prop_trade_assignment_events_user_trade_idx
  on public.prop_trade_assignment_events (user_id, trade_client_id, assignment_revision desc);

create index if not exists prop_trade_assignment_events_challenge_idx
  on public.prop_trade_assignment_events (challenge_id, assignment_revision desc);

alter table public.prop_trade_assignment_events enable row level security;
alter table public.prop_trade_assignment_events force row level security;

revoke all on table public.prop_trade_assignment_events from public, anon, authenticated;
grant all on table public.prop_trade_assignment_events to postgres, service_role;
grant select on table public.prop_trade_assignment_events to authenticated;

drop policy if exists prop_trade_assignment_events_select_own on public.prop_trade_assignment_events;
create policy prop_trade_assignment_events_select_own
  on public.prop_trade_assignment_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists prop_trade_assignment_events_forbid_mutation on public.prop_trade_assignment_events;
create trigger prop_trade_assignment_events_forbid_mutation
  before update or delete on public.prop_trade_assignment_events
  for each row execute function public.prop_os_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Per-user monotonic assignment revision
-- ---------------------------------------------------------------------------

create table if not exists public.prop_os_assignment_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0'
);

alter table public.prop_os_assignment_revisions enable row level security;
alter table public.prop_os_assignment_revisions force row level security;
revoke all on table public.prop_os_assignment_revisions from public, anon, authenticated;
grant all on table public.prop_os_assignment_revisions to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Challenge recalculation state
-- ---------------------------------------------------------------------------

create table if not exists public.prop_os_challenge_recalc (
  challenge_id uuid primary key references public.prop_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (
    state in ('not_required', 'queued', 'running', 'completed', 'failed')
  ) default 'not_required',
  assignment_revision bigint not null default 0,
  snapshot_revision bigint,
  reason_code text,
  updated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0'
);

alter table public.prop_os_challenge_recalc enable row level security;
alter table public.prop_os_challenge_recalc force row level security;
revoke all on table public.prop_os_challenge_recalc from public, anon, authenticated;
grant all on table public.prop_os_challenge_recalc to postgres, service_role;
grant select on table public.prop_os_challenge_recalc to authenticated;

drop policy if exists prop_os_challenge_recalc_select_own on public.prop_os_challenge_recalc;
create policy prop_os_challenge_recalc_select_own
  on public.prop_os_challenge_recalc
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_assignment_current(
  p_user_id uuid,
  p_trade_client_id text
)
returns public.prop_trade_assignment_events
language plpgsql
stable
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
end;
$$;

revoke all on function public.prop_os_assignment_queue_recalc(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.prop_os_assignment_queue_recalc(uuid, uuid, bigint) to service_role, postgres;

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
end;
$$;

revoke all on function public.prop_os_assignment_upsert_projection(uuid, text, uuid, uuid, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.prop_os_assignment_upsert_projection(uuid, text, uuid, uuid, text, timestamptz, boolean)
  to service_role, postgres;

-- ---------------------------------------------------------------------------
-- assign trades
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

  select array_agg(distinct x) into ids
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

  -- validate all trades first
  foreach tid in array ids loop
    select * into jr
    from public.trade_journal as t
    where t.user_id = uid
      and t.client_id = tid
      and t.deleted_at is null;

    if not found then
      return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object(tid, 'incomplete'));
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
    if cur is not null and cur.challenge_id = p_challenge_id then
      events := events || jsonb_build_array(jsonb_build_object(
        'id', cur.id,
        'tradeClientId', tid,
        'challengeId', p_challenge_id,
        'state', 'assigned',
        'assignmentRevision', cur.assignment_revision
      ));
      continue;
    end if;

    if cur is not null and cur.challenge_id is not null then
      affected := array_append(affected, cur.challenge_id);
      insert into public.prop_trade_assignment_events (
        id, user_id, trade_client_id, account_id, challenge_id, source, state,
        effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
        assignment_revision, created_at
      ) values (
        gen_random_uuid(), uid, tid, cur.account_id, cur.challenge_id, cur.source, 'superseded',
        now_ts, 'user', p_request_id, 'superseded_by_reassign', cur.id, rev, now_ts
      );
    end if;

    select * into jr
    from public.trade_journal as t
    where t.user_id = uid and t.client_id = tid and t.deleted_at is null;

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
      id, user_id, trade_client_id, account_id, challenge_id, source, state,
      effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
      assignment_revision, created_at
    ) values (
      ev_id, uid, tid, p_account_id, p_challenge_id, src, 'assigned',
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
      'challengeId', p_challenge_id,
      'state', 'assigned',
      'assignmentRevision', rev
    ));
  end loop;

  select array_agg(distinct x) into affected from unnest(affected) as x;
  if affected is not null then
    for i in 1 .. coalesce(array_length(affected, 1), 0) loop
      perform public.prop_os_assignment_queue_recalc(uid, affected[i], rev);
    end loop;
  end if;

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
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_assign_trades(text, text, uuid, uuid, text[], text, text, boolean)
  from public, anon;
grant execute on function public.prop_os_cmd_assign_trades(text, text, uuid, uuid, text[], text, text, boolean)
  to authenticated;

create or replace function public.prop_os_cmd_reassign_trades(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_challenge_id uuid,
  p_trade_client_ids text[],
  p_confirm boolean,
  p_source text default 'manual',
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  if coalesce(p_confirm, false) is not true then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'reassignment_confirmation_required');
  end if;
  return public.prop_os_cmd_assign_trades(
    p_request_id, p_request_hash, p_account_id, p_challenge_id,
    p_trade_client_ids, p_source, p_reason_code, true
  );
end;
$$;

revoke all on function public.prop_os_cmd_reassign_trades(text, text, uuid, uuid, text[], boolean, text, text)
  from public, anon;
grant execute on function public.prop_os_cmd_reassign_trades(text, text, uuid, uuid, text[], boolean, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- remove assignments
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
  cid uuid;
  ev_id uuid;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':remove_assignments:' || p_request_id, 0)
  );

  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select array_agg(distinct x) into ids
  from unnest(coalesce(p_trade_client_ids, array[]::text[])) as x
  where length(btrim(x)) > 0;

  if ids is null or coalesce(array_length(ids, 1), 0) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('tradeClientIds', 'required'));
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

    insert into public.prop_trade_assignment_events (
      id, user_id, trade_client_id, account_id, challenge_id, source, state,
      effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
      assignment_revision, created_at
    ) values (
      gen_random_uuid(), uid, tid, cur.account_id, cur.challenge_id, cur.source, 'superseded',
      now_ts, 'user', p_request_id, 'superseded_by_remove', cur.id, rev, now_ts
    );

    ev_id := gen_random_uuid();
    insert into public.prop_trade_assignment_events (
      id, user_id, trade_client_id, account_id, challenge_id, source, state,
      effective_at, actor, client_request_id, reason_code, superseded_assignment_id,
      assignment_revision, created_at
    ) values (
      ev_id, uid, tid, cur.account_id, cur.challenge_id, cur.source, 'removed',
      now_ts, 'user', p_request_id, coalesce(p_reason_code, 'user_removed'), cur.id, rev, now_ts
    );

    perform public.prop_os_assignment_upsert_projection(
      uid, tid, null, null, cur.source, now_ts, true
    );

    events := events || jsonb_build_array(jsonb_build_object(
      'id', ev_id,
      'tradeClientId', tid,
      'challengeId', cur.challenge_id,
      'state', 'removed',
      'assignmentRevision', rev
    ));
  end loop;

  select array_agg(distinct x) into affected from unnest(affected) as x where x is not null;
  if affected is not null then
    foreach cid in array affected loop
      perform public.prop_os_assignment_queue_recalc(uid, cid, rev);
    end loop;
  end if;

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
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_remove_trade_assignments(text, text, uuid, text[], text)
  from public, anon;
grant execute on function public.prop_os_cmd_remove_trade_assignments(text, text, uuid, text[], text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Recalculation completion (stale-write protected)
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
  uid uuid;
  prior jsonb;
  ch public.prop_challenges%rowtype;
  job public.prop_os_challenge_recalc%rowtype;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':complete_recalc:' || p_request_id, 0)
  );
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into ch from public.prop_challenges as c where c.id = p_challenge_id for update;
  if not found or ch.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select * into job from public.prop_os_challenge_recalc as r where r.challenge_id = p_challenge_id for update;
  if not found then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;
  if job.state = 'completed' and job.assignment_revision > p_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;
  if job.assignment_revision > p_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;
  if job.state not in ('queued', 'running', 'failed', 'completed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'recalc_not_queued');
  end if;

  update public.prop_os_challenge_recalc
     set state = 'completed',
         assignment_revision = p_assignment_revision,
         snapshot_revision = p_snapshot_revision,
         reason_code = null,
         updated_at = now()
   where challenge_id = p_challenge_id;

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'complete_recalculation', p_request_hash,
    'success',
    jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', p_assignment_revision,
      'snapshotRevision', p_snapshot_revision
    ),
    null,
    jsonb_build_object('challengeId', p_challenge_id)
  );

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', p_assignment_revision,
      'snapshotRevision', p_snapshot_revision
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
  from public, anon;
grant execute on function public.prop_os_cmd_complete_recalculation(text, text, uuid, bigint, bigint)
  to authenticated;

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
  uid uuid;
  prior jsonb;
  ch public.prop_challenges%rowtype;
  job public.prop_os_challenge_recalc%rowtype;
begin
  uid := public.prop_os_cmd_assert_authorized();
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into ch from public.prop_challenges as c where c.id = p_challenge_id for update;
  if not found or ch.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select * into job from public.prop_os_challenge_recalc as r where r.challenge_id = p_challenge_id for update;
  if found and job.assignment_revision > p_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_recalculation');
  end if;

  insert into public.prop_os_challenge_recalc (
    challenge_id, user_id, state, assignment_revision, reason_code, updated_at
  ) values (
    p_challenge_id, uid, 'failed', p_assignment_revision, coalesce(p_reason_code, 'recalc_failed'), now()
  )
  on conflict (challenge_id) do update
    set state = 'failed',
        assignment_revision = p_assignment_revision,
        reason_code = excluded.reason_code,
        updated_at = now();

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'fail_recalculation', p_request_hash,
    'success',
    jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', p_assignment_revision,
      'reasonCode', coalesce(p_reason_code, 'recalc_failed')
    ),
    null,
    jsonb_build_object('challengeId', p_challenge_id)
  );

  return jsonb_build_object(
    'kind', 'success',
    'value', jsonb_build_object(
      'challengeId', p_challenge_id,
      'assignmentRevision', p_assignment_revision,
      'reasonCode', coalesce(p_reason_code, 'recalc_failed')
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
  from public, anon;
grant execute on function public.prop_os_cmd_fail_recalculation(text, text, uuid, bigint, text)
  to authenticated;
