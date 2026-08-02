# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **OPEN / NO-GO**

## Freeze compliance

- No App Store screenshots deleted/replaced/uploaded
- No build uploaded to ASC/TestFlight
- No Add for Review / Submit for Review
- Build identity remains **1.6.1 (113)** — **build 115 NOT CREATED**
- Build 113 / 114 not modified as release artifacts; 116 not created
- No public listing AI metadata cleanup executed
- Local CLI link remains staging (`zleojeqkzizeyerhjpur`); production deploys used `--project-ref izzrlsgumyabdvlmwlwn` only
- Deferred backlog: `docs/releases/1.6.1/BACKLOG_ASC_METADATA_CLEANUP.md`

---

## Branch / commits

| Item | Value |
|------|-------|
| Branch | `release/1.6.1-build-115` |
| Starting commit (this run) | `3e7ae84` |
| Ending tip (pre-doc) | `7fdcb69` |
| Preserved billing | `253ab41` |
| Preserved account deletion UI | `e91268e` |
| Preserved security Issue #8 | `c90838c` (from `252a7ae`) |
| Preserved sticky CTA | `ea084ca` |
| Checkpoint before Apple delete run | `checkpoint/yt3-apple-delete-20260802T001047Z` |

### Commits this run

- `6e5283e` fix(auth): add secure apple token lifecycle
- `e3c9cb6` fix(account): revoke apple authorization during deletion
- `7fdcb69` fix(account): support legacy apple deletion fallback
- (this doc) chore/test: production deploy record + physical UI QA

### Prior cleanup (preserved)

- `3d1c0dc` refactor(settings): clean account, subscription, and More import entry
- `44363ea` fix(account): harden delete-account edge cleanup path
- `aca8b91` fix(security): make gitleaks scan tracked source only
- `3e7ae84` docs(release): update YT3 scope-freeze after settings and gitleaks cleanup

---

## Production Supabase

| Item | Value |
|------|-------|
| Production project name | YouTrader |
| Production project ref | `izzrlsgumyabdvlmwlwn` |
| Production host (Release config) | `izzrlsgumyabdvlmwlwn.supabase.co` |
| CLI account access | yes |
| Local linked project | staging `zleojeqkzizeyerhjpur` (must not deploy there as prod proof) |

### Secrets present (booleans only)

| Secret | Present |
|--------|---------|
| `SUPABASE_URL` | true |
| `SUPABASE_ANON_KEY` | true |
| `SUPABASE_SERVICE_ROLE_KEY` | true |
| `APPLE_TEAM_ID` | false |
| `APPLE_KEY_ID` | false |
| `APPLE_CLIENT_ID` / `APPLE_BUNDLE_ID` | false |
| `APPLE_PRIVATE_KEY` | false |
| `APPLE_TOKEN_ENCRYPTION_KEY` | false |

---

## Deployed Edge Functions (production only)

| Function | Status | Version | verify_jwt | Deploy timestamp (UTC) |
|----------|--------|---------|------------|------------------------|
| `delete-account` | ACTIVE | 1 | true | ~2026-08-02T00:13:09Z |
| `store-apple-auth-token` | ACTIVE | 1 | true | ~2026-08-02T00:13:09Z |

Schema: migration `20260802001141_auth_provider_tokens.sql` applied on production.

`auth_provider_tokens` RLS: enabled; `anon_select=false`; `auth_select=false`; `service_select=true`; no client policies.

Commit lineage for deployed function source: `7fdcb69` (post `44363ea` hardening + Apple lifecycle).

---

## Apple token lifecycle

### New Sign in with Apple

1. Native credential supplies `identityToken` + `authorizationCode`.
2. Existing nonce + Supabase Apple auth unchanged.
3. `authorizationCode` is not persisted in AsyncStorage / SecureStore / analytics.
4. Client calls authenticated `store-apple-auth-token` with `{ authorizationCode }` only.
5. Edge Function verifies JWT user, exchanges code server-side, stores sealed refresh token in `auth_provider_tokens`.
6. Refresh token never returned to client.
7. Apple private key / Team ID / Key ID / Client ID read only from Supabase secrets.

### Delete Account (Apple)

1. Load server-side Apple refresh token for JWT user only.
2. Generate Apple client secret server-side; revoke with Apple.
3. Treat success / already-revoked as success.
4. Delete provider token row; delete user-owned rows; delete auth user.
5. Client clears local state via `onSignOut`; does not claim App Store subscription cancelled.

### Legacy Apple fallback

When no usable stored refresh token **or** Apple secrets missing:

- Account deletion still proceeds.
- Response includes `manualAppleRevocationRequired: true`.
- UI shows manual Apps Using Apple ID guidance + action.
- User is signed out (not left authenticated).

Automatic revoke for **new** Apple logins remains incomplete until production Apple secrets are set.

---

## Production smoke tests

