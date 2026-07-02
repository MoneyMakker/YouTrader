# Codex Continuation Checkpoint

Last updated: 2026-07-02

This file is the handoff checkpoint for future Codex sessions after the YouTrader App Store upload and after Cursor credits ended. Read this before changing code.

## Current App Version

- Product: YouTrader
- Current production/App Store version: `1.5.7`
- Current iOS build: `72`
- Bundle identifier: `com.youtrader.pro`
- Expo slug: `youtrader-pro`
- Package version: `1.5.7`
- App Store Connect rule: never lower or reuse an iOS build number.

Version sources checked:

- `app.json`: `expo.version = 1.5.7`, `ios.buildNumber = 72`
- `ios/YouTrader/Info.plist`: `CFBundleShortVersionString = 1.5.7`, `CFBundleVersion = 72`
- `package.json`: `version = 1.5.7`

## Current Release Status

- YouTrader `1.5.7` build `72` is the current production/App Store upload baseline.
- The repository is on `main`.
- Latest committed baseline before this checkpoint: `66d402b Accept new Supabase secret key format`.
- Build `72` version files were present as uncommitted changes before this checkpoint.
- This checkpoint does not change app behavior, product logic, Supabase schema, RevenueCat products, subscriptions, AI gateway routing, or UI design.

## Current Architecture

- Expo SDK `~54.0.35`
- React `19.1.0`
- React Native `0.81.5`
- TypeScript `~5.9.2`
- Main entry: `expo/AppEntry.js`
- Main orchestrator: `App.tsx`
- State model: React state plus AsyncStorage; no Redux/Zustand.
- Main local journal key: `trades-v6`
- Main tabs: Journal, Stats, Calculator, AI Analytics, News, Calendar, Settings.
- Shared deterministic analytics live primarily in `src/analytics`.
- Local deterministic AI-adjacent engines live in `src/ai`.
- Cloud AI provider abstraction lives in `supabase/functions/_shared/aiProvider.ts`.
- RevenueCat remains the client purchase provider.
- Supabase remains the database/auth/storage/Edge Function backend, but schema changes require explicit instruction.

## Observability Installed

- Sentry package installed: `@sentry/react-native`.
- Sentry is env-gated and must build when Sentry env vars are missing.
- PostHog package installed: `posthog-react-native`.
- PostHog events must stay explicit and privacy-safe.
- Expo Notifications package installed: `expo-notifications`.
- Push readiness exists for permission handling/local helpers; do not assume remote push sending is live without backend/token storage review.

## Growth Infrastructure Readiness

- Growth infrastructure documentation lives in `docs/GROWTH_INFRASTRUCTURE.md`.
- Firebase Remote Config is readiness-only; Firebase SDK/config files are not installed in this checkpoint.
- Safe growth defaults live in `src/config/growthConfig.ts`.
- Firebase/A-B flags may control only safe copy and UI flags. They must never control secrets, RevenueCat product IDs, entitlement IDs, prices, Supabase rules, or security behavior.
- Expo Updates readiness uses `runtimeVersion.policy = appVersion` in `app.json`; `expo-updates` is not installed yet.
- GitHub Actions QA workflow lives in `.github/workflows/qa.yml` and does not replace manual TestFlight/iPhone QA.

## Analytics, Subscriptions, And AI Readiness

- Microsoft Clarity is evaluated but not installed in the mobile app. It is native-code based, requires a new build, and is currently recommended only for public web/landing pages after privacy review.
- PostHog remains the preferred mobile analytics path because YouTrader sends explicit safe metadata events only.
- Subscription server notifications should prefer RevenueCat webhooks. Direct Apple App Store Server Notifications require signedPayload/JWS verification and sandbox/production separation before any state changes.
- AI provider setup is documented in `docs/AI_PROVIDER_SETUP.md`.
- All private AI provider keys must remain server-side in Supabase Edge Function secrets. The Expo app must only call `supabase.functions.invoke("ai-coach")` and use local fallback when unavailable.

Observability safety rules:

- Do not log secrets, tokens, screenshots, voice notes, private journal notes, full trade payloads, or payment payloads.
- Keep analytics metadata/count-based.
- Sentry source map upload should only run in CI/EAS when Sentry secrets exist.

## Current Monetization Baseline

- RevenueCat monthly product ID: `youtrader_pro_monthly`
- RevenueCat yearly product ID: `youtrader_pro_yearly`
- Do not change product IDs, subscription IDs, entitlement IDs, or purchase/restore logic unless the user explicitly asks for a monetization fix.
- Free mode is intended to remain useful: manual journal, calendar P&L, calculator, basic stats, readable news, and cached market intelligence read-only.
- Pro unlocks serious workflow: AI coaching, advanced analytics, media notes, cloud sync, exports, CSV import, Prop Firm Coach, Hidden Leaks, Pattern Detective, and related tools.

## Current Security Baseline

