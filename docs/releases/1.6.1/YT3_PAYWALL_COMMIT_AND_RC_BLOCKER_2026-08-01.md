# Commit group + RC blocker continuation — 2026-08-01

Build: **1.6.1 (113)** unchanged. Phase 4F: **FAILED / OPEN / NO-GO**. No build 114. Production Supabase untouched.

## Commits (paywall group)

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | `73f9a02` | feat(paywall): add final three-plan dynamic subscription UI | `AcquisitionPaywall.tsx`, `paywallPlanCopy.ts` |
| 2 | `55417c9` | feat(subscriptions): add weekly monthly yearly trial-aware contracts | `trialEligibility.ts`, `trialEligibility.selftest.ts`, `ios/YouTraderStaging.storekit`, `ios/YTStoreKitQA/**/YouTraderStaging.storekit` |
| 3 | `17cbb93` | feat(auth): enforce sign-in after subscription activation | `src/i18n/locales/{en,de,es,fr,it,ru,uk}.json` (`authHeadline` title case) |
| 4 | `d1b8bb6` | feat(settings): show active plan trial and renewal state | `settingsSubscriptionPresentation.ts`, `YouTraderApp.tsx` |
| 5 | `37e928d` | test(paywall): add subscription copy and routing regression guards | `paywallPlanCopy.selftest.ts`, `settingsSubscriptionPresentation.selftest.ts`, `YT3_PAYWALL_FINAL_COPY_PROGRESS_2026-08-01.md` |

## Post-commit QA

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run translations:check` | PASS |
| `paywallPlanCopy.selftest` | PASS |
| `trialEligibility.selftest` | PASS |
| `settingsSubscriptionPresentation.selftest` | PASS |
| `forbiddenFreeAccessCopy.selftest` | PASS |
| `forbiddenAiCopy.selftest` | PASS |
| StoreKit committed contract (W none / M P3D / Y P1W) | PASS |
| selected-package routing source guard | PASS |
| `npx expo export --platform ios` | PASS |
| staging host in `.env` / `.env.local` | PASS (`zleojeqkzizeyerhjpur`) |
| production host absent from local env | PASS |
| build number 113 | PASS |
| credential scan (no secrets/token files in commits) | PASS |
| dedicated selected-package / StoreKit Jest suites | NOT FOUND (covered by selftests + source/StoreKit guards) |

## Live RevenueCat default offering audit (staging `appl_` key)

```text
offering: default
packages:
  $rc_monthly → youtrader_pro_monthly
  $rc_annual  → youtrader_pro_yearly__
package_count: 2
weekly_in_offering: false
```

| Gate | Status |
|------|--------|
| REVENUECAT PACKAGE (Weekly) | **EXTERNAL BLOCKER / FAIL** |
| Monthly + Annual in default offering | PASS |
| TRIAL ELIGIBILITY live ASC/RC | NOT RUN (needs StoreKit session + purchases) |
| CUSTOMERINFO after purchase | NOT RUN |
| AUTH LINK Apple/Google/Email | NOT RUN |
| Screenshot matrix | NOT RUN (simctl blocked in agent sandbox; Weekly missing) |
| PHYSICAL | NOT RUN |
| Phase 4F | **FAILED / OPEN / NO-GO** |

## Required human / dashboard action

RevenueCat project for staging iOS public key:

1. Ensure product `youtrader_pro_weekly` exists and is attached to entitlement **YouTrader Pro**.
2. Add Weekly package to offering `default` (`$rc_weekly` or custom → `youtrader_pro_weekly`).
3. Confirm App Store Connect intro offers: Weekly none, Monthly 3-day free, Yearly 7-day free.
4. Provide a RevenueCat **v2 secret API key** (or dashboard access) if agent must mutate offerings via API. Public `appl_` key cannot add packages.

Agent cannot complete Weekly offering resolution without dashboard or secret key. Do not fake Weekly packages in the client.

## Intentionally excluded WIP

Uncommitted recovery / AI / UI / supabase-function / screenshot / credential WIP preserved (not staged), including:

- `SIM_EMAIL_PASSWORD_UNIT.txt` (credentials — never commit)
- Auth modal spinner swap, Google client-id pair hardening, AI edge functions, stats UI, `.codex/`, `build/`, phase4f screenshot dumps, `eas.json` / `appConfig` unrelated diffs
