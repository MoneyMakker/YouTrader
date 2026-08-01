# YouTrader 3.0 Recovery Continuation Report — 2026-08-01

Build **1.6.1 (113)**. Phase 4F **FAILED / OPEN / NO-GO**. Build 114 not prepared. Production Supabase untouched.

## 1. Working-tree classification

Manifest: `docs/releases/1.6.1/WORKING_TREE_CLASSIFICATION_2026-08-01.md` (+ JSON).

Initial snapshot (~430 paths): C≈358 evidence, A≈51 product, H≈10 WIP, E tooling, F secrets, D build, G bak.

## 2. Credential relocation

| Check | Result |
|-------|--------|
| `SIM_EMAIL_PASSWORD_UNIT.txt` tracked? | **No** |
| Ever in git history? | **No** |
| Content class | **QA unit pass marker** (`[YouTrader:email-password-qa] 6 scenarios passed`) — not a password payload |
| Relocated to | `~/Library/Application Support/YouTraderQA/secrets/SIM_EMAIL_PASSWORD_UNIT.txt.relocated` |
| Staging email fixtures | Remain in gitignored `.codex/secrets/staging-qa-credentials.env`; mirrored to `~/.youtrader-qa-secrets/` |
| Seed script | Reads `YT_STAGING_QA_SECRETS` → `.codex/secrets` → `~/.youtrader-qa-secrets` → App Support |
| `.gitignore` | Added `SIM_EMAIL_PASSWORD*`, `*PASSWORD_UNIT.txt`, credential patterns |
| Regression | `scripts/qa/forbiddenCredentialFiles.selftest.ts` **PASS** |
| `npm run security:check` | **PASS** |
| Password printed in logs/reports? | **No** (values never echoed) |

## 3. New recovery commits (after paywall baseline)

| Hash | Message |
|------|---------|
| `0dbea9f` | security(qa): relocate credential artifacts and harden secret guards |
| `e61e0aa` | fix(auth): require distinct Google Web and iOS client IDs |
| `60551a3` | feat(ui): add premium status spinner and loading primitives |
| `6dddc08` | fix(auth): use premium StatusSpinner in email auth modals |
| `e37bc66` | fix(qa): prevent env-only staging auth auto-reset race |
| `ecdd1a1` | chore(tsconfig): include entitlement startup routing QA script |
| `1edfe40` | chore(ios): enable BuildIndependentTargetsInParallel |
| `17b6f9b` | chore(eas): disable production autoIncrement; set ASC app id |
| `6a9f130` | fix(ai): harden client AI and PI surfaces without signal language |
| `060658a` | feat(stats): add Radar Heatmap overview and metric dashboard modules |

## 4. Remaining dirty tree

Still dirty (~400 paths): primarily phase4f/first-launch screenshots (C), `.codex/` (E), `build/` (D), **supabase edge function WIP** (H — not deployed), `src/app/ai/*` extract WIP, misc scripts. Intentionally not bulk-committed.

## 5–6. RevenueCat authenticated write audit / Weekly

**EXTERNAL BLOCKER — REVENUECAT WRITE ACCESS REQUIRED**

Missing category: RevenueCat **project secret / v2 API key** (or dashboard session) with offering write scope.

Exhausted: public `appl_`, local env, `.codex/secrets`, Keychain names, GH secrets, EAS env, sister project, RC MCP — no write credential.

Live read still: Monthly+Annual PASS; Weekly MISSING; `package_count=2`.

## 7–10. Monthly / Yearly CustomerInfo / Email identity / Isolation

| Track | Status |
|-------|--------|
| Monthly CustomerInfo E2E | **NOT RUN** — CoreSimulatorService unreachable from agent |
| Yearly CustomerInfo E2E | **NOT RUN** — same |
| Email identity linking E2E | **NOT RUN** — simulator/device services blocked |
| RC user isolation E2E | **NOT RUN** |
| Code path present | `Purchases.logIn(session.user.id)` after auth; acquisition auth gate; fixtures via seed script |

## 11. Simulator boot recovery

| Step | Result |
|------|--------|
| `simctl list` / boot / `bootstatus` | **FAIL** — CoreSimulatorService connection invalid; log file Operation not permitted |
| `Simulator.app` open | **FAIL** — LaunchServices `kLSNoExecutableErr` from agent context |
| `devicectl` / physical | **FAIL** — CoreDeviceService timeout |
| Classification | **EXTERNAL BLOCKER — AGENT HOST SIMULATOR/DEVICE SERVICES** (not product code) |

Disk OK (~131Gi free). Narrow recovery attempted (kickstart, reopen) without mass erase.

## 12. Screenshot matrix

**NOT RUN** this session (blocked by §11). Prior untracked evidence remains under `docs/releases/1.6.1/phase4f-screenshots/` (not newly committed).

## 13. Physical build 113

**NOT RUN** — device services unavailable from agent. Policy unchanged: install only Release-Staging **113**.

## 14. Exact remaining Phase 4F blockers

1. **EXTERNAL BLOCKER — REVENUECAT WRITE ACCESS REQUIRED** (Weekly package)
2. **EXTERNAL BLOCKER — AGENT HOST SIMULATOR/DEVICE SERVICES** (boot / screenshots / StoreKit E2E / physical)
3. Monthly + Yearly purchase → CustomerInfo → trial dates (**blocked by #2**)
4. Email → `Purchases.logIn` → isolation matrix (**blocked by #2**)
5. Apple native / Google OAuth interactive E2E
6. PI timeout/Retry, News fault, Settings isolation device proof
7. Visible LogBox on device (code uses `LOG_LEVEL.ERROR`; needs device confirmation)

Phase 4F remains **FAILED / OPEN / NO-GO**.
