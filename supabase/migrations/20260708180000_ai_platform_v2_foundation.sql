-- AI Platform V2 foundation (Phases 3–5)
-- APPLY ONLY AFTER CEO APPROVAL — not required for Phase 1 router deployment.
-- Phase 1 uses ai_usage_events.metadata jsonb for router analytics.

-- Prompt version registry
create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  version text not null,
  description text not null default '',
  author text not null default '',
  expected_outcome text not null default '',
  system_template text not null,
  schema_hint text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (family, version)
);

-- A/B experiments (Phase 5)
create table if not exists public.ai_prompt_experiments (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed')),
  variant_a_version text not null,
  variant_b_version text not null,
  traffic_split_a integer not null default 50 check (traffic_split_a between 0 and 100),
  started_at timestamptz,
  ended_at timestamptz,
  winner_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Detailed platform request log (Phase 4 cost dashboard)
create table if not exists public.ai_platform_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null,
  provider text not null,
  model_id text not null,
  model_ref text,
  profile text,
  prompt_version text,
  success boolean not null default true,
  used_fallback boolean not null default false,
  fallback_reason text,
  cache_hit boolean not null default false,
  latency_ms integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_platform_requests_created_idx
  on public.ai_platform_requests(created_at desc);

create index if not exists ai_platform_requests_endpoint_created_idx
  on public.ai_platform_requests(endpoint, created_at desc);

create index if not exists ai_platform_requests_user_created_idx
  on public.ai_platform_requests(user_id, created_at desc);

-- Response cache (Phase 8 — optional persistent cache)
create table if not exists public.ai_response_cache (
  cache_key text primary key,
  endpoint text not null,
  prompt_version text not null,
  provider text not null,
  model_ref text not null,
  response_json jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_response_cache_expires_idx
  on public.ai_response_cache(expires_at);

alter table public.ai_prompt_versions enable row level security;
alter table public.ai_prompt_experiments enable row level security;
alter table public.ai_platform_requests enable row level security;
alter table public.ai_response_cache enable row level security;

-- Deny all client access; service role only via Edge Functions
revoke all on public.ai_prompt_versions from anon, authenticated;
revoke all on public.ai_prompt_experiments from anon, authenticated;
revoke all on public.ai_platform_requests from anon, authenticated;
revoke all on public.ai_response_cache from anon, authenticated;
