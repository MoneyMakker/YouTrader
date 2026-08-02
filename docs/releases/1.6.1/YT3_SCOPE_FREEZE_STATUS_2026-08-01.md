# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **OPEN / NO-GO for authorizing build 115**

## Freeze compliance

- No App Store screenshots deleted/replaced/uploaded
- No build uploaded to ASC/TestFlight
- No Add for Review / Submit for Review
- Build identity remains **1.6.1 (113)** — **build 115 NOT CREATED**
- Subscription / RevenueCat / StoreKit product IDs / trial / Settings IA / Gitleaks remediation / dependency versions **NOT MODIFIED** this run (entitlement **harness only**)
- Local CLI link remains staging (`zleojeqkzizeyerhjpur`); production secrets/functions use `--project-ref izzrlsgumyabdvlmwlwn`

---

## 1. Starting / ending HEAD

| Item | Value |
|------|-------|
| Branch | `release/1.6.1-build-115` |
| Start (this run) | `4daad2a` |
| End | `87c0780` (+ docs commit below) |
| `4daad2a` preserved | **YES** (ancestor of HEAD) |
| `c9b7b52` preserved | **YES** |
| Checkpoint | `checkpoint/yt3-pre115-blockers-20260802T043804Z` |
| Build number | **113** |

### Commits this run

- `a73b40f` feat(prop-pass): complete challenge dashboard and terminal states
- `87c0780` test(security): isolate entitlement QA from Deno Edge runtime
- (this doc) docs(release): pre-115 blocker status

Prior UI polish (preserved): `7b4602e` … `4daad2a`

---

## 2–5. Prop Pass lifecycle and data sources

| State | Trigger | Data source | UI | Physical QA |
|-------|---------|-------------|----|-------------|
| A No challenge | `no_account` / empty setup | Prop OS account read model | Setup CTA / onboarding | **PENDING_USER** |
| B Insufficient data | assigned trades &lt; thresholds / no readiness score | assignments + snapshot | Hero building + readiness “Not enough data” | **PENDING_USER** |
| C Active sufficient | gate `available` + snapshot | rule snapshot + engine snapshot | Full dashboard modules | **PENDING_USER** |
| D Passed | `no_active_challenge` + latest historical `passed`/`funded` | historicalAttempts + optional snapshot | Terminal passed card + start another | **PENDING_USER** |
| E Failed/breached | latest historical `breached`/`abandoned` | historicalAttempts + breachReasons | Terminal failed card + review/start | **PENDING_USER** |

### Active challenge modules

| Module | Source | Fake data? |
|--------|--------|------------|
| Challenge header | account + challenge records | No |
| Target Progress | snapshot buffers `target_distance` + rule profit target | No |
| Buffer Health | snapshot buffers daily/drawdown | No |
| Discipline Streak | `tradingStats` from engine snapshot | No (zeros / missing → not enough data) |
| Rule Status | rule snapshot + buffers + daysTraded | No |
| Smart Intervention | buffer warn/hard or breachReasons only | No (hidden when healthy) |
| Decision Replay | breachReasons[0].tradeId when present | No (hidden otherwise) |
| Pass Probability | **Not invented.** Card shows **Readiness** score only when assigned≥5 and score present; else “Not enough data / need 5 trades” | No fake % |
| Timeline | historicalAttempts list only (no fabricated curve) | No fake curve |

### Remaining Prop Pass blockers / placeholders

- Edit challenge rules after create: still immutable (by design)
- Start new attempt on same account: uses onboarding CTA (resetOfChallengeId domain exists; dedicated retry UI minimal)
- Day-level streak history only after engine snapshot includes `tradingStats` (new calc; existing DB snapshots until recalc may omit it → UI shows not enough data)
- Manual physical capture of each lifecycle state: **PENDING_USER**
- Production Prop OS mutations remain staging/allowlist gated as before

---

## 6. Manual physical UI QA

Automated pymobiledevice3 screenshots remain ENVIRONMENT_BLOCKER.

Checklist prepared (gitignored):

`docs/releases/1.6.1/phase4f-screenshots/physical/pre115-manual-20260802/MANUAL_QA_CHECKLIST.md`

**Result:** screenshots **NOT YET CAPTURED** by device owner this run. Prior UI polish contracts covered by `test:ui-polish` / code review.

**Owner action:** open installed RS 113 build, take iOS system screenshots into that folder, check the boxes.

