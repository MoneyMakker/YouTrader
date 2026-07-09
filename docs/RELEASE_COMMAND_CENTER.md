# Release Command Center — YouTrader

**Single entry point for every release.**  
**Never:** Production deploy · App Store submit · git push · auto-merge

---

## Commands

| You say / run | What it does |
|---------------|--------------|
| **Prepare TestFlight** | Full 10-step pipeline → TestFlight-ready preview build |
| **Prepare Production** | Same validation + production prep (requires QA sign-offs) |
| **Prepare Release X.Y.Z** | TestFlight pipeline + version must match `X.Y.Z` |

---

## Prepare TestFlight

### Option A — npm (recommended)

```bash
npm run prepare:testflight
```

### Option B — shell

```bash
./scripts/prepare-testflight.sh
```

### Option C — direct

```bash
node scripts/release-command-center/run.mjs testflight
```

### Flags

| Flag | Effect |
|------|--------|
| `--dry-run` | Skip EAS build (alias intent with skip-build) |
| `--skip-build` | Run all validation; skip Step 9 EAS build |

Example (validation only):

```bash
npm run prepare:testflight -- --skip-build
```

---

## Pipeline (10 steps)

| Step | Name | STOP on FAIL |
|------|------|--------------|
| 1 | Git Validation | ✅ |
| 2 | Production Readiness Gate | ✅ |
| 3 | AI Platform Validation (static + `--live`) | ✅ |
| 4 | Preview Deploy Report | ✅ |
| 5 | SQL Permission Audit | ✅ |
| 6 | Release Notes | — |
| 7 | TestFlight Checklist | — |
| 8 | Version Validation | ✅ |
| 9 | Preview Build (`eas build --profile preview --platform ios`) | ✅ |
| 10 | Generate `docs/TESTFLIGHT_PREPARATION.md` | — |

### Final status (exactly one)

```
READY FOR TESTFLIGHT
```

or

```
BLOCKED
```

---

## Prepare Production

**Only after:**

- TestFlight passed
- iPhone QA passed
- AI QA passed
- Production Readiness Gate passed

### Sign-off files (CEO / QA)

Set `passed: true` in:

- `docs/release-signoffs/testflight-qa.json`
- `docs/release-signoffs/iphone-qa.json`
- `docs/release-signoffs/ai-qa.json`

Example:

```json
{
  "passed": true,
  "approvedBy": "CEO",
  "approvedAt": "2026-07-09T00:00:00.000Z",
  "notes": "TestFlight QA complete"
}
```

### Run

```bash
npm run prepare:production
# or
./scripts/prepare-production.sh
```

**Does NOT:** submit App Store · deploy Production app · push git.

Production prep runs the same validation steps; EAS **production** build is skipped by default (explicit CEO GO required).

Final status:

```
READY FOR PRODUCTION PREP
```

or

```
BLOCKED
```

---

## Prepare Release X.Y.Z

Validate that `app.json` / `package.json` version matches target, then run full TestFlight pipeline.

```bash
./scripts/prepare-release.sh 1.6.0
# or
npm run prepare:release -- 1.6.0
```

Example with validation only:

```bash
./scripts/prepare-release.sh 1.5.9 --skip-build
```

---

## Outputs

| Artifact | Path |
|----------|------|
| TestFlight report | `docs/TESTFLIGHT_PREPARATION.md` |
| Run JSON | `scripts/release-command-center/reports/latest-run.json` |
| Release notes | `scripts/release-command-center/reports/release-notes.json` |
| AI readiness | `scripts/ai-platform-v2/reports/readiness-latest.json` |
| AI validation | `scripts/ai-platform-v2/reports/latest.json` |
| DB permissions | `scripts/ai-platform-v2/reports/db-permissions.json` |
| Preview deploy | `docs/PREVIEW_DEPLOY_REPORT.md` |

---

## Step details

### Step 1 — Git Validation

- Clean working tree (no uncommitted changes)
- Current branch
- Agent worktrees (`.worktrees/` — WARNING if present)
- Merge conflict markers
- Pending migrations (local vs linked Supabase)

### Step 2 — Production Readiness Gate

Runs `npm run ai-platform:readiness`  
Collects PASS / WARNING / FAIL from 67 checks.

### Step 3 — AI Platform Validation

```bash
npm run ai-platform:validate
npm run ai-platform:validate -- --live
```

### Step 4 — Preview Deploy Report

Verifies: preview deploy · rollback · feature flags · legacy · router · fallback · cache · prompts · observability · cost logging.

### Step 5 — SQL Permission Audit

`npm run ai-platform:verify-db-permissions`

Tables: `user_subscriptions`, `ai_usage_events`  
Roles: `service_role`, `authenticated`, `anon`

### Step 6 — Release Notes

Auto-generated: summary · changelog (git log) · known issues · migration list.

### Step 7 — TestFlight Checklist

Manual iPhone QA sections: AI Coach · Market Intelligence · Achievements · Share · PDF · Sync · Voice · Photos · i18n · Dark Mode · Performance · Offline · Rollback drill.

### Step 8 — Version Validation

- `expo.version` · iOS `buildNumber` · `runtimeVersion`
- Bundle ID `com.youtrader.pro`
- EAS preview/production profiles
- RevenueCat entitlement env
- Linked Supabase project

### Step 9 — Preview Build

```bash
eas build --profile preview --platform ios --non-interactive --wait --json
```

Collects: build URL · duration · status · errors.

### Step 10 — Report

Generates `docs/TESTFLIGHT_PREPARATION.md` with all sections + final gate.

---

## Safety rules

| Rule | Enforced |
|------|----------|
| Never deploy Production | ✅ |
| Never submit App Store | ✅ |
| Never git push | ✅ |
| Never auto-merge | ✅ |
| STOP on any critical FAIL | ✅ |
| CEO approval for Production | Sign-off JSON files |

---

## Related docs

- [PRODUCTION_READINESS_GATE.md](./PRODUCTION_READINESS_GATE.md)
- [PREVIEW_DEPLOY_REPORT.md](./PREVIEW_DEPLOY_REPORT.md)
- [DB_PERMISSION_REVIEW.md](./DB_PERMISSION_REVIEW.md)
- [AI_PLATFORM_V2_VALIDATION.md](./AI_PLATFORM_V2_VALIDATION.md)
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| Git dirty tree | Commit or stash; re-run |
| AI live validation fails | Check Supabase secrets · Pro GRANT · `ai-coach` v15+ |
| DB permission FAIL | Apply migration `20260709203000` |
| EAS build fails | `eas login` · credentials · `--skip-build` to validate first |
| Prepare Production blocked | Complete QA sign-offs in `docs/release-signoffs/` |

---

## Architecture

```text
prepare-testflight.sh
  └─► scripts/release-command-center/run.mjs
        ├─► steps/git-validation.mjs
        ├─► steps/production-readiness.mjs
        ├─► steps/ai-validation.mjs
        ├─► steps/preview-deploy.mjs
        ├─► steps/sql-permissions.mjs
        ├─► steps/release-notes.mjs
        ├─► steps/testflight-checklist.mjs
        ├─► steps/version-validation.mjs
        ├─► steps/preview-build.mjs
        └─► generate-report.mjs → docs/TESTFLIGHT_PREPARATION.md
```

This is the **standard release workflow** for YouTrader.
