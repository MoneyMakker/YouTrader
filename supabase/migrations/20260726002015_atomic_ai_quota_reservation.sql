-- Atomically reserve an AI quota slot before any provider request.
create or replace function public.security_reserve_ai_quota(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_start timestamptz,
  p_period_key text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  used_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action || ':' || p_window_start::text, 0));
  select count(*) into used_count
  from public.ai_usage_events
  where user_id = p_user_id and action = p_action and created_at >= p_window_start;
  if used_count >= greatest(1, least(p_limit, 1000)) then return false; end if;
  insert into public.ai_usage_events(user_id, action, period_key, provider, used_fallback, metadata)
  values (p_user_id, p_action, left(p_period_key, 120), 'reserved', false, '{"source":"quota_reservation"}'::jsonb);
  return true;
end;
$$;

revoke all on function public.security_reserve_ai_quota(uuid, text, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.security_reserve_ai_quota(uuid, text, integer, timestamptz, text) to service_role;

-- Rollback: revoke execute and drop function public.security_reserve_ai_quota(uuid, text, integer, timestamptz, text);
