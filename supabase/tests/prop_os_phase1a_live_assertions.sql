-- Phase 1A live RLS / trigger / privilege assertions
-- Run against an applied isolated DB as superuser; switches roles for client checks.
-- Emits rows: assertion_id | result (PASS/FAIL) | detail

create temporary table prop_os_assertions (
  id text primary key,
  result text not null,
  detail text not null default ''
);
grant all on table prop_os_assertions to public;

create or replace function pg_temp.pass(aid text, detail text default '')
returns void language plpgsql as $$
begin
  insert into prop_os_assertions(id, result, detail) values (aid, 'PASS', detail)
  on conflict (id) do update set result='PASS', detail=excluded.detail;
end;
$$;

create or replace function pg_temp.fail(aid text, detail text)
returns void language plpgsql as $$
begin
  insert into prop_os_assertions(id, result, detail) values (aid, 'FAIL', detail)
  on conflict (id) do update set result='FAIL', detail=excluded.detail;
end;
$$;

create or replace function pg_temp.expect_fail(aid text, sql text)
returns void language plpgsql as $$
begin
  begin
    execute sql;
    perform pg_temp.fail(aid, 'expected error but succeeded');
  exception when others then
    perform pg_temp.pass(aid, sqlstate || ':' || left(sqlerrm, 120));
  end;
end;
$$;

-- Seed users / account via bypass roles
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com')
on conflict (id) do nothing;

insert into public.prop_accounts (
  id, user_id, firm_key, label, account_size_minor, currency, firm_timezone, status, source
) values (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'fixture-firm', 'A1', 5000000, 'USD', 'America/New_York', 'active', 'user_created'
) on conflict (id) do nothing;

insert into public.prop_challenges (
  id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor, started_at
) values (
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'evaluation', 'active', 'rs-test-v1', 5000000, now()
) on conflict (id) do nothing;

insert into public.prop_challenge_rule_snapshots (
  user_id, challenge_id, rule_set_version, snapshot, captured_at
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'rs-test-v1', '{"version":"rs-test-v1"}'::jsonb, now()
) on conflict (challenge_id) do nothing;

-- C12 FORCE RLS
do $$
declare missing int;
begin
  select count(*) into missing
  from unnest(array[
    'prop_accounts','prop_challenges','prop_challenge_rule_snapshots','prop_trade_assignments',
    'prop_executions','prop_account_events','prop_challenge_transitions','prop_engine_snapshots',
    'prop_score_snapshots','prop_violation_records','prop_data_quality_flags','prop_correction_events'
  ]) t(name)
  left join pg_class c on c.relname = t.name
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname='public'
  where c.oid is null or not c.relrowsecurity or not c.relforcerowsecurity;
  if missing = 0 then
    perform pg_temp.pass('C12_force_rls', '12/12');
  else
    perform pg_temp.fail('C12_force_rls', 'missing_or_unforced=' || missing);
  end if;
end $$;

-- C13 privilege matrix: no grants to anon/authenticated on Prop OS foundation tables
do $$
declare bad int;
begin
  select count(*) into bad
  from information_schema.role_table_grants g
  where g.table_schema='public'
    and g.table_name in (
      'prop_accounts','prop_challenges','prop_challenge_rule_snapshots','prop_trade_assignments',
      'prop_executions','prop_account_events','prop_challenge_transitions','prop_engine_snapshots',
      'prop_score_snapshots','prop_violation_records','prop_data_quality_flags','prop_correction_events'
    )
    and g.grantee in ('anon','authenticated','PUBLIC');
  if bad = 0 then
    perform pg_temp.pass('C13_no_client_grants', 'ok');
  else
    perform pg_temp.fail('C13_no_client_grants', 'grant_rows=' || bad);
  end if;
end $$;