---

## 7. Apple production secret readiness

Project: YouTrader / `izzrlsgumyabdvlmwlwn`

Present (names only): core Supabase + RevenueCat + AI keys (unchanged).

**Missing required Apple server secrets:**

- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_CLIENT_ID` (or `APPLE_BUNDLE_ID`)
- `APPLE_PRIVATE_KEY`
- `APPLE_TOKEN_ENCRYPTION_KEY` (required for stored-token path)

**Apple automatic revocation: BLOCKED**

Local commands (placeholders only — do not paste values in chat):

```bash
supabase secrets set \
  APPLE_TEAM_ID=YOUR_TEAM_ID \
  APPLE_KEY_ID=YOUR_KEY_ID \
  APPLE_CLIENT_ID=com.youtrader.pro \
  APPLE_PRIVATE_KEY="YOUR_P8_PEM" \
  APPLE_TOKEN_ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY \
  --project-ref izzrlsgumyabdvlmwlwn

supabase functions deploy store-apple-auth-token --project-ref izzrlsgumyabdvlmwlwn
supabase functions deploy delete-account --project-ref izzrlsgumyabdvlmwlwn
```

No redeploy performed this run (secrets incomplete).

---

## 8. Disposable account deletion smoke

| Case | Result |
|------|--------|
| Unauthenticated → 401 | **PASS** (`UNAUTHORIZED_NO_AUTH_HEADER`) |
| Invalid token → 401 | **PASS** (`UNAUTHORIZED_LEGACY_JWT`) |
| Email disposable delete | **NOT RUN** (no disposable credentials provided) |
| Google disposable delete | **NOT RUN** |
| Apple + stored refresh token | **NOT RUN** + Apple secrets BLOCKED |
| Legacy Apple without token | **NOT RUN** |
| Cross-user delete denied | **NOT RUN** |
| Repeated deletion safe | **NOT RUN** |
| Service-role / Apple secrets absent from client export | **PASS** (only Expo notifications `service_role` substring false positive; no JWT/key) |
| Other user records untouched | **NOT RUN** |

---

## 9. Entitlement harness

| Item | Value |
|------|-------|
| Command | `npm run test:revenuecat-entitlement` → `node --experimental-strip-types scripts/security/revenuecat-entitlement-qa.mjs` |
| Prior failure | `ReferenceError: Deno is not defined` in production Edge module under Node |
| Fix | Behavioral tests use `scripts/security/fixtures/revenueCatEntitlement.harness.ts` (DI); static checks still read production Edge + client files |
| Production subscription module | **NOT MODIFIED** |
| Result | **PASS** |

---

## 10. Automated gates

| Check | Result |
|-------|--------|
| npm ci | PASS |
| typecheck | PASS |
| translations:check | PASS |
| test:ui-polish / prop-pass-lifecycle | PASS |
| test:email-password | PASS |
| test:revenuecat-mobile-identity | PASS |
| test:revenuecat-entitlement | **PASS** |
| release:stability | PASS |
| security:check | PASS |
| security:audit | 0 high / 0 critical; **3 moderate** Storybook/valibot |
| security:gitleaks | PASS findings=0 |
| security:semgrep | PASS findings=0 |
| expo-doctor | 16/18 pre-existing |
| expo export `/tmp/youtrader-pre115-final` | PASS |
| Build number | **113** |

---

## 11. Exact remaining blockers (build 115)

1. **Apple production secrets missing** → automatic Apple revoke BLOCKED
2. **Disposable Email/Google/Apple deletion smokes not executed**
3. **Manual physical UI screenshot matrix not completed by owner**
4. Prop Pass: existing snapshots need recalc to populate new `tradingStats` fields

Non-blockers closed this run: entitlement Deno harness; Prop Pass module completeness (deterministic, no fake %).

---

## 12. Final recommendation for authorizing build 115

**NO**

Do not authorize build 115 until Apple secrets are set, disposable deletion smokes pass (or explicit PO waiver), and manual physical UI checklist is completed.

---

## Confirmations

```text
Public version: 1.6.1
Configured build number: 113
Build 115: NOT CREATED
Subscription lifecycle: NOT MODIFIED unless explicitly documented
No build was uploaded
No App Store screenshots were changed
No App Store metadata was changed
Nothing was submitted for review
No public release occurred
```

Waiting for explicit authorization before setting build number to 115 or creating build 115.
