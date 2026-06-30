-- Harden security helper functions reported by Supabase Security Advisor.
-- Adds explicit search_path and removes direct client EXECUTE access from
-- SECURITY DEFINER helpers that are no longer intended to be public RPC APIs.

begin;

alter function public.security_validate_trade_journal()
  set search_path = public, pg_catalog;

alter function public.security_validate_upload_metadata()
  set search_path = public, pg_catalog;

alter function public.security_log_event(text, text, text, jsonb)
  set search_path = public, pg_catalog;

alter function public.security_consume_request_limit(text, integer, integer)
  set search_path = public, pg_catalog;

alter function public.security_claim_idempotency_key(text, text, text)
  set search_path = public, pg_catalog;

-- Trigger functions are invoked by table triggers only, never directly by app users.
revoke execute on function public.security_validate_trade_journal() from public, anon, authenticated;
revoke execute on function public.security_validate_upload_metadata() from public, anon, authenticated;

-- These SECURITY DEFINER helpers touch security tables. Keep them available to
-- backend/Edge Function service role flows but remove direct anon/authenticated RPC access.
revoke execute on function public.security_log_event(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.security_consume_request_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.security_claim_idempotency_key(text, text, text) from public, anon, authenticated;

grant execute on function public.security_log_event(text, text, text, jsonb) to service_role;
grant execute on function public.security_consume_request_limit(text, integer, integer) to service_role;
grant execute on function public.security_claim_idempotency_key(text, text, text) to service_role;

-- Preserve secure-upload Edge Function/service role rate limiting.
alter function public.security_consume_request_limit_for_actor(text, text, integer, integer)
  set search_path = public, pg_catalog;
revoke execute on function public.security_consume_request_limit_for_actor(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.security_consume_request_limit_for_actor(text, text, integer, integer) to service_role;

commit;
