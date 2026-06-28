-- Deny-by-default hardening for cached Market Intelligence tables.
-- Backend workers write with service_role. Mobile clients only read published rows.

alter table public.market_news_items enable row level security;
alter table public.market_daily_briefs enable row level security;
alter table public.market_watchlists enable row level security;
alter table public.market_summaries enable row level security;
alter table public.prop_firm_updates enable row level security;
alter table public.economic_events enable row level security;
alter table public.market_intel_runs enable row level security;

revoke all on public.market_news_items from anon, authenticated;
revoke all on public.market_daily_briefs from anon, authenticated;
revoke all on public.market_watchlists from anon, authenticated;
revoke all on public.market_summaries from anon, authenticated;
revoke all on public.prop_firm_updates from anon, authenticated;
revoke all on public.economic_events from anon, authenticated;
revoke all on public.market_intel_runs from anon, authenticated;

grant select on public.market_news_items to anon, authenticated;
grant select on public.market_daily_briefs to anon, authenticated;
grant select on public.market_watchlists to anon, authenticated;
grant select on public.market_summaries to anon, authenticated;
grant select on public.prop_firm_updates to anon, authenticated;
grant select on public.economic_events to anon, authenticated;
grant select on public.market_intel_runs to authenticated;

-- service_role bypasses RLS in Supabase, but explicit grants keep intent clear for reviewers.
grant select, insert, update, delete on public.market_news_items to service_role;
grant select, insert, update, delete on public.market_daily_briefs to service_role;
grant select, insert, update, delete on public.market_watchlists to service_role;
grant select, insert, update, delete on public.market_summaries to service_role;
grant select, insert, update, delete on public.prop_firm_updates to service_role;
grant select, insert, update, delete on public.economic_events to service_role;
grant select, insert, update, delete on public.market_intel_runs to service_role;
