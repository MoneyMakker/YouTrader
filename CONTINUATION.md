# Continuation Notes

This is the short takeover checklist for the next senior engineer.

## Recently Completed (2026-06-28)

- Confirmed current working baseline is `/Users/valentynborovyk/Projects/youtrader-final`, matching YouTrader `1.5.7` build `64` / `build-1782614005662.ipa`; do not use the older `2026-05-23` Codex folder as a source.
- Removed AI Confidence and unified Refresh Analysis from AI Analytics.
- Fixed Evaluation/Funded account plan so each mode renders its own data with no "Switch to Funded" prompt.
- Restored premium Trader Status achievements inside AI Analytics/Funded flow.
- Updated achievement share limits to monthly Free 5 / Pro 15, with Free unlocked cards capped at 5 before upgrade messaging.
- Added monthly AI allowance handling and server-side quota messaging for Pro AI features.
- Added Photos add permission and safer save-to-library handling.
- Redesigned P&L card and Monthly PDF exports with premium YouTrader branding.
- Moved Journal scroll cue slightly higher.

## Previously Completed (2026-06-27)

- Created `PRODUCT_VISION.md` as the long-term product direction doc.
- Stats screen reordered: Equity Curve → Stats Dashboard → Trading Radar → Heatmap.
- Removed Eval Account / Funded controls and Trader Status from Stats.
- AI Analytics reordered and de-duplicated; renamed Expandable Report → Performance Intelligence.
- Moved Eval Account + Funded panel into AI Analytics.
- Journal scroll hint replaced with subtle centered glass chevron.
- Calendar header and Refresh button removed; compact top layout.
- Performance: removed duplicate analytics work from Stats render path; memoized AI trading score.

## Highest Priority Tasks

1. Manually test the latest iOS 26 visual polish on iPhone and iPad.
   - Journal: subtle scroll cue below calendar, trades list readable.
   - Stats order: Equity → Dashboard → Radar → Heatmap; no Eval Account block.
   - AI Analytics order: Eval Account → Eval → Coaching → Signal Timeline → Performance Intelligence → Evaluation/Funded → Trader Status.
   - Calendar: no empty top gap, events load without manual refresh button.
   - Achievement share works from Trader Status and respects monthly limits.

2. Verify RevenueCat setup before the next App Store/TestFlight upload.
   - Monthly product: `youtrader_pro_monthly`.
   - Yearly product: `youtrader_pro_yearly`.
   - Both products unlock the same entitlement.
   - Confirm entitlement ID matches env, app code, RevenueCat dashboard, and Supabase Edge Function.
   - Confirm both packages are in the current/default RevenueCat offering.

3. Resolve release/build hygiene.
   - Decide whether to accept or fix the `expo-doctor` non-CNG warning.
   - Do not commit `.ipa` artifacts or backup folders.

4. Deploy/verify Supabase migrations in the target project.

## Unfinished Tasks

- Manual UI QA is still needed after latest screen reordering.
- `App.tsx` remains very large and should eventually be split into `src/components/stats`, `src/components/ai`, and `src/screens`.
- Aikido MCP token may still need re-auth for successful scans.
- `expo-doctor` still has one non-CNG/native-folder warning.

## Next Logical Implementation Order

1. Run the app locally on iPhone simulator.
2. Run the app locally on iPad simulator.
3. Fix any visual/runtime regressions from screen reordering.
4. Verify RevenueCat sandbox purchase/restore for monthly and yearly.
5. Verify Supabase auth and Pro cloud sync when re-enabled.
6. Run:
   - `npm run typecheck`
   - `npx expo-doctor`
7. Only after QA, prepare a clean release build.

## Files That Must Be Edited Next

Most likely:

- `App.tsx` — continue extracting terminal components after QA stabilizes.
- `supabase/migrations/` — verify/deploy runtime schema.
- `src/config/appConfig.ts` — only if RevenueCat env alignment needs changes.

Possible later extraction targets:

- `src/components/stats/`
- `src/components/ai/`
- `src/screens/`

## Possible Risks

