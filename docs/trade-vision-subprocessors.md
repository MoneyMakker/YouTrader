# Trade Vision subprocessors — publication checklist

Last reviewed: 2026-07-15

This is the source checklist for the public subprocessors notice. It is intentionally **not** a statement that every listed provider is active in production.

| Provider/service category | When involved | Data categories | Verified policy source | Publication status |
| --- | --- | --- | --- | --- |
| Supabase Edge Functions | Always; authenticated request proxy, entitlement and quota checks | Processed chart image, MIME type, user question, reduced aggregate journal metrics, authenticated request | YouTrader implementation review | Confirm production project retention/log configuration before publication |
| Google Gemini API | Only when `AI_PROVIDER=gemini`, or automatic Trade Vision routing selects Gemini | Processed chart image, question, reduced aggregate metrics | [Gemini ZDR documentation](https://ai.google.dev/gemini-api/docs/zdr) | Verify paid-service/log/dataset configuration before publication |
| OpenRouter | Only when `AI_PROVIDER=openrouter`, or automatic Trade Vision routing falls back to OpenRouter | Processed chart image, question, reduced aggregate metrics, model request metadata | [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection), [ZDR controls](https://openrouter.ai/docs/guides/features/zdr) | Verify production key privacy settings, guardrail, model, and final endpoint before publication |

## Publication rule

Before publishing the public notice, the release owner must record the active provider chain and exact production configuration. Do not copy this document into the public policy until the entries marked for verification are resolved.

For every active provider, publish: provider name, purpose, categories of data, processing location when the provider documents it, retention/training policy only when verified for the configured endpoint, official privacy link, official terms/DPA link, and a verification date.
