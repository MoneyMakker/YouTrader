# YT3 Recovery Continuation — Session 6 (2026-07-31)

Phase 4F remains **FAILED / OPEN / NO-GO**. Build stays **113**. Production Supabase untouched.

## Executed results (requested matrix)

| # | Item | Status |
|---|------|--------|
| 1 | Google OAuth architecture + iOS client | **PARTIAL** — native gated on distinct iOS client; **browser OAuth fallback active**; no `gcloud` to create iOS client |
| 2 | Google Supabase session E2E | **PARTIAL** — logout → Auth CTAs → Google opens account UI **without Error 400**; full consent→session→RC link still needs interactive Google account |
| 3 | Apple native/token architecture | **PASS (architecture)** — Path A: `expo-apple-authentication` → `signInWithIdToken` + nonce; **no web OAuth `.p8` required for this path** |
| 4 | Apple `.p8` / secret | **N/A for native path**; `.p8` not found locally; Management API auth-config write historically 403 |
| 5 | Monthly RC CustomerInfo after StoreKit | **NOT RUN** (StoreKit txn PASS on iOS 18.5; in-app CustomerInfo after purchase still open) |
| 6 | Yearly RC CustomerInfo | **NOT RUN** (same) |
| 7 | Entitlement restore / user isolation | **NOT RUN** |
| 8 | Journal edit/delete | **PARTIAL** — seed deep link works; form create blocked by Maestro↔RN TextInput; edit save observed (`Trade saved`) in hierarchy; full delete matrix in progress |
| 9 | Calculator UI | **PARTIAL** — prior happy-path evidence; full matrix NOT RUN this session |
| 10 | News offline/Retry | **NOT RUN** |
| 11 | Calendar mutation/timezone | **NOT RUN** (seed P&L day sync observed visually) |
| 12 | Settings restore/user switch | **NOT RUN** (logout previously PASS) |
| 13 | PI timeout deployment + matrix | **PARTIAL** — unit `pi-timeout-reaper-qa` PASS; staging Edge functions ACTIVE; `PROP_OS_PROCESSOR_SHARED_SECRET` present via `supabase secrets list`; full live matrix NOT RUN |
| 14 | expo export | **PASS** — staging host in HBC; build **1.6.1 / 113**; prod ref only as quarantine marker string |
| 15 | 5 physical cold launches | **PASS** — `physical_cold5_ok` |
| 16 | Remaining external blockers | See below |

## Code changes this session

1. **Google:** `enableNativeGoogleSignIn` requires distinct Web+iOS client IDs; otherwise browser OAuth. Auth CTA always shows Google. QA banner updated.
2. **Journal save:** debounce timestamp only after successful validation; removed misleading `accessibilityRole="summary"` / duplicate Save label on wrapper; `testID="journal-save-trade"`.
3. **QA:** `youtrader://qa/seed-trade` staging-only seed (`src/qa/stagingQaJournalSeed.ts`) for edit/delete automation when Maestro cannot drive RN `TextInput` `onChangeText`.
4. Maestro flows updated under `.maestro/yt3/*_s6*.yaml`.

## Findings

### Google (config failure, not yet fully EXTERNAL)

- Architecture: **native Google Sign-In + `signInWithIdToken`** when distinct iOS client exists; else **browser OAuth** (`signInWithOAuth` + `WebBrowser.openAuthSessionAsync`).
- Staging `.env*` still has **identical** Web and iOS client IDs (WEB type) → previous Error 400.
- **Cannot auto-create iOS OAuth client:** no `gcloud`/`firebase` CLI; EAS env has no Google client secrets; Chrome login DB present but unused.
- EXTERNAL only if Cloud Console permission remains unavailable after installing authenticated Google tooling.

### Apple

- Confirmed Path A (native identity token). Empty provider secret is **not** proof native Apple cannot work.
- Sim E2E still needs usable Apple ID / physical device for session proof.
- `.p8` discovery: none in project/Keychain AuthKey files.

### Journal

- Root cause of “Save does nothing” for Maestro create: **RN TextInput does not receive Maestro `inputText` into React state** → Alert `Add P&L or entry/exit prices` (often missed by brittle asserts).
- Secondary: wrapper a11y stole Save taps (fixed).
- Seed trade + open edit works; Month P&L updates with seeds.

### RevenueCat CustomerInfo

- Static mapping PASS; StoreKit monthly/yearly txn PASS on iOS 18.5.
- Still need YouTrader-Staging scheme launch with StoreKit config → purchasePackage → CustomerInfo entitlement.

### PI

- SQL/unit PASS; Edge `prop-os-pi-processor` v5 ACTIVE on staging.
- Secrets list succeeds (CLI); earlier 403 was Management API auth-config class, not secrets list.

### Bundle / physical

- `expo export --platform ios` PASS; typecheck PASS; translations PASS.
- Physical cold ×5 PASS on `6FCFF771-…` (iPhone 4S / 14 Pro Max).

## Remaining EXTERNAL / OPEN blockers

1. **Distinct Google iOS OAuth client** in Google Cloud for `com.youtrader.pro` (+ reverse scheme / env) — tooling not present to create automatically.
2. **Apple E2E session** on device (architecture unblocked; system auth + staging Client IDs still to prove).
3. **RC CustomerInfo after local StoreKit** inside full app (not YTStoreKitQA alone).
4. **Maestro RN TextInput** for true form create path (seed is staging workaround).
5. News / Calendar / Settings full matrices; PI live timeout/Retry E2E.
6. Aikido MCP scan: **auth invalid token** this session.

## Do not

- Prepare build 114
- Touch production Supabase
