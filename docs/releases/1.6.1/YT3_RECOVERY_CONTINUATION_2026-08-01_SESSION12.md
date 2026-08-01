# YT3 Recovery — Session 12 (2026-08-01)

Build: **113** · Phase 4F: **FAILED / OPEN / NO-GO** · Production Supabase: **untouched** · Build 114: **not prepared**

Prior: `YT3_RECOVERY_CONTINUATION_2026-08-01_SESSION11.md`

---

## 1. Verified WIP commit hashes

Preserved `6ef6503`. Consolidation commits:

| Hash | Summary |
|------|---------|
| `6ef6503` | test(qa): lock qaApplyEditRequest |
| `01b808a` | fix(qa): deterministic staging reset modes and completion markers |
| `f0291c7` | feat(qa): staging journal seed and apply-edit orchestration helpers |
| `7a1595c` | feat(calc): pure risk calculator |
| `2d191e7` | fix(auth): Path A Google OAuth + auth a11y |
| `8af9982` | feat(app): wire staging reset, journal QA edit/delete, calc |
| `6dcb553` | test(qa): Phase 4F Maestro flows + harness scripts |
| `8373ec1` | test(storekit): harden local monthly/yearly suite |
| `d33f7f5` | docs(release): Sessions 2–11 + S11 evidence |

Focused selftests + typecheck after consolidation: **PASS**.

Unrelated dirty WIP (i18n/AI/supabase functions/UI polish) left uncommitted.

---

## 2. Google redirect_uri root cause

**Architecture:** PATH A confirmed — Supabase `signInWithOAuth` → ASWebAuth → Google → Supabase HTTPS callback → `youtrader://auth`.

**Exact redirect URI Google receives** (authorize hop, no secrets logged):

`https://zleojeqkzizeyerhjpur.supabase.co/auth/v1/callback`

**Staging Supabase Auth (read-only verify):** Google enabled, secret present, `youtrader://auth` allowlisted, Site URL staging.

**App custom scheme is NOT sent to Google as Web redirect** — correct.

---

## 3. Google configuration repair

Attempted:

- Supabase Management API (CLI keychain) — config already correct
- `gcloud` / Firebase CLI — **absent**
- Playwright → Google Cloud Credentials — **interactive Google sign-in required** (no authenticated console session)

**Could not add** the staging Supabase callback to the Web OAuth client's authorized redirect URIs.

Classification:

**EXTERNAL BLOCKER — MISSING GOOGLE CLOUD PROJECT PERMISSION**

---

## 4. Google Supabase session E2E

**NOT PROVEN** (blocked by §3). Prior CTA/ASWebAuth/Continue remain PASS; consent/session still fail at Google 400.

---

## 5–7. RevenueCat CustomerInfo / restore / isolation

| Check | Result |
|-------|--------|
| RC offering audit (`default`, monthly/yearly product IDs, entitlement `YouTrader Pro`) | **PASS** (`rc_offering_audit_s12.log`) |
| StoreKit XCTest iOS 18.5 monthly/yearly | prior **PASS** 4/4 |
| Real paywall purchase on iOS 26.5 | **QA HARNESS FAIL** — Apple Account sheet (StoreKit Testing not injected) |
| Real paywall purchase on iOS 18.5 + Xcode StoreKit scheme launch | **FAIL** — RC configuration toast (#7) + “Subscriptions temporarily unavailable”; CustomerInfo entitlement **not activated** |
| Monthly CustomerInfo after purchase | **NOT PROVEN** |
| Yearly CustomerInfo after purchase | **NOT RUN** (same blocker) |
| Restore / identity isolation | **NOT RUN** |

Evidence: `s12_rc18_after_cta.png`, `s12_rc18_monthly_result.png`, `rc_monthly_s12_18_5.log`.

---

## 8. PI staging timeout/Retry

| Check | Result |
|-------|--------|
| Local `pi-timeout-reaper-qa` | **PASS** |
| Migration `20260731290000_prop_os_pi_timeout_reaper.sql` | present |
| Full staging lifecycle (pending→timeout→Retry, cross-user, cold pending) | **NOT RUN** this slice |

---

## 9. News offline/Retry

Implemented staging fault deep link + a11y IDs:

- `youtrader://qa/news-fault?mode=none|offline|timeout|empty|malformed|unavailable`
- IDs: `news.screen`, `news.list`, `news.refresh`, `news.article`, `news.error`, `news.retry`, `news.empty`, `news.loading`
- Pure plan helper + selftest **PASS**
- typecheck **PASS**
- Full Maestro offline matrix on device: **NOT RUN** (implementation ready; needs Metro reload + Lane A session)

---

## 10. Settings user-switch isolation

**NOT RUN** this slice (beyond prior logout smoke).

---

## 11. Apple physical native

**NOT RUN** — device was on build **114** initially; reinstalled Release-Staging **113** for integrity; Apple E2E not executed in remaining window.

---

## 12. Physical 5 cold + 3 warm

| Step | Result |
|------|--------|
| Device had 114 | Replaced with Release-Staging **113** (`physical_install_113_s12.log`) |
| Embedded bundle + staging host | **PASS** (`physical_verify_ok`) |
| Cold ×5 process_ok | **PASS** |
| Warm ×3 process_ok | **PASS** (re-run after launch flag fix) |
| Metro OFF | **WARN** — Metro still listening on host `:8081` during physical (Release bundle used; ideal OFF) |

Harness fix: `devicectl … --start-stopped=false` → flag-only launch.

---

## 13. Remaining Phase 4F blockers

1. Google Cloud Web client: authorize staging Supabase callback (permission/tooling)
2. In-app RC purchase → CustomerInfo (RC configuration #7 on StoreKit scheme path)
3. RC restore + identity isolation
4. Google / Apple session E2E
5. PI full staging timeout/Retry matrix on device
6. News Maestro fault matrix execution
7. Settings user-switch matrix
8. Full physical Phase 4F product matrix
9. Aikido MCP unavailable (separate from product QA)

---

**Phase 4F remains FAILED / OPEN / NO-GO. Build 113 only.**
