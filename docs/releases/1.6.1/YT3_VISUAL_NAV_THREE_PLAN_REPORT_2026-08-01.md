# YT3 Visual + Navigation + Three-Plan Progress — 2026-08-01

Build: **113** (`1.6.1`). Phase 4F: **FAILED / OPEN / NO-GO**. No build 114. Production Supabase untouched.

## Commits this session

| Commit | Scope |
|---|---|
| `fbe7b03` | YT3-NAV-1 — Settings primary dock tab; More without Settings; guards |
| `333ccca` | YT3-VIS-1 — Onboarding Screens 1–4 premium visuals + paywall selection UX |
| (pending) | YT3-QA-1 — skip RC logOut when anonymous (LogBox blocker) |

## 1–2. Final navigation contract (code)

Eligible (≤5):

1. Journal  
2. Prop Pass (gated)  
3. Stats  
4. **Settings** (gear)  
5. More  

Deny (≤4):

1. Journal  
2. Stats  
3. **Settings**  
4. More  

Calendar remains in More only. Settings removed from More hub.  
Selftests: `bottomNavContract.selftest.ts` PASS · `forbiddenUnlockCopy.selftest.ts` PASS.

## 3–8. Visual evidence (Pro Max simulator)

| Item | File | Result |
|---|---|---|
| Screen 1 upgraded hero | `first-launch-evidence/vis_01_screen1.png` | **PASS** (chaos/structure chart + MES/+420 + Daily Risk) |
| Screen 2 profile + market cards | `vis_02_screen2_profile.png` | **PASS** (live Your Profile card + market tiles) |
| Screen 3 product previews | — | **PARTIAL** — LogBox RC logout error covered capture; UI implemented |
| Screen 4 workspace assembly | — | **PARTIAL** — same LogBox interference; UI implemented |
| Paywall hero + chips | `vis_05_paywall_live.png` | **PASS** (new IA) |
| Monthly selected | `vis_05_monthly.png` | **PASS** |
| Yearly selected | `vis_05_yearly.png` | **PASS** |
| Weekly selected | — | **FAIL** — Weekly package not returned by offerings/products |
| Offerings unavailable | earlier `paid_05_paywall.png` | known error shell (not normal paywall) |

## 9–14. RevenueCat package status

| Package | Local StoreKit | App constants | Resolved on sim paywall |
|---|---|---|---|
| Weekly `youtrader_pro_weekly` $4.99 | PASS | PASS | **FAIL / missing** |
| Monthly `youtrader_pro_monthly` $12.99 | PASS | PASS | **PASS** |
| Yearly `youtrader_pro_yearly__` $99.99 + intro in StoreKit | PASS | PASS | **PASS** (trial badge only when StoreKit intro resolves) |

### Offerings unavailable / missing Weekly — root cause

Honest runtime: Monthly + Yearly resolve; Weekly does not.

Most likely:

1. RevenueCat **default offering** for the staging iOS API key does not include a Weekly package yet.  
2. Maestro/`simctl` launches often **do not attach** the Xcode StoreKit Testing session, so `getProducts([weekly…])` cannot invent Weekly from ASC if Weekly is not live in App Store Connect / RC.  
3. Repo StoreKit file **does** define Weekly; scheme links it — Xcode Run required for local three-product StoreKit session.

App correctly refuses to fake purchasable Weekly cards when the package/product is absent.

## 15–16. CustomerInfo / purchase E2E

**PENDING** — not re-run this session after visual work. Prior Phase 4F purchase/CustomerInfo remains open.

## 17–19. Device matrix

| Device | Result |
|---|---|
| iPhone 17 Pro Max sim (booted) | Visual capture executed (this session) |
| iPhone 16 / 16e | **PENDING** |
| Physical iPhone on build 113 | **PENDING** (do not use 114) |

## 20. Remaining Phase 4F blockers (unchanged NO-GO)

- Weekly RC package + three-plan successful matrix  
- Google OAuth E2E  
- Apple Sign-In E2E  
- CustomerInfo / entitlement isolation proofs  
- Physical 113 validation  
- PI retry / News offline / Settings isolation leftovers as previously tracked  
- LogBox / RC anonymous logOut noise during QA reset (fix landed; needs Metro reload proof)

## QA gates run

- `npm run typecheck` PASS  
- `npm run translations:check` PASS  
- `npx tsx scripts/qa/bottomNavContract.selftest.ts` PASS  
- `npx tsx scripts/qa/forbiddenUnlockCopy.selftest.ts` PASS  
- Aikido MCP: **unavailable** this environment  
- `expo export --platform ios`: not re-run this slice (prior session had PASS)

## Waiting for

1. RevenueCat dashboard: add Weekly to default offering + entitlement YouTrader Pro.  
2. Product Owner review of Settings dock + visual Screens 1–2.  
3. Physical 113 + Xcode StoreKit session for full three-plan purchase proof.
