# YouTrader Project Memory

## Always Read First

Before continuing development, read these files in order:

1. `MASTER_CONTEXT.md`
2. `PROJECT_HANDOFF.md`
3. `CONTINUATION.md`
4. `KNOWLEDGE.md`
5. `ARCHITECTURE.md`

`MASTER_CONTEXT.md` is the permanent source of truth. The older handoff files are historical context and may be stale. If a major architectural decision, analytics engine, AI behavior, Supabase schema, RevenueCat/subscription flow, or design-system rule changes, update `MASTER_CONTEXT.md` in the same branch.

Do not rewrite already implemented work. Preserve the current architecture unless the user explicitly asks for a focused migration.

## Product Direction

YouTrader is a premium Expo React Native trading journal and analytics app for futures and prop-firm traders.

The product should feel like a calm Apple-quality iOS 26 / VisionOS fintech terminal: dark, glassy, premium, information-dense, and disciplined.

YouTrader must help traders understand execution, risk behavior, consistency, journaling quality, session performance, emotional patterns, and prop-firm survival path.

It must not become a trade-signal, market-prediction, crypto-dashboard, gamer, or neon-heavy product.

## Architecture Rules

- Main app entry is `App.tsx`.
- Navigation is internal React state, not React Navigation.
- State is mostly local React state in `App.tsx`.
- Journal trades are the source of truth.
- Analytics should stay deterministic and derived from real journal data.
- AI is an interpretation/coaching layer, not the source of calculations.
- Supabase handles auth, optional cloud sync, Edge Functions, quotas, and server Pro entitlement.
- RevenueCat handles subscriptions and purchase/restore flows.
- NVIDIA AI must only be called through Supabase Edge Functions.
- Never expose private AI/API keys in the mobile bundle.
- Do not add heavy native dependencies without explicit approval.

## Current Important State

- Expo SDK: `~54.0.35`
- React Native: `0.81.5`
- App config version: `1.5.7`
- iOS build number: `63`
- `package.json` version: `1.5.7`.
- `npm run typecheck` passes.
- `npx expo-doctor` previously passed 17/18 with one non-CNG/native-folder warning.
- Root contains many `.ipa` artifacts and backup folders. Do not commit them accidentally.

## Recent Implementation Notes

Latest completed work before this memory:

- Premium iOS 26 visual polish is implemented mostly in `App.tsx`.
- Journal no longer renders `DailyCoachCard` / "Edge Is Showing".
- News no longer exposes `Explain with AI`.
- Stats uses `Performance Profile` radar.
- AI Analytics uses the consolidated five-section command center structure.
- Achievement share flow was restored in `TerminalTraderStatus`.
- `MASTER_CONTEXT.md` was added as the permanent project brain.
- `supabase/migrations/20260627231000_add_runtime_tables_rls.sql` is now the self-contained runtime schema path for:
  - `prop_firms`
  - `user_firm_settings`
  - `trade_journal`
  - `risk_snapshots`
  - `user_subscriptions`
  - `ai_usage_events`
  - `achievement_share_usage`
  - RLS policies, indexes and seed prop firm templates.

## Pending Work

Highest priority:

1. Manual UI QA on iPhone and iPad simulators.
2. Verify achievement share card capture.
3. Verify RevenueCat monthly/yearly products and shared entitlement consistency.
4. Verify Supabase auth and Pro cloud sync.
5. Deploy/verify SQL migrations and RLS in Supabase.
6. Resolve or consciously accept the Expo Doctor non-CNG warning.
7. Re-authenticate Aikido if scan still returns `Invalid token provided`.
8. Clean release artifacts before commit or release packaging.

Later refactors:

- Extract stats components from `App.tsx` into `src/components/stats/`.
- Extract AI components from `App.tsx` into `src/components/ai/`.
- Extract screen-level components into `src/screens/`.
- Add focused tests for formulas and payload builders.

## Safety Rules

- Preserve RevenueCat business logic unless explicitly fixing subscription setup.
- Preserve Supabase auth/session/cloud sync behavior unless explicitly targeted.
- Keep free users able to see useful app value.
- Keep advanced AI/stats/export/sync Pro-gated where already designed.
- AI must never provide financial advice, buy/sell/hold signals, market direction predictions, or profit/pass guarantees.
- Sanitize inputs and use parameterized database access.
- Keep RLS enabled on public Supabase tables.
- Do not commit secrets, `.env`, `.ipa` files, or backup folders.
- Run `npm run typecheck` after code edits.
- Run `npx expo-doctor` after dependency/build config changes.
- Run Aikido scan after creating or modifying first-party source code.
