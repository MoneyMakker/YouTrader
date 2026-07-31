# Staging Candidate — 1.6.1 (112) Prop Pass Internal TestFlight

**Status:** READY FOR REVIEW — **STOP** for Product Owner **FINAL UPLOAD** approval  
**Starting commit:** `86a13ca` (`fix(release): validate 1.6.1 build 112 archive`)  
**Candidate type:** Internal TestFlight **staging** (Prop Pass / Prop OS allowlist)  
**Supersedes:** production-configured archive from `86a13ca` (`build/YouTrader-1.6.1-112.xcarchive`) — **do not upload that archive**

## Required outcome

```text
Internal TestFlight user
→ authenticates against remote staging Supabase
→ passes server-side allowlist
→ Prop OS feature flag resolves enabled (staging_preview)
→ Prop Pass appears in navigation
→ Performance Intelligence internal UI is accessible
```

## Identity (unchanged)

| Field | Value |
|-------|-------|
| Marketing version | `1.6.1` |
| iOS build | `112` (not incremented) |
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

Production scheme `YouTrader` still Archives with `Release`. Verified by `scripts/verify-production-staging-separation.mjs`.

CocoaPods: `Release-Staging` mapped to `:release` in `ios/Podfile` so module maps resolve under `Release-Staging-iphoneos`.

## Artifacts

| Artifact | Path |
|----------|------|
| xcarchive | `build/YouTrader-1.6.1-112-staging.xcarchive` |
| IPA | `build/YouTrader-1.6.1-112-staging.ipa` (~28 MB) |
| Export dir | `build/YouTrader-1.6.1-112-staging-export/` |

Resolved from IPA:

- `CFBundleShortVersionString` = **1.6.1**
- `CFBundleVersion` = **112**
- Bundle ID = **com.youtrader.pro**
- Signing = **Apple Distribution: BOROVIK GROUP INC (L6M4U8G8RC)**
- Profile = iOS Team Store Provisioning Profile: `com.youtrader.pro`
- `get-task-allow` = **false**
- `beta-reports-active` = **true**
- Privacy manifests + Lottie privacy bundles present

## Staging runtime configuration

Effective (via gitignored `ios/.xcode.env.staging`, sourced only when `$CONFIGURATION` contains `Staging`):

| Variable | Value |
|----------|-------|
| `APP_ENV` / `EXPO_PUBLIC_APP_ENV` | `staging` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://zleojeqkzizeyerhjpur.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging anon (not committed) |
| `EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE` | `staging_preview` (repo canonical mode; not the non-existent `allowlist` mode name) |
| `EXPO_PUBLIC_PROP_OS_ALLOWLIST` | staging allowlisted user UUID (gitignored) |
| RevenueCat | approved public SDK keys (same as production public config) |

Example template: `ios/.xcode.env.staging.example` (committed, no secrets).

### Production remains safe

| Check | Result |
|-------|--------|
| Production scheme Archive config | `Release` |
| Production Prop OS activation | `off` (no staging env loaded) |
| Production Supabase | `izzrlsgumyabdvlmwlwn` (unchanged; **0** Prop OS tables / **0** `20260730*` migrations) |
| Production DB migrations this session | **none** |

## Remote staging Supabase

| Field | Redacted value |
|-------|----------------|
| Project name | YouTrader Staging |
| Project ref | `zleojeqkzizeyerhjpur` |
| Host | `https://zleojeqkzizeyerhjpur.supabase.co` |
| Region | `us-east-2` |
| Status | ACTIVE_HEALTHY |

Not used: localhost, production project, local Mac DB.

### Migrations (staging only)

All local migrations through Phase 3A remediation applied via `supabase db push --linked` after history repair of MCP timestamp stamps:

- Foundation → AI quota → Prop OS Phase 0–3A remediation (`20260730190000` … `20260730280000`)
- Migration history clean (23 versions aligned)
- Prop OS tables present (25 `prop_*` tables); processor roles exist

### Processors (staging only)

Deployed Edge Functions (credentials never in client):

| Function | Role isolation |
|----------|----------------|
| `prop-os-recalc-processor` | Completes/fails assignment recalculation; uses service_role membership of `prop_os_recalc_processor` |
| `prop-os-pi-processor` | Completes/fails PI; uses `prop_os_performance_intelligence_processor` |

Server secret: `PROP_OS_PROCESSOR_SHARED_SECRET` (Supabase secrets; not in IPA).

Privilege matrix on staging (EXECUTE):

| RPC | authenticated | recalc processor | PI processor | service_role |
|-----|---------------|------------------|--------------|--------------|
| `prop_os_cmd_complete_recalculation` | no | yes | no | yes |
| `prop_os_cmd_complete_performance_intelligence` | no | no | yes | yes |

Verified: anon → processors **403**; service JWT / shared secret → **200** ping.

### Auth + allowlist