- Stats no longer shows Trader Status achievements; they are exposed from AI Analytics/Funded flow.
- Funded mode in AI Analytics uses AsyncStorage key `prop-risk-mode-v1` shared with prop calculator.
- Large `App.tsx` makes regressions easy during UI changes.
- Aikido scan can fail with invalid token until re-authenticated.

## Assumptions That Should NOT Be Changed

- Do not rewrite business logic during visual polish.
- Do not change RevenueCat purchase/restore/pro entitlement logic unless specifically fixing subscription setup.
- Do not expose `NVIDIA_API_KEY` or any private server key in the mobile app.
- Keep NVIDIA behind Supabase Edge Functions with local fallback.
- Keep free users able to see basic working value.
- Keep AI output educational: no financial advice, no buy/sell signals, no market direction prediction.
- Keep visual direction premium Apple/iOS 26/Liquid Glass, not cyberpunk/gamer/crypto/neon.
- Every metric must have one source of truth in `tradeMetrics.ts` / `calcStats()`.

## Market Intelligence Follow-Up (2026-06-28)

- Worker supports scheduled cached jobs for news, prop firms, calendar, daily brief, watchlist, and summary.
- Calendar now falls back to deterministic high-impact macro events when `ECONOMIC_CALENDAR_JSON_URL` is missing or empty.
- GitHub Actions workflow `.github/workflows/market-intelligence.yml` runs the worker without paid hosting.
- News / Market Intelligence screen reads all cached Supabase tables read-only and does not expose worker triggers.
- Required GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `ECONOMIC_CALENDAR_JSON_URL`.
- Next QA: verify scheduled workflow logs in GitHub Actions and confirm Supabase row counts after the first cron run.

## Security Hardening Notes

- Never paste service role keys, private API tokens, Apple signing keys, or full `.env` files into AI chats/prompts.
- Never put `SUPABASE_SERVICE_ROLE_KEY` or private AI keys into `EXPO_PUBLIC_*` env variables.
- Never run destructive database commands against production without human review.
- Never give AI agents unrestricted production access; prefer scoped, reviewed secrets and read-only access where possible.
- Run `npm run security:check` and `npm run typecheck` before release.

## Release Polish Follow-Up (2026-06-29)

- Current release polish was applied incrementally on `/Users/valentynborovyk/Projects/youtrader-final`.
- Do not reintroduce Market Intelligence blocks into the News tab; News should remain readable source-linked headline cards.
- AI Analytics owns cached Market Intelligence plus the consolidated Prop Firm Coach.
- Prop Firm Coach replaces the previous duplicate Eval and Evaluation/Funded blocks in the rendered AI Analytics flow.
- Stats export visuals use `src/components/insights/exportDesign.ts` as the shared branding source.
- Before release, manually QA Share P&L, Save image to Photos, Monthly PDF, News tap-through, AI Analytics Prop Firm Coach, Radar color, Heatmap colors, and Journal scroll cue on device.

## Monetization And Security Follow-Up (2026-06-30)

- Free mode now uses local monthly counters for 31 trades/month, 5 share cards/month, 1 watermarked PDF preview/month, and 3 screenshots/month. Anonymous/local users do not need sign-in.
- Free users get a deterministic First Insight after 5 trades using local analytics only. No paid AI/API call is made.
- Free users can see a non-blocking locked hidden-leaks preview around 7-10 trades; Maybe Later is stored for the month.
- The 31-trade limit blocks only new trade creation for the current month. Existing data, Calendar P&L, Basic Stats, News, Market Intelligence read-only data, and Calculator remain usable.
- RevenueCat monthly product remains `youtrader_pro_monthly` ($12.99/mo) and yearly remains `youtrader_pro_yearly` ($99.99/yr). Both should map to the shared Pro entitlement.
- 3-day trial manual setup required: App Store Connect → Subscriptions → YouTrader Pro monthly product → Introductory Offer → Free Trial → 3 days; RevenueCat → Products/Offerings → refresh products and confirm the monthly package displays trial eligibility. Code does not fake trial entitlement; Apple/RevenueCat controls availability, already-used-trial, cancellation, and return to free mode.
- Added Supabase migration `202606300001_harden_security_function_search_paths.sql` for Security Advisor warnings: explicit function search_path and removed direct anon/authenticated EXECUTE on affected security-definer helpers while preserving service_role access. Apply with `supabase db push` in the target project.


