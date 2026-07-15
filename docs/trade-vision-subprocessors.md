# Trade Vision subprocessors — publication checklist

Last reviewed: 2026-07-15

This is the source checklist for the public subprocessors notice. It is intentionally **not** a statement that every listed provider is active in production.

| Provider/service category | When involved | Data categories | Verified policy source | Publication status |
| --- | --- | --- | --- | --- |
| Supabase Edge Functions | Always; authenticated request proxy, entitlement and quota checks | Processed chart image, MIME type, user question, reduced aggregate journal metrics, authenticated request | YouTrader implementation review | Confirm production project retention/log configuration before publication |
| OpenRouter | Current configured Trade Vision route: production has `OPENROUTER_API_KEY`; the exact `AI_PROVIDER` setting and final model endpoint remain unreadable | Processed chart image, question, reduced aggregate metrics, model request metadata | [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection), [ZDR controls](https://openrouter.ai/docs/guides/features/zdr) | Do not publish retention/training claims until the deployed key, model, and downstream endpoint are verified |

Google Gemini API is supported by the code but is not an active production Trade Vision processor in the 2026-07-15 secret inventory because `GEMINI_API_KEY` is absent. It must not appear in the public subprocessor notice unless that configuration changes and is verified first. Its official [ZDR documentation](https://ai.google.dev/gemini-api/docs/zdr) remains the required source if it becomes active.

## Publication rule

Before publishing the public notice, the release owner must record the active provider chain and exact production configuration. Do not copy this document into the public policy until the entries marked for verification are resolved.

For every active provider, publish: provider name, purpose, categories of data, processing location when the provider documents it, retention/training policy only when verified for the configured endpoint, official privacy link, official terms/DPA link, and a verification date.
