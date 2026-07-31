# YouTrader 3.0 — Device Regression Audit

**Date:** 2026-07-31  
**Branch:** `fix/yt3-device-regression-recovery`  
**Safety tag:** `yt3-broken-113-head-6500391` → `6500391`  
**Broken product surface:** physical iPhone screenshots of Release-Staging **1.6.1 (113)** + uncommitted Phase 4 WIP  
**Phase 4F:** **FAILED / NO-GO** (not PARTIAL PASS)

Source of truth: physical-device screenshots. Code/logs are supporting evidence only.

---

## Last known-good product baseline

| Surface | Last known-good | Notes |
| --- | --- | --- |
| Apple CTA visible on iOS | Parent of `d1395e0` = **`a8b10e0`** | `showApple={Platform.OS === "ios"}` via `enableNativeAppleSignIn = ios && supabaseConfigured` |
| SafeArea / no black screen | **`a8b10e0`** | Must preserve |
| Embed fail-closed Release-Staging | **`e009c5a`** | Must preserve |
| QA cred hygiene | **`6500391`** | Must preserve |
| Google CTA | Depends on baked `EXPO_PUBLIC_GOOGLE_*` client IDs | Gate predates `d1395e0` |
| Product Onboarding → Paywall → Auth | **Never implemented** as first-launch state machine in this mobile shell | Gap, not a single regressing commit |
| Readable legacy dark terminal | Pre–Phase-4 WIP shell | Uncommitted YDL shell + palette bridge introduced device-visible regressions |

Do **not** `git reset --hard`. Recovery restores behavior incrementally on this branch.

---

## R1 — Apple Sign-In disappeared / fails on staging

| Field | Detail |
| --- | --- |
| Symptom | No Apple button, or button present then fails |
| Root cause A | Commit **`d1395e0`** hides Apple on staging-like env unless `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN=true` (`src/config/appConfig.ts`) |
| Root cause B | Staging Supabase Auth: Apple provider **disabled** (`provider_disabled` on `/token` id_token) — documented in `APPLE_SIGNIN_STAGING.md` |
| Root cause C | `ios/.xcode.env.staging` keeps the opt-in flag **commented out** |
| Affected files | `src/config/appConfig.ts`, `src/app/YouTraderApp.tsx`, `src/auth/appleSignIn.ts`, `ios/.xcode.env.staging` (gitignored), staging Supabase Auth providers |
| Safe recovery | Enable Apple provider on **staging** project only; set opt-in for Release-Staging builds; keep button visible once provider works; do not silently hide on missing config |
| Security | Do not touch production Supabase. No secrets in repo. |
| Test | Physical: Apple sheet → session → cold relaunch → logout → Apple again |

---

## R2 — Google Sign-In disappeared / unreliable

| Field | Detail |
| --- | --- |
| Symptom | Google button missing or flow broken |
| Root cause | `enableNativeGoogleSignIn` requires both `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (non-placeholder, `*.apps.googleusercontent.com`). Staging env currently points both at the **same** client ID — may be wrong OAuth client type pairing |
| Affected files | `src/config/appConfig.ts`, `src/auth/googleSignIn.ts`, `ios/.xcode.env.staging`, URL schemes / reversed client ID in iOS project |
| Safe recovery | Verify distinct Web + iOS OAuth clients for `com.youtrader.pro`; ensure reverse client ID URL type; rebuild Release-Staging with env sourced; physical E2E |
| Security | Do not commit client secrets. Publishable OAuth client IDs only. |
| Test | Physical Google login / cold relaunch / logout / re-login |

---

## R3 — New user dropped into empty Journal (acquisition funnel missing)

| Field | Detail |
| --- | --- |
| Symptom | Fresh install skips Onboarding → Paywall → Registration |
| Root cause | No first-launch state machine. Startup shows Auth only when Supabase configured + signed out (`YouTraderApp.tsx` ~11390). Otherwise default tab `journal`. Post-auth paywall uses **device-global** key `yt-post-auth-paywall-seen-v1` (not per-user) |
| Affected files | `src/app/YouTraderApp.tsx`, monetization/paywall UI, new startup module (to add) |
| Safe recovery | Explicit startup state machine: onboarding → paywall → auth → main; skip onboarding for completed users; skip unnecessary paywall for entitled users; per-user keys; RevenueCat anonymous → identify on auth without purchase loss |
| Security | Medium monetization risk if funnel bypassed; fix global AsyncStorage key leakage across accounts |
| Test | Fresh install matrix + returning entitled user + returning free authenticated user |

---

## R4 — Dark text / near-invisible headings (contrast)

| Field | Detail |
| --- | --- |
| Symptom | Dark-on-dark, disabled-looking controls |
| Root cause | Phase 4 WIP: forced dark AppShell/tab bar vs components calling `useYdlTheme()` without `"dark"`; `text.inverse` (`#000`) risk on black surfaces; Auth hard-codes `#000` while bridging graphite palette; legacy screens still on mixed `C.*` / premium tokens |
| Affected files | `src/ydl/tokens/color.semantic.ts`, `src/ydl/shell/YdlTabBar.tsx`, `src/propPass/*`, `src/auth/AuthScreen.tsx`, `src/theme/colors.ts`, screen StyleSheets |
| Safe recovery | Semantic token map (background/surface/text/accent/tab*); force dark theme for production shell; ban inverse text on primary background; restore readable legacy contrast first, then intentional YDL |
| Security | None (a11y) |
| Test | Physical screenshots of Auth + each primary tab |

