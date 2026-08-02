-- Build 117 — automatic Journal -> Prop Pass synchronization.
-- Material edits are versioned. The previous execution is voided exactly once,
-- the replacement is appended, and the affected account is queued to rebuild.

alter table public.trade_journal
  add column if not exists prop_pass_revision bigint not null default 1
  check (prop_pass_revision > 0);

create or replace function public.prop_pass_journal_material_changed(
  p_old public.trade_journal,
  p_new public.trade_journal
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog, public
as $$
  select row(
    p_old.trade_date, p_old.symbol, p_old.direction, p_old.entry_time,
    p_old.exit_time, p_old.contracts, p_old.entry, p_old.exit,
    p_old.stop_loss, p_old.take_profit, p_old.pnl, p_old.deleted_at
  ) is distinct from row(
    p_new.trade_date, p_new.symbol, p_new.direction, p_new.entry_time,
    p_new.exit_time, p_new.contracts, p_new.entry, p_new.exit,
    p_new.stop_loss, p_new.take_profit, p_new.pnl, p_new.deleted_at
  );
$$;

revoke all on function public.prop_pass_journal_material_changed(public.trade_journal, public.trade_journal)
  from public, anon, authenticated;
grant execute on function public.prop_pass_journal_material_changed(public.trade_journal, public.trade_journal)
  to postgres, service_role;

create or replace function public.prop_pass_journal_set_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.prop_pass_journal_material_changed(old, new) then
    new.prop_pass_revision := old.prop_pass_revision + 1;
  else
    new.prop_pass_revision := old.prop_pass_revision;
  end if;
  return new;
end;
$$;

revoke all on function public.prop_pass_journal_set_revision() from public, anon, authenticated;
grant execute on function public.prop_pass_journal_set_revision() to postgres, service_role;

drop trigger if exists prop_pass_journal_set_revision_before_update on public.trade_journal;
create trigger prop_pass_journal_set_revision_before_update
  before update on public.trade_journal
  for each row execute function public.prop_pass_journal_set_revision();

create or replace function public.prop_pass_journal_sync_after_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assignment public.prop_trade_assignments%rowtype;
  event_type_value text;
  event_key_value text;
  prior_event_key_value text;
  prior_execution_id text;
  execution_id_value text;
  occurred_at_value timestamptz;
  global_revision bigint;
  input_digest_value text;
begin
  if new.prop_pass_revision = old.prop_pass_revision then return new; end if;

  select * into assignment from public.prop_trade_assignments a
    where a.user_id = new.user_id and a.trade_client_id = new.client_id
      and a.account_id is not null
      and a.assignment_state in ('manual', 'verified_import')
    limit 1;
  if not found then return new; end if;

  event_type_value := case when new.deleted_at is not null then 'trade_deleted' else 'trade_edited' end;
  event_key_value := concat_ws(':', assignment.account_id::text, new.client_id, new.prop_pass_revision::text, event_type_value);
  select event_key into prior_event_key_value from public.prop_processed_journal_events
    where user_id = new.user_id and account_id = assignment.account_id
      and trade_client_id = new.client_id
    order by trade_revision desc, created_at desc limit 1;

  input_digest_value := md5(jsonb_build_object(
    'tradeId', new.id, 'clientId', new.client_id, 'revision', new.prop_pass_revision,
    'date', new.trade_date, 'symbol', new.symbol, 'direction', new.direction,
    'entryTime', new.entry_time, 'exitTime', new.exit_time,
    'contracts', new.contracts, 'entry', new.entry, 'exit', new.exit,
    'stopLoss', new.stop_loss, 'takeProfit', new.take_profit,
    'pnl', new.pnl, 'deletedAt', new.deleted_at
  )::text);

  insert into public.prop_processed_journal_events (
    user_id, account_id, challenge_id, event_key, event_type,
    journal_trade_id, trade_client_id, trade_revision, calculation_version,
    prior_event_key, input_digest
  ) values (
    new.user_id, assignment.account_id, assignment.challenge_id,
    event_key_value, event_type_value, new.id, new.client_id,
    new.prop_pass_revision, 'build117.pipeline.v1', prior_event_key_value,
    input_digest_value
  ) on conflict (user_id, event_key) do nothing;

  select id into prior_execution_id from public.prop_executions
    where user_id = new.user_id and challenge_id is not distinct from assignment.challenge_id
      and trade_client_id = new.client_id and voided is false
    order by occurred_at desc, created_at desc, id desc limit 1;
  update public.prop_executions set voided = true
    where user_id = new.user_id and challenge_id is not distinct from assignment.challenge_id
      and trade_client_id = new.client_id and voided is false;

  if new.deleted_at is null then
    begin
      occurred_at_value := coalesce(
        nullif(btrim(new.exit_time), '')::timestamptz,
        nullif(btrim(new.entry_time), '')::timestamptz,
        new.trade_date::timestamptz
      );
    exception when others then
      occurred_at_value := new.trade_date::timestamptz;
    end;
    execution_id_value := concat('journal:', coalesce(assignment.challenge_id::text, assignment.account_id::text), ':', new.client_id, ':', new.prop_pass_revision);
    insert into public.prop_executions (
      id, user_id, challenge_id, account_id, trade_client_id, occurred_at,
      realized_pnl_minor, fees_minor, contracts, voided, corrects_event_id,
      source, schema_version
    ) values (
      execution_id_value, new.user_id, assignment.challenge_id, assignment.account_id,
      new.client_id, occurred_at_value, round(new.pnl * 100)::bigint, 0,
      new.contracts, false, prior_execution_id, 'journal_sync', 'prop-os-schema-v0'
    ) on conflict (user_id, id) do nothing;
  end if;

  global_revision := public.prop_os_assignment_bump_revision(new.user_id);
  if assignment.challenge_id is not null then
    perform public.prop_os_assignment_queue_recalc(new.user_id, assignment.challenge_id, global_revision);
  end if;
  return new;
end;
$$;

revoke all on function public.prop_pass_journal_sync_after_update() from public, anon, authenticated;
grant execute on function public.prop_pass_journal_sync_after_update() to postgres, service_role;

drop trigger if exists prop_pass_journal_sync_after_update on public.trade_journal;
create trigger prop_pass_journal_sync_after_update
  after update on public.trade_journal
  for each row execute function public.prop_pass_journal_sync_after_update();

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
    'build117.pipeline.v1', null,
    md5(jsonb_build_object('assignmentEventId', new.id, 'state', new.state, 'revision', new.assignment_revision)::text),
    'applied', now()
  ) on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;

revoke all on function public.prop_pass_assignment_ledger_after_insert() from public, anon, authenticated;
grant execute on function public.prop_pass_assignment_ledger_after_insert() to postgres, service_role;

drop trigger if exists prop_pass_assignment_ledger_after_insert on public.prop_trade_assignment_events;
create trigger prop_pass_assignment_ledger_after_insert
  after insert on public.prop_trade_assignment_events
  for each row execute function public.prop_pass_assignment_ledger_after_insert();

create index if not exists trade_journal_user_prop_pass_revision_idx
  on public.trade_journal (user_id, client_id, prop_pass_revision desc);
