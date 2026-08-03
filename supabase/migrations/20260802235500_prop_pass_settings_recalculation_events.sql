-- Build 117 — editable risk settings and manual session locks recalculate the
-- same canonical account runtime without masquerading as Journal trades.

alter table public.prop_processed_journal_events
  drop constraint if exists prop_processed_journal_events_event_type_check;
alter table public.prop_processed_journal_events
  add constraint prop_processed_journal_events_event_type_check
  check (event_type in (
    'trade_saved', 'trade_edited', 'trade_deleted', 'trade_assigned',
    'trade_unassigned', 'settings_changed'
  ));

create or replace function public.prop_os_processor_queue_settings_recalculation(
  p_user_id uuid,
  p_account_id uuid,
  p_challenge_id uuid,
  p_event_key text,
  p_input_digest text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.prop_accounts where id = p_account_id;
  if owner_id is null or owner_id is distinct from p_user_id then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if p_challenge_id is null or not exists (
    select 1 from public.prop_challenges
    where id = p_challenge_id and account_id = p_account_id and user_id = p_user_id
  ) then
    return jsonb_build_object('kind', 'invalid_input', 'reasonCode', 'active_challenge_required');
  end if;
  insert into public.prop_processed_journal_events (
    user_id, account_id, challenge_id, event_key, event_type,
    journal_trade_id, trade_client_id, trade_revision, calculation_version,
    prior_event_key, input_digest, processing_state
  ) values (
    p_user_id, p_account_id, p_challenge_id, p_event_key, 'settings_changed',
    null, concat('settings:', p_event_key),
    greatest(1, extract(epoch from clock_timestamp())::bigint),
    'build117.pipeline.v2', null, p_input_digest, 'pending'
  ) on conflict (user_id, event_key) do nothing;
  return jsonb_build_object('kind', 'success', 'eventKey', p_event_key);
end;
$$;

revoke all on function public.prop_os_processor_queue_settings_recalculation(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.prop_os_processor_queue_settings_recalculation(uuid, uuid, uuid, text, text)
  to postgres, service_role;

comment on function public.prop_os_processor_queue_settings_recalculation(uuid, uuid, uuid, text, text) is
  'Build 117 service-only settings event queue; user identity must already be JWT verified by the Edge boundary.';