---

## R5 — Journal still says “AI coaching”

| Field | Detail |
| --- | --- |
| Symptom | Empty Journal copy references AI coaching after AI Analytics removal |
| Root cause | Stale i18n + Journal empty state still uses those keys (`YouTraderApp.tsx` ~7785; `en.json` and locales) |
| Affected files | `src/i18n/locales/*.json`, Journal empty-state render in `YouTraderApp.tsx` |
| Safe recovery | Replace copy across all locales; Prop Pass is the improvement path, not AI Analytics |
| Security | None |
| Test | translations:check + physical Journal empty state |

---

## R6 — Prop Pass tab shows “Activation is off or this environment is not eligible”

| Field | Detail |
| --- | --- |
| Symptom | Placeholder unavailable card; no challenge/buffers/PI |
| Root cause A | Tab always mounted, but `usePropPassAvailability` → `disabled` when entry not visible (`PropPassInternalScreen.tsx`) |
| Root cause B | Entry needs staging env + mode `staging_preview`/`internal_read_only` + allowlist + userId + kill switch off (`access.ts`). If JS bundle baked without env, or signed-in user ≠ allowlist UUID, UI stays disabled |
| Root cause C | Assignment flow uses empty memory store / `currentAssignment: null`; PI remote store wired but revision often `0` from memory fallback |
| Affected files | `src/propPass/access.ts`, `PropPassInternalScreen.tsx`, `PropPassAssignmentFlow.tsx`, `mapViewModel.ts`, `gatewayClient.ts`, build env wiring |
| Safe recovery | Hide tab until eligibility known + allowlisted; for allowlisted load remote snapshots; wire assignment read store; fix PI revision; keep RLS / immutability / processor isolation |
| Security | Do not bypass server allowlist/RLS. Hide tab for non-allowlisted (product rule) |
| Test | Allowlisted: real data. Non-allowlisted: tab hidden. Logout/login switch |

---

## R7 — Prop Pass always in tab bar (non-allowlisted disclosure)

| Field | Detail |
| --- | --- |
| Symptom | Everyone sees Prop Pass tab; ineligible see “unavailable” |
| Root cause | Uncommitted Phase 4B: `tabs` always includes `propPass` |
| Affected files | `src/app/YouTraderApp.tsx` |
| Safe recovery | Build tabs after auth+eligibility resolved; no flash; clear Prop Pass cache on logout |
| Security | Medium disclosure of internal feature |
| Test | Non-allowlisted physical login |

---

## R8 — YDL “redesign” is shell-only; core screens still legacy / worse

| Field | Detail |
| --- | --- |
| Symptom | Product looks worse than previous working version |
| Root cause | YDL applied to tab chrome / Prop Pass / Auth bridge; Journal/Stats/Calc/News/Calendar/Settings largely untouched or inconsistently themed |
| Safe recovery | Restore readable core screens; apply YDL intentionally per screen; no generic placeholder cards |
| Security | None |
| Test | Physical per-screen interaction |

---

## Preserved fixes (do not regress)

- `a8b10e0` SafeArea black-screen  
- `e009c5a` embed fail-closed  
- `6500391` QA credentials out of scripts  
- Prop OS RLS, immutable snapshots, processor isolation, direct-DML denial, stale-write protection  

## Correct (do not keep as product policy)

- `d1395e0` silent hide of Apple on staging — repair provider + show working CTA  

## Build policy

- Stay on **113**  
- No archive/upload **114**  
- No production Supabase changes  
- Metro OFF for Release-Staging device QA  

---

## Recovery execution order

1. Audit + safety baseline (this doc)  
2. Startup funnel state machine  
3. Apple + Google auth E2E (staging provider + app config)  
4. YDL semantic contrast  
5. Core screen readability  
6. Prop Pass eligibility + remote data  
7. Conditional tabs  
8. Physical QA evidence — only then reconsider Phase 4F  
