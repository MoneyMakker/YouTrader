create table if not exists public.ai_quota_lifecycle (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 80),
  request_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  status text not null check (status in ('reserved','completed','provider_failed','released')),
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  terminal_reason text,
  unique (user_id, action, request_id)
);
alter table public.ai_quota_lifecycle enable row level security;
revoke all on public.ai_quota_lifecycle from anon, authenticated;
revoke all on public.ai_quota_lifecycle from public;
grant select, insert, update on public.ai_quota_lifecycle to service_role;

create index if not exists ai_quota_lifecycle_bucket_window_idx
  on public.ai_quota_lifecycle (user_id, bucket, window_start, status);

create or replace function public.security_reserve_ai_quota_lifecycle(p_user_id uuid,p_action text,p_request_id uuid,p_bucket text,p_limit integer,p_window_start timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_quota_lifecycle%rowtype; used_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_bucket||':'||p_window_start::text,0));
 select * into r from public.ai_quota_lifecycle where user_id=p_user_id and action=p_action and request_id=p_request_id;
 if found then return jsonb_build_object('status',r.status,'denied',false,'replay',true); end if;
  select count(*) into used_count from public.ai_quota_lifecycle where user_id=p_user_id and bucket=p_bucket and window_start=p_window_start and status in ('reserved','completed');
 if used_count >= greatest(1,least(p_limit,1000)) then return jsonb_build_object('status','denied','denied',true); end if;
 insert into public.ai_quota_lifecycle(user_id,action,request_id,bucket,window_start,status) values(p_user_id,p_action,p_request_id,p_bucket,p_window_start,'reserved');
 return jsonb_build_object('status','reserved','denied',false,'replay',false);
end; $$;

create or replace function public.security_transition_ai_quota_lifecycle(p_user_id uuid,p_action text,p_request_id uuid,p_target text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_quota_lifecycle%rowtype;
begin
 select * into r from public.ai_quota_lifecycle where user_id=p_user_id and action=p_action and request_id=p_request_id for update;
 if not found then raise exception 'quota lifecycle not found'; end if;
  if r.status='reserved' and p_target='completed' then update public.ai_quota_lifecycle set status='completed',committed_at=now(),terminal_reason=left(p_reason,160) where id=r.id; end if;
  if r.status='reserved' and p_target='provider_failed' then update public.ai_quota_lifecycle set status='provider_failed',released_at=now(),terminal_reason=left(p_reason,160) where id=r.id; end if;
 if r.status='reserved' and p_target='released' then update public.ai_quota_lifecycle set status='released',released_at=now(),terminal_reason=left(p_reason,160) where id=r.id; end if;
 select * into r from public.ai_quota_lifecycle where id=r.id;
 return jsonb_build_object('status',r.status);
end; $$;
revoke all on function public.security_reserve_ai_quota_lifecycle(uuid,text,uuid,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.security_transition_ai_quota_lifecycle(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.security_reserve_ai_quota_lifecycle(uuid,text,uuid,text,integer,timestamptz) to service_role;
grant execute on function public.security_transition_ai_quota_lifecycle(uuid,text,uuid,text,text) to service_role;
