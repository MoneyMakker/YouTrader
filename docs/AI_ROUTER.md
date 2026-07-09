# AI Router

Central routing layer for all YouTrader LLM requests (Platform V2).

**Source:** `supabase/functions/_shared/aiPlatform/router.ts`

---

## Entry point

```typescript
import { routeAIRequest, createRequestId } from "./aiPlatform/index.ts";

const response = await routeAIRequest({
  requestId: createRequestId(),
  endpoint: "weekly_coach",
  userId: "...",
  userTier: "pro",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPayload },
  ],
  jsonMode: true,
});
```

**Rule:** Features must not call OpenRouter, Gemini, Anthropic, or NVIDIA directly.

---

## Responsibilities

| Decision | Mechanism |
|----------|-----------|
| Provider | Model ref → provider adapter |
| Model | `models.*.modelIdDefault` or env override |
| Profile (fast/deep/long) | `endpointProfiles` + token threshold |
| Temperature / max tokens / timeout | `profiles.*` |
| Retry | Per-provider 5xx + network retry |
| Fallback | `fallbackChains` — tries next model ref on failure |
| Cache | SHA-256 key, TTL from config |
| Prompt version | `prompts/registry.ts` |

---

## Dynamic model selection

| Scenario | Profile | Primary model ref |
|----------|---------|-------------------|
| Daily plan, news, challenge | `fast` | `gemini-flash` |
| Weekly coach, journal, risk | `deep` | `claude-sonnet` |
| Input ≥ 12k tokens (est.) | `long_context` | `kimi-long` |
| Noise filter, cheap tasks | `cheap_batch` | `deepseek-chat` |
| Market intelligence (Phase 2) | `market_fast` | `gemini-flash` |

Token estimate: `ceil(characters / 4)` unless `inputTokenEstimate` provided.

---

## Fallback example (deep tier)

```text
claude-sonnet → gpt-4o → gemini-flash → deepseek-chat → nvidia-llama
```

Each failure logged in `response.attempts[]` and `fallbackReason`.

---

## Provider adapters

| Provider | Kind | Secret env |
|----------|------|------------|
| openrouter | openai_compatible | `OPENROUTER_API_KEY` |
| openai | openai_compatible | `OPENAI_API_KEY` |
| nvidia | openai_compatible | `NVIDIA_API_KEY` |
| gemini | gemini | `GEMINI_API_KEY` |
| anthropic | anthropic | `ANTHROPIC_API_KEY` |

Direct provider used on fallback attempts (after first OpenRouter try) when `directProvider` configured on model.

---

## Response metadata

Every router response includes:

- `requestId`, `provider`, `modelId`, `modelRef`, `profile`
- `promptVersion`, `latencyMs`, `cacheHit`
- `usedFallback`, `fallbackReason`, `attempts[]`
- `estimatedInputTokens`, `estimatedOutputTokens`, `estimatedCostUsd`

Stored in `ai_usage_events.metadata` for Phase 1 analytics.

---

## Adding a new model (no code change)

Edit `config.default.json` or set `AI_PLATFORM_CONFIG_JSON`:

```json
{
  "models": {
    "new-model": {
      "provider": "openrouter",
      "modelIdDefault": "vendor/model-name",
      "tier": "fast",
      "contextWindow": 128000
    }
  },
  "fallbackChains": {
    "fast": ["gemini-flash", "new-model", "deepseek-chat"]
  }
}
```

Redeploy Edge Function after config secret update.

---

## Kill switch

```bash
supabase secrets set AI_PLATFORM_V2_ENABLED=false
supabase functions deploy ai-coach
```

Reverts AI Coach to legacy provider loop in `aiProvider.ts`.
