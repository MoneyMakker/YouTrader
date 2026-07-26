# YouTrader Architecture

## Product Overview

YouTrader helps traders improve every day through the core loop: **Log → Review → Understand → Improve → Repeat**. Product areas are Journal, Review and analytics, AI coaching, Prop Risk, Market Context, subscription, and account/data controls.

## Application Architecture

```text
Expo / React Native client
        |
        v
UI and local feature state (App.tsx, src/components, src/hooks)
        |
        v
Domain services (analytics, AI clients, sync, auth, security)
        |
        v
Supabase Auth + PostgREST + Realtime
        |
        +--> Edge Functions (AI, market intelligence, secure upload, email)
        +--> Private Storage (screenshots, voice notes, exports, CSV)
        |
        v
Analytics and crash reporting (PostHog, Sentry)
```

The client owns presentation, local persistence, offline intent, and authenticated calls. `src/analytics` owns deterministic calculations. `src/api` owns client-to-Edge request boundaries. Supabase provides identity, row-scoped persistence, Realtime, and protected Storage. Edge Functions own privileged provider access and server-side authorization.

Implementation sequencing is defined by [BACKLOG.md](./BACKLOG.md); this
document defines boundaries rather than task priority.

## Feature Modules

| Module | Purpose and responsibilities | Entry points / important files | Dependencies / external services |
|---|---|---|---|
| Journal | Create, edit, calendar-review, import, and synchronize trades. | `App.tsx`, `src/components/journal`, `src/analytics/trade*`, `src/utils/importTradesCsv.ts` | AsyncStorage, Supabase `trade_journal` |
| Review | Summarize performance, patterns, sessions, drawdown, and behavior. | `src/analytics`, Stats components in `App.tsx` | Journal data |
| AI | Provide educational coach, review, and market explanations. | `src/api/aiCoach.ts`, `supabase/functions/ai-coach`, `_shared/aiProvider.ts` | Edge Functions, model providers, RAG |
| Market | News, calendar, market summaries, and related AI context. | `src/api/marketIntelligence.ts`, `supabase/functions/market-intelligence` | Supabase market tables, market worker |
| Portfolio | Portfolio-like performance views are derived from journal analytics; it is not a brokerage ledger. | `src/analytics/equityCurve.ts`, Stats UI | Journal data |
| Prop Risk | Template rules, buffers, pass probability, risk coaching. | `src/propFirm`, `src/components/propFirm` | Supabase prop templates, journal data |
| Subscription | Entitlements, paywall, purchase, restore, and server gates. | `src/config/appConfig.ts`, `App.tsx`, `_shared/revenueCatEntitlement.ts` | RevenueCat, Supabase subscription cache |
| Settings | Account, data, legal, notifications, and subscription controls. | `src/components/settings`, Settings in `App.tsx` | Auth, storage, notifications |
| Authentication | Apple, Google, email/password, recovery, deep links, sessions. | `src/auth`, `src/config/appConfig.ts` | Supabase Auth, SecureStore |
| Media | Attach protected screenshots/voice notes to trades. | `src/security/uploadSecurity.ts`, `secure-upload` | Private Supabase Storage |
| Exports | CSV/PDF and share-card export. | `src/reports`, `src/components/insights` | Expo Print, Sharing, Media Library |
| Notifications | Local reminders and smart-alert preferences. | `src/notifications` | Expo Notifications |
| Cloud Sync | Reconcile local trades/preferences with Supabase. | `src/sync` | Supabase, NetInfo |
| Offline Queue | Retain retryable user intents while disconnected. | `src/sync/offlineQueue.ts` | AsyncStorage |
| Localization | Seven supported locales and translation checks. | `src/i18n`, `scripts/check-translations.mjs` | i18next, Expo Localization |

## Data Flow

### Trade creation

```text
Trade form → client validation → local journal persistence → offline queue
→ authenticated Supabase sync → Realtime event → local reconciliation
```

### Trade synchronization

`src/sync/offlineQueue.ts` stores retryable work; `networkReconnect.ts` resumes it; Supabase RLS scopes rows by user. Sync must remain idempotent and preserve user intent during reconnect.

### AI request lifecycle

```text
Validated client payload → authenticated Edge Function → entitlement/quota gate
→ provider or safe fallback → normalized structured result → client state/cache
```

Provider keys remain server-side. See [SECURITY.md](./SECURITY.md) and [AI_PLATFORM_V2.md](./AI_PLATFORM_V2.md).

### Subscription lifecycle

```text
RevenueCat client purchase/restore → customer info → app entitlement state
→ server-side entitlement verification for protected resources
```

### Authentication lifecycle

```text
Native/provider login → Supabase session → SecureStore persistence
→ refresh while active → logout clears secure and legacy session storage
```

### Media upload lifecycle

```text
Client validation → secure-upload Edge Function → JWT verification
→ MIME/magic-byte/size/path validation → private Storage → upload metadata
```

## Repository Organization

| Path | Ownership / boundary |
|---|---|
| `App.tsx` | Current application composition and legacy screen orchestration; avoid broad unrelated edits. |
| `src/analytics` | Pure trading metrics and deterministic insight calculations. |
| `src/ai`, `src/api` | Client AI preparation and request boundaries. |
| `src/auth` | Authentication and session lifecycle only. |
| `src/components` | Feature presentation components; keep domain logic out where practical. |
| `src/config` | Validated runtime configuration and product limits. |
| `src/security` | Client validation, rate-limit helpers, upload rules. |
| `src/sync` | Offline and cloud synchronization boundaries. |
| `supabase/migrations` | Forward-only schema history; never edit applied migrations. |
| `supabase/functions` | Privileged server actions and shared Edge utilities. |
| `scripts` | QA, release, import, and operational automation. |
| `docs` | Persistent engineering and release knowledge. |

## Engineering Boundaries

- UI must not access service-role credentials or privileged database paths.
- Analytics must remain deterministic and separate from AI provider calls.
- AI must not mutate journal, subscription, or prop-risk data.
- Media access must remain user-owned and server-authorized.
- Subscription UI cannot be the only authorization layer for protected server resources.
- Offline queue logic must not be embedded into visual components.
- Market Context must not become execution advice or a brokerage subsystem.
