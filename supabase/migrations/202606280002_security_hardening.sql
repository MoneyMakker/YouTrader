create extension if not exists pgcrypto;

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  action text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (user_id, idempotency_key)
);

create table if not exists public.request_limits (
  id uuid primary key default gen_random_uuid(),
  actor_hash text not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_hash, action, window_start)
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_hash text,
  event_type text not null,
  action text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idempotency_keys_user_action_idx on public.idempotency_keys(user_id, action, created_at desc);
create index if not exists request_limits_actor_action_idx on public.request_limits(actor_hash, action, window_start desc);
create index if not exists security_events_user_created_idx on public.security_events(user_id, created_at desc);
create index if not exists security_events_type_created_idx on public.security_events(event_type, created_at desc);

alter table public.idempotency_keys enable row level security;
alter table public.request_limits enable row level security;
alter table public.security_events enable row level security;

drop policy if exists "Users can read own idempotency keys" on public.idempotency_keys;
create policy "Users can read own idempotency keys"
on public.idempotency_keys for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own idempotency keys" on public.idempotency_keys;
create policy "Users can create own idempotency keys"
on public.idempotency_keys for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own idempotency keys" on public.idempotency_keys;
create policy "Users can update own idempotency keys"
on public.idempotency_keys for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can create own security events" on public.security_events;
create policy "Users can create own security events"
on public.security_events for insert
to authenticated
with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "Users can read own security events" on public.security_events;
create policy "Users can read own security events"
on public.security_events for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.request_limits from anon, authenticated;
grant select, insert, update on public.idempotency_keys to authenticated;
grant select, insert on public.security_events to authenticated;

