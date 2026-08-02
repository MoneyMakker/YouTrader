-- Server-only Apple (and future provider) OAuth refresh tokens.
-- Clients must never read or write this table; Edge Functions use service_role.

create table if not exists public.auth_provider_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('apple')),
  refresh_token_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

comment on table public.auth_provider_tokens is
  'Server-only provider refresh tokens for account deletion revocation. No client RLS policies.';

alter table public.auth_provider_tokens enable row level security;

-- Explicitly deny client roles; service_role bypasses RLS.
revoke all on table public.auth_provider_tokens from public, anon, authenticated;
grant all on table public.auth_provider_tokens to service_role;

-- No policies for anon/authenticated → zero client access via Data API.
