-- Build 117 persistence/RLS verification. Run after migrations in local or staging.
-- The caller must set the two fixture UUIDs to authenticated users in that target.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Owner can only see owner rows; a direct insert is denied because all writes
-- remain behind the existing command/service boundary.
select count(*) from public.prop_daily_plan_snapshots;
do $$
begin
  begin
    insert into public.prop_live_risk_settings (user_id, account_id, payload)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '{}'::jsonb);
    raise exception 'expected authenticated direct write to be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