| # | Case | Result |
|---|------|--------|
| 1 | Unauthenticated delete | PASS HTTP 401 |
| 2 | Invalid token delete | PASS HTTP 401 |
| 3 | Unauthenticated / invalid `store-apple-auth-token` | PASS HTTP 401 |
| 4 | Email disposable delete | **NOT RUN** (needs dedicated disposable accounts) |
| 5 | Google disposable delete | **NOT RUN** |
| 6 | Apple with stored refresh token | **BLOCKED** (Apple secrets missing → store returns `stored:false`) |
| 7 | Apple legacy without token | **NOT RUN** (code path implemented; live disposable Apple account pending) |
| 8 | Repeated delete | **NOT RUN** |
| 9 | Service-role absent from client export | PASS (no `SUPABASE_SERVICE_ROLE_KEY=` literal; lone `service_role` substr = Expo notifications string) |
| 10 | Other users unchanged | **NOT RUN** (depends on 4–8) |

Do **not** delete App Review or real customer accounts during remaining smoke.

---

## Manual physical UI QA (Settings cleanup)

Device: physical iPhone (`iPhone 4S` / iPhone 15,3). Installed candidate: Release-Staging **1.6.1 (113)** with Settings cleanup (fingerprint `YT_BUILD_FP_v1:3e7ae84:113:Release-Staging`). Maestro iOS driver still cannot build — not treated as product blocker. HID tap service unavailable on this iOS; AX press ineffective for RN views.

Evidence (gitignored, may contain staging emails — **do not commit / do not upload to ASC**):

`docs/releases/1.6.1/phase4f-screenshots/physical/settings-cleanup-uiqa-20260802/`

| Check | Result |
|-------|--------|
| Settings order Account → Subscription → Notifications → Language → Legal → Support → Version | PASS (AX + screenshot) |
| Email one-line + provider Email | PASS (AX; email redacted in reports) |
| Password Status absent | PASS |
| Cloud Sync / Last Sync / Sync Now absent | PASS |
| Import Trades absent from Settings | PASS |
| Import Trades present in More | PASS |
| Seven languages EN/RU/ES/FR/IT/UK/DE | PASS |
| Legal / Support rows present | PASS |
| Version 1.6.1 (113) visible | PASS |
| No permanent startup loader / no black foreground after unlock | PASS (Journal main after returning-allow) |
| Active Pro: no redundant PRO pills | N/A this session (staging allow user showed **No active subscription**; PRO badges on locked groups expected) |
| Subscription from CustomerInfo | PASS shape (`YouTrader Pro` / no active / View Plans) |
| Sign Out / Delete Account fully visible (not behind tab bar) | **PARTIAL** — controls live in Account details; root Settings AX confirms Account row; deep Account sheet not opened (no reliable tap injector) |
| Apple/Google password controls absent | PASS for Email session (password controls email-only by code); Apple/Google live matrix not re-run this session |

---

## Automated gates

| Check | Result |
|-------|--------|
| `npm ci` | PASS |
| `npm ls --all` | PASS |
| `npm run typecheck` | PASS |
| `npm run translations:check` | PASS |
| `npm run test:email-password` | PASS (6) |
| `npm run test:revenuecat-mobile-identity` | PASS (13) |
| `npm run test:revenuecat-entitlement` | **FAIL** — pre-existing `Deno is not defined` in `revenueCatEntitlement.ts` under Node runner (not modified this run; subscription lifecycle untouched) |
| `npm run test:release-readiness` | PASS (via `release:stability` suite) |
| `npm run release:stability` | PASS |
| `npm run security:check` | PASS |
| `npm run security:audit` | PASS high/critical=0; **3 moderate** Storybook/valibot (reported separately) |
| `npm run security:gitleaks` | PASS findings=0 (tracked source only) |
| `npm run security:semgrep` | PASS findings=0 |
| `npx expo-doctor` | 16/18 — pre-existing config/CNG advisories; **no Expo/RN upgrade** |
| `npx expo export --platform ios --output-dir /tmp/yt115-prebuild-final` | PASS |
| Aikido MCP scan | **NOT AVAILABLE** (auth token invalid) |
| Configured build number | **113** |

---

## Remaining blockers (ordered)

1. Set production Apple secrets (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY`, preferred `APPLE_TOKEN_ENCRYPTION_KEY`) then redeploy/verify `store-apple-auth-token` stores refresh tokens.
2. Complete authenticated production smoke with **dedicated disposable** Email / Google / Apple accounts (never App Review / real customers).
3. Finish Account-details physical proof for Sign Out / Delete Account visibility (manual owner taps acceptable).
4. Resolve or waive `test:revenuecat-entitlement` Deno/Node harness mismatch **without** changing subscription lifecycle behavior unless explicitly authorized.
5. Only then authorize bump to build **115**.

---

## Confirmations

```text
Public version: 1.6.1
Configured build number: 113
Build 115: NOT CREATED
No build was uploaded
No App Store screenshots were changed
No App Store metadata was changed
Nothing was submitted for review
No public release occurred
```

**Decision: NO-GO** for authorizing build 115.

Waiting for explicit authorization before setting build number to 115 or creating build 115.
