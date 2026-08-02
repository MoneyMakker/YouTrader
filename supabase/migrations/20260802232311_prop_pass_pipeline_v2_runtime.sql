-- Build 117 pipeline v2 adds deterministic compliance, survival, breach,
-- payout-planner and What-If outputs. Historical v1 rows remain immutable.
-- New Journal ledger facts are stamped v2 even while the existing, already
-- deployed Journal trigger retains its original v1 literal.

create or replace function public.prop_pass_stamp_current_calculation_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.calculation_version = 'build117.pipeline.v1' then
    new.calculation_version := 'build117.pipeline.v2';
  elsif new.calculation_version <> 'build117.pipeline.v2' then
    raise exception 'unsupported Prop Pass calculation version'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.prop_pass_stamp_current_calculation_version()
  from public, anon, authenticated;
grant execute on function public.prop_pass_stamp_current_calculation_version()
  to postgres, service_role;

drop trigger if exists prop_pass_stamp_current_calculation_version
  on public.prop_processed_journal_events;
create trigger prop_pass_stamp_current_calculation_version
  before insert on public.prop_processed_journal_events
  for each row execute function public.prop_pass_stamp_current_calculation_version();

comment on function public.prop_pass_stamp_current_calculation_version() is
  'Build 117 service-only ledger version stamp; preserves historical v1 rows and stamps new work v2.';