-- C1 anon denied
set role anon;
select pg_temp.expect_fail('C1_anon_select', 'select count(*) from public.prop_accounts');
select pg_temp.expect_fail('C1_anon_insert', $$insert into public.prop_accounts(user_id,label,account_size_minor,firm_timezone,status,source)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','x',1,'UTC','active','user_created')$$);
reset role;

-- C2 authenticated denied (no grants + RLS)
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select pg_temp.expect_fail('C2_auth_select', 'select count(*) from public.prop_accounts');
select pg_temp.expect_fail('C2_auth_insert_account', $$insert into public.prop_accounts(user_id,label,account_size_minor,firm_timezone,status,source)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','x',1,'UTC','active','user_created')$$);
select pg_temp.expect_fail('C5_auth_engine_insert', $$insert into public.prop_engine_snapshots(
  user_id, challenge_id, calculation_version, rule_set_version, input_revision, calculated_at, status, payload, confidence, confidence_policy_version
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','calc-spec-v0','rs','rev',now(),'active','{}'::jsonb,'{}'::jsonb,'confidence-policy-v0'
)$$);
select pg_temp.expect_fail('C5_auth_score_insert', $$insert into public.prop_score_snapshots(
  user_id, challenge_id, calculation_version, rule_set_version, input_revision, calculated_at, status, payload, confidence, confidence_policy_version
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','calc-spec-v0','rs','rev',now(),'active','{}'::jsonb,'{}'::jsonb,'confidence-policy-v0'
)$$);
reset role;

-- C4 / C15 service_role permitted writes (BYPASSRLS)
set role service_role;
do $$
begin
  insert into public.prop_executions(id,user_id,challenge_id,account_id,occurred_at,realized_pnl_minor,source)
  values ('exec-live-1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',now(),100,'test')
  on conflict (user_id, id) do nothing;
  perform pg_temp.pass('C4_service_role_write', 'execution inserted');
exception when others then
  perform pg_temp.fail('C4_service_role_write', sqlerrm);
end $$;
reset role;

-- C3 / C11 cross-user challenge owner mismatch
select pg_temp.expect_fail('C3_cross_user_challenge', $$insert into public.prop_challenges(
  id,user_id,account_id,phase,status,rule_set_version,starting_balance_minor,started_at
) values (
  '33333333-3333-3333-3333-333333333333','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111','evaluation','active','rs',5000000,now()
)$$);

select pg_temp.expect_fail('C11_cross_user_assignment', $$insert into public.prop_trade_assignments(
  user_id, trade_client_id, account_id, challenge_id, assignment_state, assigned_by, provenance
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','t1','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','manual','user','{}'::jsonb
)$$);

-- C6 rule snapshot immutable
select pg_temp.expect_fail('C6_rule_snapshot_update', $$update public.prop_challenge_rule_snapshots set snapshot='{"x":1}'::jsonb$$);
select pg_temp.expect_fail('C6_rule_snapshot_delete', $$delete from public.prop_challenge_rule_snapshots$$);

-- C7 transitions append-only
insert into public.prop_challenge_transitions(user_id,challenge_id,from_status,to_status,reason_code,actor,at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','active','at_risk','test','test',now());
select pg_temp.expect_fail('C7_transition_update', $$update public.prop_challenge_transitions set reason_code='x'$$);
select pg_temp.expect_fail('C7_transition_delete', $$delete from public.prop_challenge_transitions$$);

-- C8 corrections append-only
insert into public.prop_correction_events(user_id,kind,payload,reason,at,actor)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','void_trade','{"source_event_id":"exec-live-1"}'::jsonb,'void',now(),'test');
select pg_temp.expect_fail('C8_correction_update', $$update public.prop_correction_events set reason='x'$$);
select pg_temp.expect_fail('C8_correction_delete', $$delete from public.prop_correction_events$$);

-- C9 void preserves row
update public.prop_executions set voided=true where id='exec-live-1';
do $$
declare n int;
begin
  select count(*) into n from public.prop_executions where id='exec-live-1' and voided=true;
  if n=1 then perform pg_temp.pass('C9_void_preserves_row','ok');
  else perform pg_temp.fail('C9_void_preserves_row','count='||n); end if;
end $$;
select pg_temp.expect_fail('E_execution_delete', $$delete from public.prop_executions where id='exec-live-1'$$);

-- C10 violation clear preserves record
insert into public.prop_violation_records(user_id,challenge_id,code,at,severity)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','daily_loss',now(),'hard');
update public.prop_violation_records
set cleared_by_event_id='corr-1'
where challenge_id='22222222-2222-2222-2222-222222222222' and code='daily_loss';
do $$
declare n int;
begin
  select count(*) into n from public.prop_violation_records where code='daily_loss' and cleared_by_event_id='corr-1';
  if n>=1 then perform pg_temp.pass('C10_violation_clear_preserves','ok');
  else perform pg_temp.fail('C10_violation_clear_preserves','missing'); end if;
end $$;
select pg_temp.expect_fail('E_violation_delete', $$delete from public.prop_violation_records where code='daily_loss'$$);

-- E immutable challenge history fields
select pg_temp.expect_fail('E_challenge_history_overwrite', $$update public.prop_challenges set rule_set_version='tampered' where id='22222222-2222-2222-2222-222222222222'$$);
select pg_temp.expect_fail('E_challenge_delete', $$delete from public.prop_challenges where id='22222222-2222-2222-2222-222222222222'$$);

-- Allowed append: status update that doesn't touch historical fields
do $$
begin
  update public.prop_challenges set status='at_risk', updated_at=now()
  where id='22222222-2222-2222-2222-222222222222';
  perform pg_temp.pass('E_challenge_status_update_allowed','ok');
exception when others then
  perform pg_temp.fail('E_challenge_status_update_allowed', sqlerrm);
end $$;

-- Duplicate assignment uniqueness
insert into public.prop_trade_assignments(user_id,trade_client_id,assignment_state,provenance)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','dup-1','unassigned','{}'::jsonb)
on conflict (user_id, trade_client_id) do nothing;
select pg_temp.expect_fail('E_duplicate_assignment', $$insert into public.prop_trade_assignments(user_id,trade_client_id,assignment_state,provenance)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','dup-1','unassigned','{}'::jsonb)$$);

-- Engine snapshot mutation forbidden
insert into public.prop_engine_snapshots(
  user_id, challenge_id, calculation_version, rule_set_version, input_revision, calculated_at, status, payload, confidence, confidence_policy_version
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','calc-spec-v0','rs-test-v1','rev:1',now(),'active','{}'::jsonb,'{}'::jsonb,'confidence-policy-v0'
);
select pg_temp.expect_fail('E_engine_snapshot_update', $$update public.prop_engine_snapshots set status='x'$$);
select pg_temp.expect_fail('E_engine_snapshot_delete', $$delete from public.prop_engine_snapshots$$);

-- Function security matrix rows
create temporary table prop_os_fn_audit as
select
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
  coalesce(p.proconfig::text, '{}') as config,
  (
    select coalesce(string_agg(grantee, ','), '')
    from information_schema.routine_privileges rp
    where rp.specific_schema='public' and rp.routine_name=p.proname and rp.privilege_type='EXECUTE'
  ) as execute_grantees
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'prop_os_%'
order by 1;

do $$
declare r record; bad int := 0;
begin
  for r in select * from prop_os_fn_audit loop
    if r.security <> 'SECURITY INVOKER' then bad := bad + 1; end if;
    if position('search_path' in lower(r.config)) = 0 then bad := bad + 1; end if;
    if position('anon' in lower(r.execute_grantees)) > 0 or position('authenticated' in lower(r.execute_grantees)) > 0 then
      bad := bad + 1;
    end if;
  end loop;
  if bad = 0 then perform pg_temp.pass('D_function_security','all invoker+search_path+no_client_execute');
  else perform pg_temp.fail('D_function_security','issues='||bad); end if;
end $$;

-- C14: authenticated cannot execute helpers
set role authenticated;
select pg_temp.expect_fail('C14_auth_exec_forbid_mutation', $$select public.prop_os_forbid_mutation()$$);
reset role;

select id, result, detail from prop_os_assertions order by id;
select count(*) filter (where result='PASS') as passed,
       count(*) filter (where result='FAIL') as failed,
       count(*) as total
from prop_os_assertions;
select * from prop_os_fn_audit;
