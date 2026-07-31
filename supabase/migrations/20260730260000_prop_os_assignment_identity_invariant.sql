-- Phase 2C final remediation — canonical assignment identity invariant.
-- PREPARE ONLY. Do NOT apply to production without Ops approval.
--
-- Contract:
--   Canonical PK = trade_journal.id (journal_trade_id)
--   Provenance alias = trade_journal.client_id (trade_client_id)
--   Persisted pair (user_id, journal_trade_id, trade_client_id) MUST reference
--   one journal row — enforced by composite FK, not application checks alone.

-- Bind id + client_id under the same owner so assignment events cannot mix Trade A/B.
create unique index if not exists trade_journal_user_id_client_triplet_uidx
  on public.trade_journal (user_id, id, client_id);

-- Backfill any missing journal_trade_id from the matching owner/client alias.
update public.prop_trade_assignment_events as e
set journal_trade_id = j.id
from public.trade_journal as j
where e.journal_trade_id is null
  and j.user_id = e.user_id
  and j.client_id = e.trade_client_id;

-- Reject orphan / mismatched pairs before adding the triplet FK.
do $$
declare
  bad int;
begin
  select count(*) into bad
  from public.prop_trade_assignment_events as e
  where e.journal_trade_id is null
     or not exists (
       select 1
       from public.trade_journal as j
       where j.user_id = e.user_id
         and j.id = e.journal_trade_id
         and j.client_id = e.trade_client_id
     );
  if bad > 0 then
    raise exception
      'prop_os: cannot enforce identity triplet — % mismatched assignment event(s)',
      bad;
  end if;
end
$$;

alter table public.prop_trade_assignment_events
  alter column journal_trade_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prop_trade_assignment_events_identity_triplet_fk'
  ) then
    alter table public.prop_trade_assignment_events
      add constraint prop_trade_assignment_events_identity_triplet_fk
      foreign key (user_id, journal_trade_id, trade_client_id)
      references public.trade_journal (user_id, id, client_id)
      on delete restrict;
  end if;
end
$$;

comment on constraint prop_trade_assignment_events_identity_triplet_fk
  on public.prop_trade_assignment_events is
  'journal_trade_id and trade_client_id must identify the same trade_journal row for the owner.';

-- Helper used by QA / processor to prove mismatch rejection without App EXECUTE.
create or replace function public.prop_os_assignment_assert_identity_pair(
  p_user_id uuid,
  p_journal_trade_id uuid,
  p_trade_client_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
begin
  return exists (
    select 1
    from public.trade_journal as j
    where j.user_id = p_user_id
      and j.id = p_journal_trade_id
      and j.client_id = p_trade_client_id
      and j.deleted_at is null
  );
end;
$$;

revoke all on function public.prop_os_assignment_assert_identity_pair(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.prop_os_assignment_assert_identity_pair(uuid, uuid, text)
  to postgres, service_role, prop_os_recalc_processor;