| Account | Redacted id | Result |
|---------|-------------|--------|
| Allowlisted email user | `41abedc1…8a02` | Server `prop_os_command_allowlist` + client `EXPO_PUBLIC_PROP_OS_ALLOWLIST`; commands enabled |
| Non-allowlisted email user | `27d72b29…49f3` | `create_account` → `forbidden`; foreign account reads empty |

Google: iOS URL scheme `com.googleusercontent.apps.423302595080-…` present in IPA Info.plist. Staging Site URL / Google provider dashboard wiring should be confirmed in Supabase Auth UI before device Google sign-in QA (email auth verified remotely).

## Navigation / activation (app)

`resolvePropPassAccess` / `isPropPassEntryVisible` require authenticated `userId` **and** `peek.eligible === true` so Prop Pass does not flash for ineligible users.

Staging scheme: `staging_preview` + allowlist.  
Production scheme: entry hidden / activation off.

## Remote staging vertical slice

Script: `scripts/prop-pass-staging-remote-slice.mjs` (credentials via env only).

| Step | Result |
|------|--------|
| Allowlisted sign-in | PASS |
| Non-allowlisted create denied | PASS |
| Account created | PASS |
| Challenge created | PASS |
| Journal trade seeded (owner JWT) | PASS |
| Assign trades → revision 1 | PASS |
| Recalc job queued | PASS (`prop_os_challenge_recalc.state=queued`) |
| Processor ping / anon deny | PASS |
| Non-allowlisted foreign read deny | PASS |
| Trusted recalc → engine/score current + PI publish | **PARTIAL** — queue proven; full snapshot publish not completed in this session (processor complete path ready; needs follow-up processor run against queued revision) |

## Archive scans

| Scan | Result |
|------|--------|
| Staging host in bundle | present (`zleojeqkzizeyerhjpur.supabase.co`) |
| Production host in active config | absent |
| Activation mode | `staging_preview` embedded |
| `http://localhost` as runtime API | absent as endpoint; Hermes/diagnostic strings may mention localhost |
| Service-role / `sb_secret_` / processor shared secret | not bundled as env |
| RevenueCat secret | absent |
| Google URL scheme | present |

## Regression matrix (executed)

| Suite | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run translations:check` | PASS |
| `npm run release:stability` | PASS |
| `verify-production-staging-separation` | PASS |
| `test:prop-os-activation` | PASS |
| `test:prop-pass-phase2a` | PASS |
| `test:prop-pass-phase2b` | PASS |
| `test:prop-pass-phase2c` | PASS |
| `test:prop-pass-phase3a` | PASS |
| `test:prop-pass-phase2b-hardening-static` | PASS |
| `test:prop-os-activation-secrets` | PASS |
| Local PG Phase 2A/2B/2C/3A live | **SKIP** — localhost:55432 not running |
| Archive / IPA inspect | PASS |
| Staging remote slice | PASS (with PI/recalc publish partial) |

## Configuration files changed (repo)

- `ios/YouTrader.xcodeproj/project.pbxproj` — `Release-Staging`
- `ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader-Staging.xcscheme`
- `ios/.xcode.env.staging.example`
- `ios/Podfile` (+ lock) — Release-Staging → release mapping
- `.gitignore` — ignore staging env files
- `scripts/verify-production-staging-separation.mjs`
- `scripts/prop-pass-staging-remote-slice.mjs`
- `scripts/prop-pass-phase2a-qa.ts`
- `src/propPass/access.ts`, `usePropPassAvailability.ts`
- `src/app/YouTraderApp.tsx` — pass `session?.user?.id`
- `supabase/functions/prop-os-recalc-processor/`
- `supabase/functions/prop-os-pi-processor/`
- `docs/releases/1.6.1/STAGING_CANDIDATE.md` (this file)

Not committed: `ios/.xcode.env.staging`, API keys, processor shared secret, build artifacts.

## Confirmations

- Production database **untouched** by Prop OS migrations
- Previous production-configured archive **not uploaded**
- **No** TestFlight upload this session
- **No** App Store submission
- Later roadmap phases **not started** (Pass Probability, Discipline Streak UX, Decision Replay, Smart Intervention, AI explanations, brokers)

## Remaining warnings

1. Complete trusted recalc + PI snapshot publish against queued staging revision before device PI panel QA.
2. Confirm staging Supabase Auth Google provider + redirect allow-list (no localhost) in dashboard.
3. Map the real Internal TestFlight Apple/Google user UUID into allowlist when that identity exists on staging (current QA users are email fixtures).
4. Local Postgres assertion suites skipped (port 55432 down).
5. Free-tier: prior PR Agent project was paused to create staging; restore if still needed.
6. Archive xcarchive app may show Development identity before export; **IPA** is Apple Distribution.

## Waiting for

**Product Owner approval** before uploading `build/YouTrader-1.6.1-112-staging.ipa` to the App Store Connect **Internal Testing** group only.
