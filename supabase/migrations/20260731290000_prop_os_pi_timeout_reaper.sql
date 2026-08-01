-- Phase 3A+ — Performance Intelligence timeout / reaper contract.
-- PREPARE ONLY. Apply to staging before production. Do NOT apply to production without Ops approval.
-- Does not weaken processor isolation or authenticated SELECT-only RLS.

-- ---------------------------------------------------------------------------
-- Durable processing start timestamp (queued vs running timeout distinction)
-- ---------------------------------------------------------------------------

alter table public.prop_performance_intelligence_calc
  add column if not exists processing_started_at timestamptz;

comment on column public.prop_performance_intelligence_calc.processing_started_at is
  'Set when PI processor claims a queued job; cleared on complete/fail/reap.';

create index if not exists prop_pi_calc_queue_timeout_idx
  on public.prop_performance_intelligence_calc (requested_at)
  where state = 'queued';

create index if not exists prop_pi_calc_running_timeout_idx
  on public.prop_performance_intelligence_calc (processing_started_at)
  where state = 'running';

-- Thresholds are DB-owned constants (seconds). Client cannot override.
-- queue: 10 minutes waiting without claim
-- processing: 5 minutes after claim without terminal state
create or replace function public.prop_os_pi_queue_timeout_seconds()
returns integer
language sql
immutable
as $$ select 600 $$;

create or replace function public.prop_os_pi_processing_timeout_seconds()
returns integer
language sql
immutable
as $$ select 300 $$;

revoke all on function public.prop_os_pi_queue_timeout_seconds() from public, anon, authenticated;
revoke all on function public.prop_os_pi_processing_timeout_seconds() from public, anon, authenticated;
grant execute on function public.prop_os_pi_queue_timeout_seconds()
  to postgres, service_role, prop_os_performance_intelligence_processor;
grant execute on function public.prop_os_pi_processing_timeout_seconds()
  to postgres, service_role, prop_os_performance_intelligence_processor;

-- ---------------------------------------------------------------------------
-- Claim: move queued → running with processing_started_at (observable phase)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_claim_performance_intelligence(
  p_user_id uuid,
  p_scope_key text,
  p_assignment_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  v_row public.prop_performance_intelligence_calc%rowtype;
begin
  perform public.prop_os_assert_pi_processor();

  if p_user_id is null or nullif(btrim(p_scope_key), '') is null then
    return jsonb_build_object('kind', 'failed', 'reasonCode', 'invalid_claim');
  end if;

  select * into v_row
  from public.prop_performance_intelligence_calc c
  where c.user_id = p_user_id
    and c.scope_key = p_scope_key
  for update;

  if not found then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'job_not_found');
  end if;

  if v_row.assignment_revision is distinct from p_assignment_revision then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'stale_assignment_revision');
  end if;

  if v_row.state = 'running'
     and v_row.processing_started_at is not null then
    return jsonb_build_object(
      'kind', 'success',
      'alreadyRunning', true,
      'userId', v_row.user_id,
      'scopeKey', v_row.scope_key,
      'assignmentRevision', v_row.assignment_revision,
      'accountId', v_row.account_id,
      'scopeJson', v_row.scope_json
    );
  end if;

  if v_row.state not in ('queued', 'running') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'not_claimable', 'state', v_row.state);
  end if;

  update public.prop_performance_intelligence_calc
  set state = 'running',
      processing_started_at = now(),
      updated_at = now(),
      reason_code = null
  where user_id = p_user_id
    and scope_key = p_scope_key
  returning * into v_row;

  return jsonb_build_object(
    'kind', 'success',
    'alreadyRunning', false,
    'userId', v_row.user_id,
    'scopeKey', v_row.scope_key,
    'assignmentRevision', v_row.assignment_revision,
    'accountId', v_row.account_id,
    'scopeJson', v_row.scope_json
  );
end;
$$;

revoke all on function public.prop_os_cmd_claim_performance_intelligence(uuid, text, bigint)
  from public, anon, authenticated, prop_os_recalc_processor;
grant execute on function public.prop_os_cmd_claim_performance_intelligence(uuid, text, bigint)
  to postgres, service_role, prop_os_performance_intelligence_processor;

-- ---------------------------------------------------------------------------
-- Reaper: expire stalled queued/running jobs without publishing snapshots
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_reap_stalled_performance_intelligence()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  v_queue int := public.prop_os_pi_queue_timeout_seconds();
  v_proc int := public.prop_os_pi_processing_timeout_seconds();
  v_queued int := 0;
  v_running int := 0;
begin
  perform public.prop_os_assert_pi_processor();

  update public.prop_performance_intelligence_calc
  set state = 'failed',
      reason_code = 'queue_timeout',
      processing_started_at = null,
      updated_at = now()
  where state = 'queued'
    and requested_at < now() - make_interval(secs => v_queue);
  get diagnostics v_queued = row_count;

  update public.prop_performance_intelligence_calc
  set state = 'failed',
      reason_code = 'processor_timeout',
      processing_started_at = null,
      updated_at = now()
  where state = 'running'
    and processing_started_at is not null
    and processing_started_at < now() - make_interval(secs => v_proc);
  get diagnostics v_running = row_count;

  return jsonb_build_object(
    'kind', 'success',
    'reapedQueued', v_queued,
    'reapedRunning', v_running,
    'queueTimeoutSeconds', v_queue,
    'processingTimeoutSeconds', v_proc
  );
end;
$$;

revoke all on function public.prop_os_cmd_reap_stalled_performance_intelligence()
  from public, anon, authenticated, prop_os_recalc_processor;
grant execute on function public.prop_os_cmd_reap_stalled_performance_intelligence()
  to postgres, service_role, prop_os_performance_intelligence_processor;

-- Clear processing_started_at on terminal transitions via complete/fail wrappers:
-- complete/fail already overwrite state; add trigger to clear timestamp.

create or replace function public.prop_os_pi_calc_clear_processing_started()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  if new.state in ('completed', 'failed', 'queued')
     and (old.state is distinct from new.state or old.processing_started_at is not null) then
    if new.state in ('completed', 'failed') then
      new.processing_started_at := null;
    end if;
    if new.state = 'queued' then
      new.processing_started_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prop_pi_calc_clear_processing_started
  on public.prop_performance_intelligence_calc;
create trigger prop_pi_calc_clear_processing_started
  before update on public.prop_performance_intelligence_calc
  for each row
  execute function public.prop_os_pi_calc_clear_processing_started();
