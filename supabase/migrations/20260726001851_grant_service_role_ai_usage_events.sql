-- Forward-only least-privilege grant for trusted Edge Function quota checks.
-- RLS remains enabled and client grants/policies are intentionally unchanged.
grant select, insert on public.ai_usage_events to service_role;

-- Rollback (do not run automatically):
-- revoke select, insert on public.ai_usage_events from service_role;
