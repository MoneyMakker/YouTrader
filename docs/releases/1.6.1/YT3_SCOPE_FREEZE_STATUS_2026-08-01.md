# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **OPEN / NO-GO**

## Freeze compliance

- No App Store screenshots deleted/replaced/uploaded
- No build uploaded to ASC/TestFlight
- No Add for Review / Submit for Review
- Build identity remains **1.6.1 (113)** until final gates + physical matrix; **115 not created as release artifact this cleanup run**
- Build 113 / 114 not modified as release artifacts; 116 not created
- No public listing AI metadata cleanup executed
- Production Supabase schema untouched; `delete-account` **not deployed to production** (CLI linked to staging; no prod access token)
- Deferred backlog: `docs/releases/1.6.1/BACKLOG_ASC_METADATA_CLEANUP.md`

---

## Branch / commits

| Item | Value |
|------|-------|
| Branch | `release/1.6.1-build-115` |
| Tip (this cleanup) | `aca8b91` (+ settings / delete-account / gitleaks commits) |
| Preserved billing | `253ab41` |
| Preserved account deletion UI | `e91268e` |
| Preserved security Issue #8 | `c90838c` (from `252a7ae`) |
| Preserved sticky CTA | `ea084ca` |
| Checkpoint before cleanup | `checkpoint/yt3-settings-pre-cleanup-20260801T235221Z` + stash `checkpoint/settings-cleanup-20260801T235221Z` |

### Commits this cleanup

- `3d1c0dc` refactor(settings): clean account, subscription, and More import entry
- `44363ea` fix(account): harden delete-account edge cleanup path
- `aca8b91` fix(security): make gitleaks scan tracked source only

---

## RevenueCat Restore Behavior

**CONFIRMED (owner)**

| Setting | Value |
|---------|-------|
| Production | Transfer to new App User ID |
| Sandbox override | Transfer to new App User ID |

---

## Settings cleanup (Tasks 1–5)

### Final Settings hierarchy

```text
Account → (details)
Subscription
Notifications
Language
Legal
Support
App Version
```

### Removed from Account

- Password Status / masked bullets
- Cloud Sync card / “Synced across all devices”
- Last Sync / Sync now button

### Moved

- Import Trades → **More** (with Calendar / Calculator / News / Reports)

### Account provider behavior

- Compact Account row: email (single-line middle truncate + a11y full email) + provider (Email / Apple / Google) + chevron
- Details: identity, Sign Out, Delete Account
- Change email / Change password: **email provider only** (flows already complete)
- Apple / Google: no password controls / no fake password UI

### Subscription card data sources

- `CustomerInfo.entitlements.active[YouTrader Pro]`
- product id → Weekly / Monthly / Yearly
- `willRenew` → `Renews <date>` else `Expires <date>`
- `priceString` from matching `PurchasesStoreProduct` when available
- `managementURL` for Manage Subscription (Apple subscriptions URL fallback)
- Restore Purchases **only** when not entitled
- Stale expiration triggers CustomerInfo refresh

### Pro presentation

- Active Pro: no PRO pills on notification rows
- Non-entitled: single restrained PRO badge on pro-only groups

---

## Delete Account (Task 6)

| Check | Status |
|-------|--------|
| Session JWT required; user id from `auth.getUser()` only | PASS (code) |
| No arbitrary user id in body | PASS |
| Service role only in Edge Function env | PASS |
| Confirmation explains App Store not cancelled | PASS |
| Local cleanup via existing `onSignOut` | PASS |
| Apple token revocation | **NOT IMPLEMENTED** (authorizationCode not persisted) — document limitation |
| Deploy to **production** | **BLOCKED** — `supabase/.temp/project-ref` = staging; no `SUPABASE_ACCESS_TOKEN` / CLI token for production |

---

## Gitleaks (Task 7)

| Item | Result |
|------|--------|
| Root cause of 396 / ~15.5GB | `gitleaks detect --no-git --source .` walked entire worktree including `build/` (~35GB) |
| Fix | `scripts/security-gitleaks-tracked.sh` + `npm run security:gitleaks` uses tracked snapshot (~6.8MB / 1314 files) |
| Tracked findings before allowlist | 2 × `generic-api-key` on AsyncStorage key constants (`yt-acquisition-guest-v1`, `yt-qa-news-fault-v1`) — **FALSE_POSITIVE_WITH_EVIDENCE** |
| Narrow allowlist | those two key strings only in `.gitleaks.toml` |
| Final gate | **PASS** (0 findings) |
| `security:audit` | **PASS** high/critical = 0 (3 moderate Storybook) |

---

## Automated gates (Task 8) — this cleanup

| Check | Result |
|-------|--------|
| typecheck | PASS (earlier this run) |
| translations:check | PASS |
| test:email-password | PASS |
| test:revenuecat-mobile-identity | PASS (13) |
| settingsCleanupContract | PASS |
| settingsSubscriptionPresentation | PASS |
| security:gitleaks | PASS |
| security:audit | PASS (0 high/critical) |
| expo export ios | (in progress / see evidence) |
| test:revenuecat-entitlement | known Deno runner limitation |
| npm ci / full suite | not all scripts completed in this pass — continue before build 115 |

---

## Physical UI / Build 115 / purchase matrix (Tasks 9–10)

| Item | Status |
|------|--------|
| Physical Settings UI screenshots after cleanup | **NOT DONE** (Maestro iPhoneOS driver build still broken) |
| Build 115 creation | **NOT CREATED** |
| Weekly / Monthly / Yearly × Email / Apple / Google | **NOT RUN** |
| Anonymous / authenticated restore live | **NOT RUN** |

---

## Remaining blockers (ordered)

1. Deploy `delete-account` to **production** Supabase (link/project + credentials).
2. Physical Settings UI verification on device after cleanup.
3. Create production Release **1.6.1 (115)** only after (1)–(2) + automated gates.
4. Complete live purchase→auth matrix on build 115.
5. Optional: Apple Sign in token revocation if product requires it for App Store account deletion compliance.

---

## Confirmations

```text
Public version: 1.6.1
Build number: NOT CREATED (still 113 in configs)
No build was uploaded
No App Store screenshots were changed
No App Store metadata was changed
Nothing was added or submitted for review
No public release occurred
```

**Decision: NO-GO**
