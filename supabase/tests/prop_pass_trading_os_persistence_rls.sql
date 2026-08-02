-- Build 117 persistence/RLS verification. Run after migrations in local or staging.
-- It creates synthetic fixtures inside this transaction and rolls them back.
begin;

create extension if not exists pgcrypto;
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'prop-os-a@example.invalid', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'prop-os-b@example.invalid', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000');

insert into public.prop_accounts (id, user_id, label, account_size_minor, currency, firm_timezone, status, source)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLS A', 5000000, 'USD', 'America/New_York', 'active', 'user_created'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'RLS B', 5000000, 'USD', 'America/New_York', 'active', 'user_created');

insert into public.prop_daily_plan_snapshots (user_id, account_id, trading_day, plan_key, generated_at, payload)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', current_date, 'rls-a-plan', now(), '{}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', current_date, 'rls-b-plan', now(), '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Owner can only see its own row; direct writes and provider-token reads are
-- denied because they remain behind the service/command boundary.
do $$
declare n integer;
begin
  select count(*) into n from public.prop_daily_plan_snapshots;
  if n <> 1 then raise exception 'expected exactly one owner-visible plan, got %', n; end if;
  begin
    insert into public.prop_live_risk_settings (user_id, account_id, payload)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '{}'::jsonb);
    raise exception 'expected authenticated direct write to be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.auth_provider_tokens;
    raise exception 'expected provider-token reads to be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
