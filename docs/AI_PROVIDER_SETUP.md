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

Provider routing:

- `AI_PROVIDER=auto` uses OpenRouter first when configured.
- Fast tier actions: `daily_plan`, `news_explainer`, `daily_challenge`.
- Deep tier actions: `weekly_coach`, `journal_summary`, `risk_predictor`.
- Fast defaults: `google/gemini-2.5-flash` through OpenRouter, or direct `gemini-2.5-flash` fallback.
- Deep defaults: `anthropic/claude-sonnet-4` through OpenRouter, or direct `claude-sonnet-4-20250514` fallback.

## Server-Side Secrets

Store these only in Supabase Edge Function secrets or another server secret manager:

- `AI_PROVIDER`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`
- `AI_MODEL_FAST`
- `AI_MODEL_DEEP`

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

## Validation Checklist

Before deploying AI changes:

1. Search for private AI keys in Expo/client code.
2. Confirm `src/api/aiCoach.ts` uses Supabase Edge Functions only.
3. Confirm Edge Function auth uses verified JWT.
4. Confirm free users use fallback/preview only.
5. Confirm `ai_usage_events` quota/cooldown still records Pro usage.
6. Run:
   ```bash
   npm run typecheck
   npm run security:check
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
```

Only set provider keys you actually intend to use. The app must work with no AI provider keys by falling back safely.