- Do not paste or commit secrets.
- Do not expose service role keys or private AI keys in `EXPO_PUBLIC_*`.
- Run `npm run security:check` before release-sensitive commits when possible.
- Do not touch Supabase schema unless explicitly required.
- Prefer new migrations over editing applied migrations.
- Keep AI provider keys server-side only.
- Free users must not trigger paid per-user AI generation unless quota/safety rules explicitly allow it.

## UI Baseline

- UI source of truth: `docs/MY_UI.md`.
- Future UI work must use:
  - `.agents/skills/frontend-design`
  - `docs/MY_UI.md`
  - `.agents/skills/design-review`
- Visual direction: premium dark iOS / Liquid Glass, institutional, trader-first, readable.
- Green means positive/profit/safe buffer.
- Red means loss/risk/danger.
- Purple is the premium accent for selected states, AI, and secondary emphasis.
- Do not redesign the app unless explicitly requested.

## Pending Next Tasks

Safe next tasks after this checkpoint:

1. Manual iPhone QA on App Store/TestFlight build `72`.
2. Verify Journal media attachments on device:
   - Upload Photos
   - Take Pictures
   - Record Voice
   - leave/reopen day
   - restart app
3. Verify purchase/restore flows in RevenueCat sandbox and production.
4. Verify Sentry/PostHog dashboards receive safe events only when env keys are configured.
5. Verify Expo notification permission denied/allowed flows.
6. Verify PDF/share card exports on real iPhone Photos/share sheet.
7. Verify News and Market Intelligence cached read-only screens.
8. Verify growth defaults and Remote Config/A-B docs before enabling Firebase.
9. Verify Clarity remains disabled/not installed unless explicitly approved.
10. Verify RevenueCat webhook strategy before adding direct Apple notification endpoints.
11. Verify AI provider keys are server-side only before deploying Edge Functions.
12. Run release checks before any next upload:
   - `npm run typecheck`
   - `npm run security:check`
   - `npm audit`
   - `npx expo-doctor`

Phase 2 candidates, not urgent release blockers:

- Split large `App.tsx` into screens/components.
- Evaluate React Native Skia only after release stability.
- Re-enable or harden Supabase auth/cloud sync only with explicit QA plan.
- Add remote push token backend only after RLS/storage design.
- Install Firebase Remote Config or `expo-updates` only after compatibility and App Store build risk are reviewed.
- Install Microsoft Clarity only after native-build/privacy review; default path is web/landing-page analytics only.
- Build subscription webhooks through RevenueCat first; direct Apple notifications require signature verification.

## Rules For Future Codex Sessions

1. Start every task with `git status`.
2. Never restart the project from an old snapshot.
3. Never downgrade version/build numbers.
4. Never revert App Store `1.5.7` changes unless the user explicitly asks.
5. Never change RevenueCat product IDs, entitlement IDs, subscription IDs, or purchase logic without explicit instruction.
6. Never touch Supabase schema without explicit instruction.
7. Never expose secrets or print `.env` contents.
8. Keep changes small and incremental.
9. Preserve existing Journal, Stats, AI Analytics, News, Calendar, exports, paywall, and RevenueCat flows.
10. For UI tasks, follow `docs/MY_UI.md` and the design-review gate.
11. For security tasks, prefer docs/scripts/migrations over risky rewrites.
12. For growth experiments, keep Remote Config limited to safe copy/flags and document every manual Firebase dashboard step.
13. Keep all AI provider keys server-side and verify no Expo public AI key exists.
14. Run requested validation before final response.
15. Do not commit until the user asks, except when the prompt explicitly includes a commit instruction.

## Codex Session Starter Prompt

Use this prompt at the start of future Codex/Cursor sessions:

```text
You are continuing YouTrader in /Users/valentynborovyk/Projects/youtrader-final.
Read docs/CODEX_CONTINUATION.md, MASTER_CONTEXT.md, CONTINUATION.md, docs/MY_UI.md, and docs/AI_DEV_WORKFLOW.md.
Run git status first.
Use Caveman to keep diffs small and avoid token waste.
Use Context7 only when current Expo/React Native/Supabase/RevenueCat/Sentry/PostHog docs matter.
Use Taste + frontend-design + design-review for UI work.
Do not restart the project, do not use old snapshots, do not downgrade build numbers, do not touch RevenueCat IDs/subscriptions, do not touch Supabase schema, do not expose secrets, and do not change app runtime unless explicitly required.
Run npm run typecheck before final status when code/config/docs changed.
```

## Build Commands

Local validation:

```bash
npm run typecheck
npm run security:check
npx expo-doctor
```

EAS iOS build:

```bash
npx eas build --platform ios
```

Local EAS iOS build:

```bash
npx eas build --platform ios --local
```

Install IPA on a connected device, if `ios-deploy` is installed:

```bash
ios-deploy --bundle /path/to/YouTrader.ipa
```

Transporter upload uses the generated `.ipa`; do not commit build artifacts.
