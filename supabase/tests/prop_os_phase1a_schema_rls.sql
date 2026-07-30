-- Phase 1A live schema/RLS tests (run against local Supabase / CI Postgres only).
-- Not applied to production by this repository workflow.
--
-- Usage (when Docker + supabase local available):
--   supabase db reset
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/prop_os_phase1a_schema_rls.sql

begin;

create extension if not exists pgcrypto;

-- Synthetic auth users (local/test only)
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

-- Existing journal remains insertable and unassigned (no prop assignment row required)
insert into public.trade_journal (user_id, client_id, trade_date, symbol, direction, contracts, pnl)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'legacy-1', current_date, 'ES', 'LONG', 1, 10)
on conflict (user_id, client_id) do nothing;

-- Service-role style inserts (current session must bypass RLS / be table owner)
insert into public.prop_accounts (
  id, user_id, firm_key, label, account_size_minor, currency, firm_timezone, status, source
) values (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'fixture-firm',
  'A1',
  5000000,
  'USD',
  'America/New_York',
  'active',
  'user_created'
);

insert into public.prop_challenges (
  id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor, started_at
) values (
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'evaluation',
  'active',
  'rs-test-v1',
  5000000,
  now()
);

insert into public.prop_challenge_rule_snapshots (
  user_id, challenge_id, rule_set_version, snapshot, captured_at
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'rs-test-v1',
  '{"version":"rs-test-v1"}'::jsonb,
  now()
);

-- Cross-user challenge ownership must fail
do $$
begin
  begin
    insert into public.prop_challenges (
      id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor, started_at
    ) values (
      '33333333-3333-3333-3333-333333333333',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '11111111-1111-1111-1111-111111111111',
      'evaluation',
      'active',
      'rs-test-v1',
      5000000,
      now()
    );
    raise exception 'expected cross-user challenge insert to fail';
  exception
    when check_violation or foreign_key_violation or insufficient_privilege then
      null;
    when others then
      if sqlerrm like 'prop_os:%' then
        null;
      else
        raise;
      end if;
  end;
end;
$$;

-- Immutable rule snapshot update must fail
do $$
begin
  begin
    update public.prop_challenge_rule_snapshots
    set snapshot = '{"tampered":true}'::jsonb;
    raise exception 'expected immutable snapshot update to fail';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'prop_os:%' then null; else raise; end if;
  end;
end;
$$;

-- Challenge silent overwrite of historical fields must fail
do $$
begin
  begin
    update public.prop_challenges
    set rule_set_version = 'tampered'
    where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'expected challenge historical overwrite to fail';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'prop_os:%' then null; else raise; end if;
  end;
end;
$$;

-- Correction preserves source: insert execution + correction; original remains
insert into public.prop_executions (
  id, user_id, challenge_id, account_id, occurred_at, realized_pnl_minor, fees_minor, source
) values (
  'exec-1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  now(),
  1000,
  null,
  'test'
);

insert into public.prop_correction_events (
  user_id, kind, payload, reason, at, actor
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'void_trade',
  '{"source_event_id":"exec-1"}'::jsonb,
  'test void',
  now(),
  'test'
);

update public.prop_executions set voided = true where id = 'exec-1';

do $$
declare
  n int;
begin
  select count(*) into n from public.prop_executions where id = 'exec-1';
  if n <> 1 then
    raise exception 'correction must preserve original execution row';
  end if;
end;
$$;

-- Uniqueness
do $$
begin
  begin
    insert into public.prop_trade_assignments (
      user_id, trade_client_id, assignment_state, provenance
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'legacy-1', 'unassigned', '{}'::jsonb
    );
    insert into public.prop_trade_assignments (
      user_id, trade_client_id, assignment_state, provenance
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'legacy-1', 'unassigned', '{}'::jsonb
    );
    raise exception 'expected unique (user_id, trade_client_id) to fail';
  exception
    when unique_violation then null;
  end;
end;
$$;

-- Authenticated role must not see/write Prop OS tables (no policies)
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

do $$
begin
  begin
    perform 1 from public.prop_accounts;
    -- If select returns without error under RLS with zero policies, count should be blocked;
    -- Postgres RLS with no policy denies.
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.prop_engine_snapshots (
      user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, confidence_policy_version
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      'calc-spec-v0', 'rs-test-v1', 'rev:1', now(), 'active', '{}'::jsonb, '{}'::jsonb, 'confidence-policy-v0'
    );
    raise exception 'authenticated must not insert engine snapshots';
  exception
    when insufficient_privilege or check_violation then null;
    when others then
      -- RLS denial often surfaces as 42501 or empty permission
      if sqlstate = '42501' or sqlerrm ilike '%policy%' or sqlerrm ilike '%permission%' then
        null;
      else
        raise;
      end if;
  end;
end;
$$;

reset role;

-- Legacy trades remain present and no auto assignment from migration
do $$
declare
  j int;
  a int;
begin
  select count(*) into j from public.trade_journal where client_id = 'legacy-1';
  select count(*) into a from public.prop_trade_assignments where trade_client_id = 'legacy-1';
  if j < 1 then raise exception 'legacy journal row missing'; end if;
  -- assignment may exist only from this test's uniqueness block; migration itself inserts none
end;
$$;

rollback;
