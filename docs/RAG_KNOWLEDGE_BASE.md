# YouTrader RAG Knowledge Base

Last updated: 2026-07-03

YouTrader uses Supabase Postgres with `pgvector` for Retrieval Augmented Generation. Pinecone is not used.

The goal is to ground AI Analytics answers in verified prop firm, exchange, risk, and journaling documentation before the AI provider generates a response.

## Architecture

Database:

- `knowledge_documents` stores source metadata.
- `knowledge_chunks` stores semantic text chunks.
- `knowledge_embeddings` stores OpenAI embedding vectors.
- `rag_match_knowledge_chunks(...)` performs cosine vector search.

Server-side runtime:

- `scripts/rag/import-knowledge.mjs` imports Markdown, text, and PDF sources.
- `supabase/functions/_shared/retrievalService.ts` creates query embeddings and retrieves matching chunks.
- `supabase/functions/_shared/aiProvider.ts` injects relevant `knowledge_context` before cloud AI generation.
- `supabase/functions/ai-coach/index.ts` returns RAG metadata to the client as `rag.sources`, `rag.confidence`, and `rag.lowConfidence`.

Client:

- `src/api/aiCoach.ts` calls the Supabase `ai-coach` Edge Function.
- The Expo app never sees OpenAI, OpenRouter, Gemini, Claude, or Supabase service-role keys.

## Supported Sources

Place verified `.md`, `.txt`, or `.pdf` files under `knowledge/sources/`.

Supported provider folders:

- `topstep`
- `apex`
- `take-profit-trader`
- `lucid`
- `cme`
- `economic-calendar-faq`
- `risk-management-guide`
- `journaling-guide`

Use frontmatter when possible:

```markdown
---
provider: topstep
title: Topstep Official Rule Summary
slug: topstep-official-rule-summary
source_url: https://official-source-url.example
last_updated: 2026-07-03
---
```

Do not invent prop firm rules. Do not commit private, paid, or copyrighted vendor documents unless you have the right to store them in this repository.

## Ingestion

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` optional, default `text-embedding-3-small`

Run:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
OPENAI_API_KEY=... \
npm run rag:import -- --dir=knowledge/sources
```

PDF import uses `pdftotext`:

```bash
brew install poppler
```

The importer:

1. Reads Markdown, text, and PDF files.
2. Extracts frontmatter metadata.
3. Splits content by headings and paragraph boundaries.
4. Creates semantic chunks with small overlap.
5. Regenerates embeddings with OpenAI.
6. Upserts document metadata and replaces old chunks for that document.

The importer writes a local `knowledge/sources/.last-import.json` summary. It is ignored by Git.

## Vector Search

Before each AI response, the Edge Function:

1. Builds a safe query from action, period, and non-media payload fields.
2. Removes screenshots, images, voice notes, and private notes from the retrieval query.
3. Generates an OpenAI embedding server-side.
4. Calls `rag_match_knowledge_chunks(...)`.
5. Injects only matching chunks above the confidence threshold into `knowledge_context`.

Default settings:

- Embedding model: `text-embedding-3-small`
- Vector dimension: `1536`
- Minimum confidence: `0.72`
- Max matches: `6`

If confidence is low or no context is found, the AI prompt instructs the model to say the source confidence is too low and not invent prop firm or exchange rules.

## Required AI Answer Metadata

For source-grounded answers, responses must expose:

- Source/provider
- Document title
- Last updated date
- Confidence score
- Source URL when available

If confidence is low, the app should treat the answer as general coaching only and tell the user to verify current official rules.

## Supabase Deployment

Apply the migration:

```bash
supabase db push
```

Set Edge Function secrets:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Redeploy:

```bash
supabase functions deploy ai-coach
```

Then import verified documents from a secure developer/server environment:

```bash
npm run rag:import -- --dir=knowledge/sources
```

## Security Rules

- No Pinecone.
- No AI or embedding keys in Expo public env.
- No service-role key in the mobile app.
- RAG tables are deny-by-default with RLS enabled.
- `anon` and `authenticated` cannot read or write knowledge tables.
- Only `service_role` can import documents or execute vector search.
- Do not log document contents, private trade notes, screenshots, voice notes, or provider keys.