create or replace function public.security_log_event(
  event_type text,
  action text,
  severity text default 'info',
  metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.security_events(user_id, actor_hash, event_type, action, severity, metadata)
  values (
    auth.uid(),
    encode(digest(coalesce(auth.uid()::text, 'anonymous'), 'sha256'), 'hex'),
    left(event_type, 80),
    left(action, 80),
    case when severity in ('info', 'warning', 'critical') then severity else 'info' end,
    coalesce(metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.security_consume_request_limit(
  action text,
  max_requests integer,
  window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_action text := left(coalesce(action, 'unknown'), 80);
  safe_max integer := greatest(1, least(coalesce(max_requests, 10), 10000));
  safe_window integer := greatest(10, least(coalesce(window_seconds, 60), 86400));
  actor text := encode(digest(coalesce(auth.uid()::text, 'anonymous'), 'sha256'), 'hex');
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / safe_window) * safe_window);
  next_count integer;
begin
  insert into public.request_limits(actor_hash, action, window_start, count)
  values (actor, safe_action, current_window, 1)
  on conflict (actor_hash, action, window_start)
  do update set count = public.request_limits.count + 1, updated_at = now()
  returning count into next_count;

  if next_count > safe_max then
    insert into public.security_events(user_id, actor_hash, event_type, action, severity, metadata)
    values (auth.uid(), actor, 'rate_limit_exceeded', safe_action, 'warning', jsonb_build_object('limit', safe_max, 'window_seconds', safe_window));
    return jsonb_build_object('allowed', false, 'count', next_count, 'limit', safe_max, 'retry_after_seconds', safe_window);
  end if;

  return jsonb_build_object('allowed', true, 'count', next_count, 'limit', safe_max);
end;
$$;

create or replace function public.security_claim_idempotency_key(
  p_idempotency_key text,
  p_action text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.idempotency_keys%rowtype;
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into existing
  from public.idempotency_keys
  where user_id = auth.uid()
    and idempotency_keys.idempotency_key = left(p_idempotency_key, 160)
  limit 1;

  if found then
    if existing.request_hash <> p_request_hash then
      perform public.security_log_event('idempotency_hash_mismatch', p_action, 'warning', '{}'::jsonb);
      return jsonb_build_object('claimed', false, 'duplicate', true, 'hash_mismatch', true, 'response_status', existing.response_status, 'response_body', existing.response_body);
    end if;
    return jsonb_build_object('claimed', false, 'duplicate', true, 'response_status', existing.response_status, 'response_body', existing.response_body);
  end if;

  insert into public.idempotency_keys(user_id, idempotency_key, action, request_hash)
  values (auth.uid(), left(p_idempotency_key, 160), left(p_action, 80), p_request_hash)
  returning id into inserted_id;

  return jsonb_build_object('claimed', true, 'duplicate', false, 'id', inserted_id);
end;
$$;

create or replace function public.security_validate_trade_journal()
returns trigger
language plpgsql
as $$
begin
  new.user_id = auth.uid();
  if new.user_id is null then
    raise exception 'Authentication required';
  end if;
  new.symbol = upper(left(regexp_replace(coalesce(new.symbol, ''), '[^A-Za-z0-9./-]', '', 'g'), 12));
  if new.symbol = '' then
    raise exception 'Invalid symbol';
  end if;
  if new.direction not in ('LONG', 'SHORT') then
    raise exception 'Invalid direction';
  end if;
  if new.contracts <= 0 or new.contracts > 1000 then
    raise exception 'Invalid contracts';
  end if;
  if abs(new.pnl) > 10000000 then
    raise exception 'Invalid pnl';
  end if;
  new.mood = nullif(left(regexp_replace(coalesce(new.mood, ''), '[[:cntrl:]<>]', ' ', 'g'), 40), '');
  new.notes = nullif(left(regexp_replace(coalesce(new.notes, ''), '[[:cntrl:]<>]', ' ', 'g'), 2000), '');
  if array_length(new.tags, 1) > 12 then
    raise exception 'Too many tags';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists security_validate_trade_journal on public.trade_journal;
create trigger security_validate_trade_journal
before insert or update on public.trade_journal
for each row
execute function public.security_validate_trade_journal();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-screenshots', 'user-screenshots', false, 8388608, array['image/jpeg', 'image/png', 'image/heic', 'image/heif']),
  ('user-voice-notes', 'user-voice-notes', false, 15728640, array['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg']),
  ('user-exports', 'user-exports', false, 10485760, array['application/pdf', 'image/png']),
  ('user-attachments', 'user-attachments', false, 10485760, array['text/csv', 'text/plain', 'application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own screenshots" on storage.objects;
create policy "Users read own screenshots"
on storage.objects for select
to authenticated
using (bucket_id = 'user-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users write own screenshots" on storage.objects;
create policy "Users write own screenshots"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update own screenshots" on storage.objects;
create policy "Users update own screenshots"
on storage.objects for update
to authenticated
using (bucket_id = 'user-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'user-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own screenshots" on storage.objects;
create policy "Users delete own screenshots"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own voice notes" on storage.objects;
create policy "Users read own voice notes"
on storage.objects for select
to authenticated
using (bucket_id = 'user-voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users write own voice notes" on storage.objects;
create policy "Users write own voice notes"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own voice notes" on storage.objects;
create policy "Users delete own voice notes"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own exports" on storage.objects;
create policy "Users read own exports"
on storage.objects for select
to authenticated
using (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users write own exports" on storage.objects;
create policy "Users write own exports"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own exports" on storage.objects;
create policy "Users delete own exports"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own attachments" on storage.objects;
create policy "Users read own attachments"
on storage.objects for select
to authenticated
using (bucket_id = 'user-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users write own attachments" on storage.objects;
create policy "Users write own attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'user-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own attachments" on storage.objects;
create policy "Users delete own attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'user-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);


create or replace function public.security_consume_request_limit_for_actor(
  p_actor_hash text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_action text := left(coalesce(p_action, 'unknown'), 80);
  safe_max integer := greatest(1, least(coalesce(p_max_requests, 10), 10000));
  safe_window integer := greatest(10, least(coalesce(p_window_seconds, 60), 86400));
  safe_actor text := lower(coalesce(p_actor_hash, ''));
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / safe_window) * safe_window);
  next_count integer;
begin
  if safe_actor !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid actor hash';
  end if;

  insert into public.request_limits(actor_hash, action, window_start, count)
  values (safe_actor, safe_action, current_window, 1)
  on conflict (actor_hash, action, window_start)
  do update set count = public.request_limits.count + 1, updated_at = now()
  returning count into next_count;

  if next_count > safe_max then
    insert into public.security_events(user_id, actor_hash, event_type, action, severity, metadata)
    values (null, safe_actor, 'rate_limit_exceeded', safe_action, 'warning', jsonb_build_object('limit', safe_max, 'window_seconds', safe_window));
    return jsonb_build_object('allowed', false, 'count', next_count, 'limit', safe_max, 'retry_after_seconds', safe_window);
  end if;

  return jsonb_build_object('allowed', true, 'count', next_count, 'limit', safe_max);
end;
$$;

revoke execute on function public.security_log_event(text, text, text, jsonb) from public, anon;
revoke execute on function public.security_consume_request_limit(text, integer, integer) from public, anon;
revoke execute on function public.security_claim_idempotency_key(text, text, text) from public, anon;
grant execute on function public.security_log_event(text, text, text, jsonb) to authenticated;
grant execute on function public.security_consume_request_limit(text, integer, integer) to authenticated;
revoke execute on function public.security_consume_request_limit_for_actor(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.security_consume_request_limit_for_actor(text, text, integer, integer) to service_role;
grant execute on function public.security_claim_idempotency_key(text, text, text) to authenticated;
