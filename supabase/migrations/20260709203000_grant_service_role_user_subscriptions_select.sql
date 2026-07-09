-- Server-side Pro entitlement checks (ai-coach, market-intelligence).
-- Edge Functions authenticate the user JWT, then use service_role to read
-- user_subscriptions for that user_id. Postgres requires an explicit GRANT;
-- RLS bypass alone does not imply table-level SELECT on Supabase/PostgREST.

grant select on public.user_subscriptions to service_role;
