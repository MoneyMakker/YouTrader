# Staging Candidate — 1.6.1 (113) Prop Pass Internal TestFlight

**Status:** READY FOR REVIEW — **STOP** for Product Owner **FINAL UPLOAD** approval  
**Starting commit:** `9ff2717` (`chore(release): prepare 1.6.1 build 112 staging candidate`)  
**Candidate type:** Internal TestFlight **staging** (Prop Pass / Prop OS allowlist)  
**Supersedes:** build **112** staging archive — **do not upload 112**

## Required outcome

```text
Internal TestFlight allowlisted user
→ authenticates against remote staging Supabase
→ Prop Pass appears in navigation
→ challenge + assignment + recalc + PI complete
→ Performance Intelligence internal panel resolves
```

## Identity

| Field | Value |
|-------|-------|
| Marketing version | `1.6.1` |
| iOS build | **113** |
| Bundle ID | `com.youtrader.pro` |
| Team | `L6M4U8G8RC` |

## Xcode

| Field | Value |
|-------|-------|
| Workspace | `ios/YouTrader.xcworkspace` |
| Scheme | `YouTrader-Staging` |
| Configuration | `Release-Staging` |
| Destination | generic iOS Device (arm64) |
| Action | `xcodebuild archive` (not EAS) |
| Export | `app-store-connect`, automatic signing |

## Artifacts

| Artifact | Path |
|----------|------|
| xcarchive | `build/YouTrader-1.6.1-113-staging.xcarchive` |
| IPA | `build/YouTrader-1.6.1-113-staging.ipa` (~28 MB) |
| Export dir | `build/YouTrader-1.6.1-113-staging-export/` |

Resolved from IPA:

- `CFBundleShortVersionString` = **1.6.1**
- `CFBundleVersion` = **113**
- Bundle ID = **com.youtrader.pro**
- Signing = **Apple Distribution: BOROVIK GROUP INC (L6M4U8G8RC)**
- Profile = iOS Team Store Provisioning Profile: `com.youtrader.pro`
- `get-task-allow` = **false**
- `beta-reports-active` = **true**
- `aps-environment` = **ABSENT** (no push entitlement in this profile; exact result)
- Privacy manifests present (25) + Lottie privacy bundles present

## Staging runtime (from IPA `main.jsbundle`)

| Check | Result |
|-------|--------|
| Staging host `zleojeqkzizeyerhjpur.supabase.co` | **present** |
| Production host `izzrlsgumyabdvlmwlwn` | **absent** |
| Activation mode string `staging_preview` | **present** |
| Bundled JWT role | **anon** only (publishable) |
| Processor secret / service_role JWT | **absent** |
| RevenueCat public SDK key `appl_…` | **present** |
| RevenueCat secret / `sk_live` | **absent** |
| Google URL scheme | present in Info.plist |

## Processors (staging only)

| Function | Project | Version | Status | verify_jwt |
|----------|---------|---------|--------|------------|
| `prop-os-recalc-processor` | `zleojeqkzizeyerhjpur` | 4 | ACTIVE | false (trusted header / service role) |
| `prop-os-pi-processor` | `zleojeqkzizeyerhjpur` | 4 | ACTIVE | false (trusted header / service role) |

## Remote vertical slice

Script: `scripts/prop-pass-staging-full-vertical-slice.ts` — all gates **PASS**.

Redacted IDs from final proof run:

| Object | Redacted ID / status |
|--------|----------------------|
| user | `41abedc1…` |
| account | `b882627b…` |
| challenge | `9c93ffd6…` |
| rule snapshot | `5a4c90a6…` |
| trade | `stg-tf-17854…` |
| assignment revision | `4` |
| recalc request | `recalc-83d52…` → **completed** |
| engine snapshot | `45e5cf9c…` |
| score snapshot | `419e52c3…` |
| PI request | `97278ba7…` |
| PI snapshot / current | `4d2bb13a…` |
| PI status | `insufficient_data` (thin fixture; projection resolved) |
| findings | `1` |

## Confirmations

- Production Supabase not migrated / Prop OS schema not applied (only legacy `prop_firms` / `prop_firm_updates` catalog tables exist).
- Build **112** was **not** uploaded.
- Build **113** was **not** uploaded.
- No App Store submission.
- Pass Probability / Discipline Streak / Decision Replay / Smart Intervention / AI explanations / brokers **not** started.

**Waiting for:** Product Owner **FINAL UPLOAD** approval.
