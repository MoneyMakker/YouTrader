# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **OPEN / NO-GO for authorizing build 115**

## Freeze compliance

- No App Store / TestFlight upload
- No metadata or screenshot changes
- No Add/Submit for Review
- Public version **1.6.1**
- Configured build number remains **113** — **build 115 NOT CREATED**
- Subscription product IDs / trial config / Settings IA / dependency versions **NOT MODIFIED**
- Production target: `izzrlsgumyabdvlmwlwn` (YouTrader)
- Local CLI link remains staging (`zleojeqkzizeyerhjpur`)

---

## 1. Starting / ending HEAD

| Item | Value |
|------|-------|
| Branch | `release/1.6.1-build-115` |
| Start | `9533ba4` |
| End | `00b8ee6`
| Preserved | `a73b40f`, `87c0780`, UI polish chain |
| Checkpoint | `checkpoint/yt3-pre115-auth-20260802T051530Z` |

---

## 2–6. Apple configuration (verified)

| Item | Value |
|------|-------|
| Bundle ID | `com.youtrader.pro` |
| Team ID | `L6M4U8G8RC` (Xcode + Apple Developer membership) |
| App ID | YouTrader / `com.youtrader.pro` (Sign In with Apple enabled, primary) |
| Client ID for token endpoint | `com.youtrader.pro` (`APPLE_CLIENT_ID` preferred; `APPLE_BUNDLE_ID` fallback) |
| Services ID | Not used for native path |
| SIWA key | **NEW** created: name `YouTrader Sign in with Apple Production`, Key ID `VBCK****28` (full Key ID recorded only in secure vault metadata) |
| Existing APNs key | Left untouched (`9MY9Y52Z55` Expo Push) |
| Private key storage | Outside repo: `~/.youtrader-secure/apple-siwa-production/` (mode 700/600) |
| Encryption key | Generated via `openssl rand -hex 32`; SHA-256 → AES-GCM per `appleAuthTokens.ts` |

### Production secret names (values never recorded)

| Secret | present |
|--------|---------|
| APPLE_TEAM_ID | true |
| APPLE_KEY_ID | true |
| APPLE_CLIENT_ID | true |
| APPLE_BUNDLE_ID | true |
| APPLE_PRIVATE_KEY | true |
| APPLE_TOKEN_ENCRYPTION_KEY | true |

Runtime probe: `store-apple-auth-token` with invalid code → `stored:false`, `reason:exchange_failed` (**not** `apple_secrets_missing`) → **PASS**

---

## 7–8. Edge Functions

| Function | version | status | verify_jwt | project |
|----------|---------|--------|------------|---------|
| store-apple-auth-token | **3** | ACTIVE | true | izzrlsgumyabdvlmwlwn |
| delete-account | **3** | ACTIVE | true | izzrlsgumyabdvlmwlwn |

Deployed this run after secrets set.

---

## 9–14. Deletion / Apple smoke matrix

| Case | Result |
|------|--------|
| No Authorization → 401 | **PASS** |
| Invalid JWT → 401 | **PASS** |
| Cross-user body `user_id` ignored (JWT subject deleted; victim remains) | **PASS** |
| Disposable Email delete | **PASS** (ok=true, user 404) |
| Repeat delete after delete | **PASS** (401 unauthorized — safe) |
| RLS client SELECT `auth_provider_tokens` | **PASS** (403) |
| store-apple secrets loaded | **PASS** (exchange_failed) |
| Legacy Apple without refresh token → delete + `manualAppleRevocationRequired=true` | **PASS** (identity inserted via controlled SQL; disposable only) |
| Apple `stored:true` with real authorizationCode | **NOT RUN** (requires physical SIWA disposable account) |
| Apple revoke with stored refresh token | **NOT RUN** (depends on stored:true) |
| Google disposable delete | **NOT RUN** (ASC/Google session + dedicated QA identity pending) |
| Client export secrets | Prior scan: Expo notifications `service_role` false positive only |

---

## 15. Pre-build physical UI QA

- Device: connected iPhone 14 Pro Max (`6FCFF771-…`)
- Installed/launched current **RS 113** build
- Checklist: `docs/releases/1.6.1/phase4f-screenshots/physical/pre115-manual-20260802/MANUAL_QA_CHECKLIST.md`
- Device screenshots: **PENDING_USER** (Side Button + Volume Up → save into that folder)
- pymobiledevice3 capture remains ENVIRONMENT_BLOCKER

---

## 16. Pre-build automated gates (this run)

| Check | Result |
|-------|--------|
| typecheck | PASS |
| translations:check | PASS |
| test:email-password | PASS |
| test:revenuecat-mobile-identity | PASS |
| test:revenuecat-entitlement | PASS |
| test:prop-pass-lifecycle | PASS |
| release:stability | PASS |
| security:check | PASS |
| security:audit | 0 high/critical; 3 moderate Storybook/valibot |
| security:gitleaks | PASS findings=0 |
| security:semgrep | PASS findings=0 |
| Build number | **113** (not raised) |

---

## 17–26. Build 115 / purchase matrix

| Item | Result |
|------|--------|
| Build 115 creation | **NOT CREATED** (pre-build requirements incomplete) |
| Archive | NOT CREATED |
| Weekly→Email / Monthly→Apple / Yearly→Google | **NOT RUN** |
| Restore / reinstall / tab matrix | **NOT RUN** |
| App Store Connect sandbox testers | **BLOCKED** — ASC login session expired (`authResult=FAILED`); needs interactive Apple Account sign-in + 2FA |

---

## 27. Remaining blockers before build 115

1. **Interactive App Store Connect login** (browser) for sandbox testers + purchase matrix
2. **Physical SIWA disposable account** → `store-apple-auth-token` `stored:true` → delete revoke PASS
3. **Disposable Google delete smoke**
4. **Manual physical UI screenshot checklist completion**
5. Only then: set build number **115**, signed Release archive, install, purchase matrix

---

## 28. Final verdict

**NO-GO** for creating/authorizing build 115 until blockers above are closed.

---

## Confirmations

```text
Public version: 1.6.1
Configured build number: 113
Build 115: NOT CREATED
Build 115 physical QA: NOT RUN
TestFlight upload: NOT PERFORMED
App Store upload: NOT PERFORMED
App Store screenshots: NOT CHANGED
App Store metadata: NOT CHANGED
Added for review: NO
Submitted for review: NO
Public release: NO
```
