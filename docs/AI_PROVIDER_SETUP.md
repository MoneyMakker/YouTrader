# AI Provider Setup

Last updated: 2026-07-02

YouTrader AI provider calls must stay server-side through Supabase Edge Functions. The Expo app must never contain OpenRouter, Gemini, Anthropic, NVIDIA, OpenAI, or other private AI provider keys.

## Current Architecture

Client:

- `src/api/aiCoach.ts` calls `supabase.functions.invoke("ai-coach")`.
- If Supabase/auth/cloud AI is unavailable, it returns deterministic local fallback analysis.
- `src/api/tradeAnalysis.ts` is deterministic local analysis and does not call paid AI providers.

Reference files:

- `src/api/aiCoach.ts`
- `src/api/tradeAnalysis.ts`
- `supabase/functions/ai-coach/index.ts`
- `supabase/functions/_shared/aiProvider.ts`
- `supabase/functions/_shared/aiQuota.ts`

Supabase Edge Functions:

- `supabase/functions/ai-coach/index.ts` verifies JWT auth.
- Free users receive local preview/fallback and do not trigger paid provider generation.
- Pro users are checked against server-side entitlement state before paid cloud AI.
- AI quota and cooldown are enforced in `supabase/functions/_shared/aiQuota.ts`.
- Provider routing is implemented in `supabase/functions/_shared/aiProvider.ts`.
- RAG context retrieval is implemented in `supabase/functions/_shared/retrievalService.ts` and uses Supabase `pgvector` plus OpenAI embeddings.
- Optional Langfuse tracing is implemented in `supabase/functions/_shared/langfuse.ts` and is disabled unless Langfuse env vars are set.

Provider routing:

- `AI_PROVIDER=auto` uses OpenRouter first when configured.
- Fast tier actions: `daily_plan`, `news_explainer`, `daily_challenge`.
- Deep tier actions: `weekly_coach`, `journal_summary`, `risk_predictor`.
- Fast defaults: `google/gemini-2.5-flash` through OpenRouter, or direct `gemini-2.5-flash` fallback.
- Deep defaults: `anthropic/claude-sonnet-4` through OpenRouter, or direct `claude-sonnet-4-20250514` fallback.

## Server-Side Secrets

Store these only in Supabase Edge Function secrets or another server secret manager:

- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`
- `AI_MODEL_FAST`
- `AI_MODEL_DEEP`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST`

Never use:

- `EXPO_PUBLIC_OPENROUTER_API_KEY`
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_ANTHROPIC_API_KEY`
- `EXPO_PUBLIC_NVIDIA_API_KEY`
- any Expo public private AI key

## Cost Safety

- Free users must not trigger paid per-user AI generation.
- Pro users must remain quota/cooldown protected.
- Missing provider keys must return safe local fallback.
- Provider errors must not expose keys, raw prompts, screenshots, voice notes, private notes, or full journal payloads.
- Media fields are stripped before cloud provider calls.

## RAG Knowledge Grounding

YouTrader AI answers can be grounded in verified prop firm, CME, economic calendar, risk-management, and journaling documents stored in Supabase Postgres with `pgvector`.

Reference docs:

- `docs/RAG_KNOWLEDGE_BASE.md`
- `knowledge/README.md`
- `scripts/rag/import-knowledge.mjs`
- `supabase/migrations/20260703025327_add_rag_knowledge_base.sql`

RAG behavior:

- Pinecone is not used.
- Knowledge tables are server-only and deny-by-default.
- Documents are imported from Markdown, text, and PDF files.
- Embeddings are generated with OpenAI server-side.
- Before cloud AI generation, `aiProvider.ts` injects only relevant context as `knowledge_context`.
- Responses include `rag.sources`, `rag.confidence`, and `rag.lowConfidence`.
- If confidence is low, AI must not invent prop firm or exchange rules.

## Langfuse Observability

Langfuse is optional and server-side only.

Tracked metadata is intentionally limited to:

- feature/action name
- period
- provider
- model
- user tier (`free` or `pro`)
- latency
- success/failure
- fallback usage
- rough response token estimate

Do not send:

- private notes
- screenshots
- voice notes
- full trade entries
- raw prompts
- raw payloads
- user email
- auth tokens
- provider API keys

If Langfuse env vars are missing, tracing is skipped and AI behavior remains unchanged.

Manual setup:

```bash
supabase secrets set LANGFUSE_PUBLIC_KEY=...
supabase secrets set LANGFUSE_SECRET_KEY=...
supabase secrets set LANGFUSE_HOST=https://cloud.langfuse.com
```

Redeploy the Edge Function after setting secrets:

```bash
supabase functions deploy ai-coach
```

## Promptfoo Safety Tests

Promptfoo readiness lives in:

- `promptfoo.config.yaml`
- `scripts/promptfoo-local-provider.mjs`
- `docs/AI_SAFETY_TESTS.md`

Run without paid AI provider keys:

```bash
npm run test:ai-safety
```

The default suite uses a local deterministic provider to check safety boundaries. Provider-backed tests should only be added later from a secure server/developer environment with synthetic data.

## Validation Checklist

Before deploying AI changes:

1. Search for private AI keys in Expo/client code.
2. Confirm `src/api/aiCoach.ts` uses Supabase Edge Functions only.
3. Confirm Edge Function auth uses verified JWT.
4. Confirm free users use fallback/preview only.
5. Confirm `ai_usage_events` quota/cooldown still records Pro usage.
6. Run AI safety tests when changing prompts/provider routing.
7. Run:
   ```bash
   npm run typecheck
   npm run security:check
   npm run test:ai-safety
   ```

## Manual Supabase Setup

Set provider secrets with Supabase CLI or dashboard:

```bash
supabase secrets set AI_PROVIDER=auto
supabase secrets set OPENROUTER_API_KEY=...
supabase secrets set GEMINI_API_KEY=...
supabase secrets set ANTHROPIC_API_KEY=...
supabase secrets set AI_MODEL_FAST=google/gemini-2.5-flash
supabase secrets set AI_MODEL_DEEP=anthropic/claude-sonnet-4
supabase secrets set LANGFUSE_PUBLIC_KEY=...
supabase secrets set LANGFUSE_SECRET_KEY=...
supabase secrets set LANGFUSE_HOST=https://cloud.langfuse.com
```

Only set provider keys you actually intend to use. The app must work with no AI provider keys by falling back safely.