## Production Security Hardening Follow-Up (2026-06-30)

- Edge Function CORS was hardened away from wildcard origins. Configure Supabase Edge Function secret `ALLOWED_ORIGINS` with production app origins before redeploying `ai-coach` and `secure-upload`.
- `scripts/security-check.mjs` now scans additional private-token patterns including GitHub, Slack, RevenueCat webhook secret assignments, generic webhook secrets, and service-role assignments.
- Added `docs/AI_CODING_SECURITY_RULES.md` for AI-agent safety, deny-by-default rules, package hygiene, CORS allowlists, webhook validation, backups, restore tests, and test/prod separation.
- `App.tsx` billing debug logging no longer uses direct `console.log`; it goes through the app logger and remains gated by billing debug mode.
- Existing migration `202606300001_harden_security_function_search_paths.sql` remains the Security Advisor fix for function `search_path` and SECURITY DEFINER execute grants. Apply with `supabase db push` if the target Supabase project has not received it yet.

## Design Review Skill Follow-Up (2026-06-30)

- Added project-level skill `.agents/skills/design-review/SKILL.md`.
- Added `docs/MY_UI.md` as the permanent YouTrader UI source of truth.
- Future UI work must run `frontend-design` thinking first, compare against `docs/MY_UI.md`, then pass the `design-review` checklist before completion.
- Design-review checks premium dark iOS quality, trader-first next action clarity, readable iPhone metrics, spacing, charts, Pro/paywall timing, exports/PDF/share branding, and business-logic preservation.
- This is a review gate only; it does not redesign the app or change Supabase, RevenueCat, GitHub Actions, or security flows.

## UI Export And Journal Polish Follow-Up (2026-06-30)

- Journal calendar selected empty Today cell now uses the YouTrader premium purple accent while green profit days and red loss days keep their semantic colors.
- Journal shows the subtle `Scroll to view trades` cue above the existing gray arrow, and Trades Today appears before First Insight with a single-line title.
- Added a hidden 3-second long-press delete-day flow on logged Journal days/trade cards with haptic feedback and a destructive confirmation modal. It deletes only trades from the selected date through existing local/cloud delete paths.
- AI Analytics UI was cleaned so cached Market Intelligence keeps Daily Brief and Market Summary only; removed Watchlist, Economic Calendar, Prop Firm Monitor, Latest Headlines, and Cost Safety placeholder blocks from that tab.
- Stats Heatmap trade-count text now uses the YouTrader purple accent while P&L green/red remains unchanged.
- Monthly PDF, Share P&L/Save Image, and Achievement/Milestone export cards were polished for premium App Store-ready branding, readable metrics, YouTrader logo placement, App Store CTA, and educational disclaimer.
- Manual iPhone QA still required for long-press timing, Photos save/share sheet sizing, PDF preview readability, and achievement card rendering.

## Production Observability Follow-Up (2026-06-30)

- Added env-gated Sentry crash reporting through `src/observability/monitoring.ts`; the app builds and runs without `EXPO_PUBLIC_SENTRY_DSN`/`SENTRY_DSN`.
- Installed `@sentry/react-native` with Expo SDK 54 compatibility. Source map upload should only be enabled in EAS/CI when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are configured as secrets.
- Connected `posthog-react-native` through `src/lib/posthog.ts` and `src/observability/analytics.ts`; analytics is disabled when no PostHog key exists. Autocapture/session replay remain disabled.
- Added safe product events for app open, trade add/delete, day delete, paywall, purchase/restore/trial, CSV import, AI analysis, exports, news, Market Intelligence, weekly report, and push permission status. Events use metadata/counts only; no notes, screenshots, voice notes, tokens, or full trade payloads.
- Added `src/notifications/push.ts` for Expo notification permission handling, local reminder scheduling, preference storage, and future Expo push token retrieval without storing tokens until backend/RLS storage is designed.
- Added `docs/OBSERVABILITY.md` and `.env.example` placeholders for observability setup.

