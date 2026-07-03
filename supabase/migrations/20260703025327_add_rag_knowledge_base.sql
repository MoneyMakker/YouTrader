create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{1,120}$'),
  title text not null check (char_length(title) between 2 and 180),
  provider text not null check (provider in ('topstep', 'apex', 'take_profit_trader', 'lucid', 'cme', 'economic_calendar_faq', 'risk_management_guide', 'journaling_guide', 'internal')),
  document_type text not null check (document_type in ('markdown', 'pdf', 'text')),
  source_url text,
  source_file text not null,
  content_hash text not null,
  last_updated date not null,
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading text,
  content text not null check (char_length(content) between 20 and 6000),
  token_estimate integer not null default 0 check (token_estimate >= 0 and token_estimate <= 3000),
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  unique (document_id, content_hash)
);

create table if not exists public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.knowledge_chunks(id) on delete cascade,
  embedding_model text not null default 'text-embedding-3-small',
  embedding vector(1536) not null,
  embedded_at timestamptz not null default now()
);

create index if not exists knowledge_documents_provider_idx on public.knowledge_documents(provider, last_updated desc);
create index if not exists knowledge_chunks_document_idx on public.knowledge_chunks(document_id, chunk_index);
create index if not exists knowledge_embeddings_vector_idx on public.knowledge_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_embeddings enable row level security;

revoke all on public.knowledge_documents from anon, authenticated;
revoke all on public.knowledge_chunks from anon, authenticated;
revoke all on public.knowledge_embeddings from anon, authenticated;

grant select, insert, update, delete on public.knowledge_documents to service_role;
grant select, insert, update, delete on public.knowledge_chunks to service_role;
grant select, insert, update, delete on public.knowledge_embeddings to service_role;

create or replace function public.rag_match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 6,
  min_confidence double precision default 0.72,
  provider_filter text[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  provider text,
  source_url text,
  source_file text,
  last_updated date,
  heading text,
  content text,
  confidence double precision,
  embedding_model text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.title as document_title,
    d.provider,
    d.source_url,
    d.source_file,
    d.last_updated,
    c.heading,
    c.content,
    greatest(0, least(1, 1 - (e.embedding <=> query_embedding)))::double precision as confidence,
    e.embedding_model
  from public.knowledge_embeddings e
  join public.knowledge_chunks c on c.id = e.chunk_id
  join public.knowledge_documents d on d.id = c.document_id
  where
    (provider_filter is null or d.provider = any(provider_filter))
    and (1 - (e.embedding <=> query_embedding)) >= min_confidence
  order by e.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 6), 12));
$$;

revoke all on function public.rag_match_knowledge_chunks(vector, integer, double precision, text[]) from public;
revoke all on function public.rag_match_knowledge_chunks(vector, integer, double precision, text[]) from anon, authenticated;
grant execute on function public.rag_match_knowledge_chunks(vector, integer, double precision, text[]) to service_role;
