-- Build 117 — trusted Journal runtime processing queue.
-- New assignment events remain pending until the server calculation succeeds.
-- The authenticated app may wake the Edge worker, but cannot claim, complete,
-- fail, or write a runtime state directly.

alter table public.prop_processed_journal_events
  drop constraint if exists prop_processed_journal_events_processing_state_check;
alter table public.prop_processed_journal_events
  add constraint prop_processed_journal_events_processing_state_check
  check (processing_state in ('pending', 'processing', 'applied', 'superseded', 'failed'));

create or replace function public.prop_os_processor_claim_pending_journal_events(
  p_user_id uuid,
  p_limit integer default 4
)
returns setof public.prop_processed_journal_events
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null or p_limit < 1 or p_limit > 20 then
    raise exception 'invalid Prop Pass queue claim' using errcode = '22023';
  end if;
  return query
  with candidates as (
    select e.id
    from public.prop_processed_journal_events e
    where e.user_id = p_user_id
      and e.processing_state in ('pending', 'failed')
    order by e.created_at, e.id
    for update skip locked
    limit p_limit
  )
  update public.prop_processed_journal_events e
  set processing_state = 'processing', updated_at = now()
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.prop_os_processor_claim_pending_journal_events(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.prop_os_processor_claim_pending_journal_events(uuid, integer)
  to postgres, service_role;

create or replace function public.prop_pass_assignment_ledger_after_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare event_type_value text;
declare event_key_value text;
begin
  if new.account_id is null or new.journal_trade_id is null then return new; end if;
  event_type_value := case when new.state = 'assigned' then 'trade_assigned' else 'trade_unassigned' end;
  event_key_value := concat_ws(':', new.account_id::text, new.trade_client_id, new.assignment_revision::text, event_type_value);
  insert into public.prop_processed_journal_events (
    user_id, account_id, challenge_id, event_key, event_type,
    journal_trade_id, trade_client_id, trade_revision, calculation_version,
    prior_event_key, input_digest, processing_state, applied_at
  ) values (
    new.user_id, new.account_id, new.challenge_id, event_key_value, event_type_value,
    new.journal_trade_id, new.trade_client_id, greatest(1, new.assignment_revision),
    'build117.pipeline.v2', null,
    md5(jsonb_build_object('assignmentEventId', new.id, 'state', new.state, 'revision', new.assignment_revision)::text),
    'pending', null
  ) on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;

revoke all on function public.prop_pass_assignment_ledger_after_insert()
  from public, anon, authenticated;
grant execute on function public.prop_pass_assignment_ledger_after_insert()
  to postgres, service_role;

-- Build 117 rows created by the previous trigger have no result digest. Queue
-- only those without any account runtime state; completed history is untouched.
update public.prop_processed_journal_events e
set processing_state = 'pending', applied_at = null, updated_at = now()
where e.event_type in ('trade_assigned', 'trade_unassigned')
  and e.processing_state = 'applied'
  and e.result_digest is null
  and not exists (
    select 1 from public.prop_account_runtime_states r
    where r.user_id = e.user_id and r.account_id = e.account_id
  );

comment on function public.prop_os_processor_claim_pending_journal_events(uuid, integer) is
  'Build 117 service-only SKIP LOCKED claim for authenticated-user-scoped runtime work.';
