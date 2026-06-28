create extension if not exists pgcrypto;

create table if not exists public.upload_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('screenshot', 'voice-note', 'export', 'csv')),
  bucket text not null,
  path text not null unique,
  original_filename text not null,
  content_type text not null,
  file_size integer not null check (file_size > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint upload_files_path_owner check (path like user_id::text || '/%'),
  constraint upload_files_safe_path check (path !~ '(\.\./|\.\.\\|[[:cntrl:]])'),
  constraint upload_files_safe_original_name check (
    length(original_filename) between 1 and 100
    and original_filename ~ '^[A-Za-z0-9_.-]+$'
    and original_filename !~ '(\.\./|\.\.\\|[[:cntrl:]])'
  ),
  constraint upload_files_bucket_category check (
    (category = 'screenshot' and bucket = 'user-screenshots') or
    (category = 'voice-note' and bucket = 'user-voice-notes') or
    (category = 'export' and bucket = 'user-exports') or
    (category = 'csv' and bucket = 'user-attachments')
  ),
  constraint upload_files_mime_size check (
    (category = 'screenshot' and content_type in ('image/jpeg', 'image/png', 'image/webp') and file_size <= 10485760) or
    (category = 'voice-note' and content_type in ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/aac') and file_size <= 26214400) or
    (category = 'export' and content_type in ('application/pdf', 'text/csv') and file_size <= 10485760) or
    (category = 'csv' and content_type = 'text/csv' and file_size <= 10485760)
  )
);

create index if not exists upload_files_user_created_idx on public.upload_files(user_id, created_at desc);
create index if not exists upload_files_user_hash_recent_idx on public.upload_files(user_id, category, sha256, created_at desc);

alter table public.upload_files enable row level security;

drop policy if exists "Users read own upload metadata" on public.upload_files;
create policy "Users read own upload metadata"
on public.upload_files for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.upload_files from anon, authenticated;
grant select on public.upload_files to authenticated;

create or replace function public.security_validate_upload_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    raise exception 'Missing upload owner';
  end if;
  if new.path is null or new.path not like new.user_id::text || '/%' then
    raise exception 'Invalid upload path';
  end if;
  if new.path like '%../%' or new.path like '%..\%' or new.path ~ '[[:cntrl:]]' then
    raise exception 'Invalid upload path';
  end if;
  if new.original_filename is null
    or length(new.original_filename) > 100
    or new.original_filename !~ '^[A-Za-z0-9_.-]+$'
    or new.original_filename like '%../%'
    or new.original_filename like '%..\%'
    or new.original_filename ~ '[[:cntrl:]]' then
    raise exception 'Invalid original filename';
  end if;
  if new.created_at is null then
    new.created_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists security_validate_upload_metadata on public.upload_files;
create trigger security_validate_upload_metadata
before insert or update on public.upload_files
for each row
execute function public.security_validate_upload_metadata();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-screenshots', 'user-screenshots', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('user-voice-notes', 'user-voice-notes', false, 26214400, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/aac']),
  ('user-exports', 'user-exports', false, 10485760, array['application/pdf', 'text/csv']),
  ('user-attachments', 'user-attachments', false, 10485760, array['text/csv'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke execute on function public.security_validate_upload_metadata() from public, anon, authenticated;
