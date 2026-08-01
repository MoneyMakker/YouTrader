# YT3 Recovery — Session 10 (2026-08-01)

Build: **113** · Phase 4F: **FAILED / OPEN / NO-GO** · Production Supabase: **untouched**

---

## 1. Deterministic reset (no fixed sleep)

**Implemented**

- State machine phases in `src/qa/stagingQaResetState.ts`
- `runStagingQaReset` emits: requested → oauth → storage → auth session → user cache → applying mode → persisted → **reset_complete** (or **reset_failed**)
- Staging markers: `qa.reset.in-progress` / `qa.reset.complete` / `qa.reset.failed` / `qa.reset.mode` / `qa.reset.phase`
- Persist flag `yt-qa-reset-complete-v1` so Auth remounts still expose `qa.reset.complete`
- Bootstrap `scripts/qa/bootstrap-auth-ready-staging.sh` waits for **`qa.reset.complete`** (no 8s sleep)

**Evidence status**

- Unit/selftest transitions: **PASS**
- Maestro wait for `qa.reset.complete` after wipe: **PARTIAL / flaky** while marker wiring stabilized; Auth CTAs still reachable via proven cold-relaunch contracts
- Latest bootstrap log: `docs/releases/1.6.1/qa-logs/bootstrap_auth_ready_s10g.log` (re-run in progress / check)

Production does not expose markers unless staging/dev env.

---

## 2. Canonical Google architecture

**PATH A — Supabase browser OAuth + ASWebAuth** (chosen)

Doc: `docs/releases/1.6.1/GOOGLE_AUTH_ARCHITECTURE_PATH_A.md`

- Native PATH B only when distinct iOS client exists (`enableNativeGoogleSignIn`)
- WEB client never used as iOS client

---

## 3. Staging Google provider

| Check | Result |
|-------|--------|
| Staging Google enabled | Yes |
| Staging Web client ID | Present (matches app env Web client) |
| Staging secret | **Was missing → configured** from matching prod Web client secret (**staging PATCH only**) |
| `uri_allow_list` includes `youtrader://auth` | Yes |
| Production project | **Not modified** |

---

## 4. Google Supabase session E2E

| Step | Result |
|------|--------|
| Auth CTAs / Google tap / ASWebAuth / Continue | PASS (prior + S10) |
| Past `missing OAuth secret` | **PASS** (now reaches Google) |
| Google account UI | Reached `accounts.google.com` |
| Consent / code exchange / session | **BLOCKED** — `Error 400: redirect_uri_mismatch` |

**EXTERNAL BLOCKER — GOOGLE CLOUD REDIRECT URI**

Authorize on the Web OAuth client:

`https://zleojeqkzizeyerhjpur.supabase.co/auth/v1/callback`

Screenshot: `s10_google_after_continue.png`  
Log: `lane_b_google_s10.log`

---

## 5. Calculator complete UI matrix

| Case | UI | Unit |
|------|----|------|
| Valid $500 / $25 | PASS | PASS |
| Decimal balance/risk | PASS (screenshot) | PASS (`10000.50`×`0.5%`) |
| Small stop `0.25` | PASS | PASS |
| Zero balance | PASS | PASS |
| Negative balance | PASS | PASS |
| Invalid `12abc` | PASS | PASS |
| Reset after error → `$25.00` | PASS | — |
| Large `999999` | PASS | PASS |

Log: `calculator_matrix_s10.log` · shots: `s10_calc_*.png`  
**Calculator PRODUCT FUNCTIONAL: PASS** (UI edges exercised + unit agreement)

---

## 6–8. Journal / Stats / Calendar

- Unique-marker re-run (`S10-234954`): create PASS; after Save edited notes **not found** → edit persist **FAIL this run**
- Prior S8 marker re-run: delete cancel PASS; delete confirm left sibling `S8-LIFE` cards → assert flake
- Stats/Calendar: screenshots only → **PARTIAL**

Logs: `journal_lifecycle_s10b.log`, `journal_lifecycle_s10_unique.log`

---

## 9–11. RevenueCat / PI / News / Settings / Apple physical

**NOT RUN in Session 10** (blocked time spent on reset marker + Google provider + Calculator).

---

## Remaining objective blockers

1. **Google Cloud**: authorize `https://zleojeqkzizeyerhjpur.supabase.co/auth/v1/callback` on the Web OAuth client (`redirect_uri_mismatch`)
2. **qa.reset.complete harness**: implementation + persist flag done; Maestro still flaky when prior Main/session remains — terminate-before-reset helps; cold `auth.screen` wait still races Linking
3. **Journal delete assert**: multiple `S8-LIFE` seed rows can remain; `notVisible` matches a sibling card — need unique marker per run
4. RevenueCat CustomerInfo monthly/yearly + isolation — NOT RUN
5. PI staging timeout/Retry — NOT RUN
6. News offline/Retry — NOT RUN
7. Settings user-switch — NOT RUN
8. Apple physical E2E — NOT RUN
9. Aikido MCP unavailable

---

## QA gates

- typecheck: PASS (after marker hydrate fix)  
- selftest reset/calc: PASS  
- translations: not re-run this slice (prior PASS)  
- expo export: not re-run this slice (prior PASS, staging host only)  

**Phase 4F remains FAILED / OPEN / NO-GO. Build 113 only.**