## App Store Readiness And AI Gateway Follow-Up (2026-06-30)

- Added AI provider abstraction in `supabase/functions/_shared/aiProvider.ts` without changing Supabase schema or AI quota tables.
- `AI_PROVIDER=auto` now tries server-side providers by task tier: OpenRouter/Gemini for cheap fast work and OpenRouter/Anthropic Claude for deeper Pro analysis, with NVIDIA retained as fallback compatibility.
- Required server-only AI secrets are documented: `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDER`, `AI_MODEL_FAST`, and `AI_MODEL_DEEP`. Do not put these in Expo public env.
- React Native Skia is not installed and should remain Phase 2 until compatibility is deliberately tested after App Store submission.
- Added `docs/APP_STORE_RELEASE_CHECKLIST.md` covering TestFlight, RevenueCat, Supabase, Sentry, PostHog, Expo Push, AI providers, privacy, screenshots, subscription paywall, Apple review notes, and manual QA.
- Current release identity remains YouTrader `1.5.7` with iOS build number `69`; do not lower build number because App Store Connect already rejected `67` reuse.

## Final Production Infrastructure Follow-Up (2026-07-02)

- Current App Store baseline is YouTrader `1.5.7` build `72`; do not downgrade.
- Microsoft Clarity was evaluated and not installed in the mobile app. It has an official React Native SDK, but it requires native code/new EAS build and is not appropriate for sensitive journal/session capture without a dedicated privacy review. Use Clarity only for public web/landing pages for now.
- Added `docs/APP_STORE_SERVER_NOTIFICATIONS.md`; subscription backend readiness should prefer RevenueCat webhooks with authorization/HMAC signing, sandbox/production separation, idempotency, and canonical RevenueCat subscriber sync. Direct Apple notifications require signedPayload/JWS verification before state changes.
- Added `docs/AI_PROVIDER_SETUP.md`; AI provider keys remain server-side only in Supabase Edge Function secrets. Client AI goes through `supabase.functions.invoke("ai-coach")` with local fallback when unavailable.
- AI audit found no direct Expo/mobile calls to OpenRouter, Gemini, Anthropic, NVIDIA, or OpenAI provider APIs. `src/api/tradeAnalysis.ts` is deterministic local analysis, not paid AI.

## PostHog Funnels And Sentry QA Follow-Up (2026-07-02)

- PostHog funnel events are wired from real app flows: app open, trade add/delete, day delete, First Insight seen, locked insight seen, paywall viewed, trial/purchase/restore, AI analysis opened, share/PDF exports, news opened, Market Intelligence viewed, and report opened.
- `first_insight_seen` and `locked_insight_seen` fire only when those Journal cards are actually visible; metadata is limited to safe counts/state.
- `paywall_viewed` now also fires for the reusable Pro value modal with safe `screen` and `reason` metadata.
- Added `docs/POSTHOG_FUNNELS.md` with recommended Activation, Monetization, Retention, Export Virality, and News Engagement funnels.
- Added `docs/SENTRY_TESTFLIGHT_QA.md` with DSN/env setup, safe development-only test error guidance, and source-map upload guardrails.
- Keep PostHog autocapture/session replay disabled unless a future privacy review explicitly approves them.

## EAS Update And Context7 Workflow Follow-Up (2026-07-02)

- EAS Update readiness is configured with `runtimeVersion.policy = appVersion`, `updates.url`, and `preview` / `production` EAS build channels.
- Added `docs/EAS_UPDATE_PLAYBOOK.md` with OTA-safe scope, forbidden native/store changes, preview-first workflow, rollback guidance, and command examples.
- OTA updates must be JavaScript/asset/copy/styling safe and must not change native dependencies, permissions, RevenueCat IDs, Supabase schema, or App Store privacy behavior.
- Context7 is already project-configured in `.cursor/mcp.json` as a developer-only MCP command and is not bundled into the mobile app.
- Future Codex/Cursor prompts should say: "Use Context7 before changing code that touches Expo, React Native, Supabase, RevenueCat, Sentry, PostHog, EAS, or Apple APIs."
