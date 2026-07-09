# YouTrader AI Development Workflow

Last updated: 2026-07-08

This document defines the **single orchestration architecture** for all AI-assisted YouTrader development and releases.

**Rules:**
- **Releases:** CEO → **AI Release Manager** only (`Prepare Release X.Y.Z`)
- **Knowledge:** CEO → **AI Project Historian** (`Why is …?`, `Record decision:`)

Related docs:

- Tooling setup: [AI_DEV_TOOLS_SETUP.md](./AI_DEV_TOOLS_SETUP.md)
- Release: [AI_RELEASE_MANAGER.md](./AI_RELEASE_MANAGER.md)
- **Knowledge / history:** [AI_PROJECT_HISTORIAN.md](./AI_PROJECT_HISTORIAN.md)
- MCP / Context7 / Playwright: [AI_DEV_WORKFLOW.md](./AI_DEV_WORKFLOW.md)
- App Store checklist: [APP_STORE_RELEASE_CHECKLIST.md](./APP_STORE_RELEASE_CHECKLIST.md)

---

## Agent hierarchy

```
CEO (Human Product Owner)
│
└── AI Release Manager                    ← releases (Prepare Release X.Y.Z)
      │
      ├── Parallel Code Manager
      │      ├── Agent 1 — Bug Fixes      (senior-rn / worktree)
      │      ├── Agent 2 — UI             (ui-ux / worktree)
      │      ├── Agent 3 — ASO            (aso / worktree)
      │      ├── Agent 4 — Product        (DeerFlow / read-only)
      │      └── Agent 5 — Research       (DeerFlow / read-only)
      │
      ├── Senior Code Reviewer            (code-reviewer / read-only)
      ├── AI QA Engineer                  (qa-engineer / read-only)
      ├── Localization Auditor            (localization-auditor / read-only)
      ├── Security Auditor                (supabase-security / read-only audit)
      ├── Performance Auditor             (performance-auditor / read-only)
      ├── App Store Release Auditor
      └── (Step 26 → Project Historian records history)

CEO (Human) — also direct:
└── AI Project Historian              ← knowledge & "Why?" questions
```

**Knowledge workflow:** CEO → **AI Project Historian** (`Why is …?`, `Record decision:`).

### Canonical config

| File | Purpose |
|------|---------|
| `~/Projects/ai-dev-tools/youtrader/orchestration/hierarchy.json` | Agent tree + profile IDs |
| `~/Projects/ai-dev-tools/youtrader/orchestration/workflows/prepare-release.json` | 26-step release workflow |
| `~/Projects/ai-dev-tools/youtrader/history/manifest.json` | Historian knowledge store |
| `~/Projects/ai-dev-tools/youtrader/parallel-code/manifest.json` | Parallel Code profile registry |

Print hierarchy anytime:

```bash
~/Projects/ai-dev-tools/scripts/orchestration-youtrader-status.sh
```

---

## Responsibilities

### CEO (Human)

- Sets release target (`Prepare Release 1.6.0`)
- Approves **every step** before the Release Manager continues
- Executes merges, EAS builds, and App Store submission manually
- Never bypasses auditors for production releases

### AI Release Manager

- Sole interface for the CEO during releases
- Orchestrates all sub-agents in order
- Writes reports under `docs/releases/X.Y.Z/`
- Reports final status: **READY FOR TESTFLIGHT** · **READY FOR APP STORE** · **BLOCKED**
- **Never** modifies app code, merges, pushes, uploads, or submits

### AI Project Historian (Chief Knowledge Officer)

- Permanent engineering memory in `docs/history/` (10 documents)
- Answers **Why is this implemented this way?** from recorded history — never guesses
- Records releases, decisions, features, debt, bugs, ASO, roadmap, AI evolution
- Invoked after Release Step 26: **Record release X.Y.Z**
- **Never** writes app code, commits, or merges
- If unknown: *Unknown — decision predates recorded history.*

See [AI_PROJECT_HISTORIAN.md](./AI_PROJECT_HISTORIAN.md).

### Parallel Code Manager

- Launches Agents 1–3 in isolated git worktrees
- Launches Agents 4–5 via DeerFlow (reports only, no app diffs)
- Collects worktree logs, commits, and diff stats for the Release Manager

### Worker agents (Parallel Code)

| Agent | Profile ID | Writes code? | Runtime |
|-------|------------|--------------|---------|
| Bug Fixes | `senior-rn` | Yes (worktree) | Parallel Code + Codex |
| UI | `ui-ux` | Yes (worktree) | Parallel Code + Codex |
| ASO | `aso` | Docs only preferred | Parallel Code + Codex |

### Worker agents (DeerFlow)

| Agent | Workflow ID | Writes code? |
|-------|-------------|--------------|
| Product | `journal-feature-ideas` | No — markdown report |
| Research | `reddit-trader-pains` | No — markdown report |

### Auditors (read-only)

| Auditor | Profile ID | Primary output |
|---------|------------|----------------|
| Senior Code Reviewer | `code-reviewer` | Merge verdicts in `RELEASE_REPORT.md` |
| AI QA Engineer | `qa-engineer` | `QA_REPORT.md` |
| Localization Auditor | `localization-auditor` | `LOCALIZATION_REPORT.md` |
| Security Auditor | `supabase-security` | `SECURITY_REPORT.md` |
| Performance Auditor | `performance-auditor` | `PERFORMANCE_REPORT.md` |
| App Store Release Auditor | `app-store-release-auditor` | `APP_STORE_CHECKLIST.md` |

---

## Execution order — Prepare Release

Trigger in Cursor (or Parallel Code → **YouTrader · AI Release Manager**):

```
Prepare Release 1.6.0
```

**Every step requires CEO approval** before the next step begins.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Validate Git | Release Manager |
| 2 | Launch Parallel Code agents | Parallel Code Manager |
| 3 | Collect all worktree results | Parallel Code Manager |
| 4 | Launch Senior Code Reviewer | Senior Code Reviewer |
| 5 | Generate merge recommendations | Release Manager |
| 6 | Wait for CEO approval (merge plan) | CEO |
| 7 | Merge approved worktrees | CEO (Release Manager verifies) |
| 8 | Launch QA Engineer | AI QA Engineer |
| 9 | Launch Localization Auditor | Localization Auditor |
| 10 | Launch Security Auditor | Security Auditor |
| 11 | Launch Performance Auditor | Performance Auditor |
| 12 | Launch App Store Release Auditor | App Store Release Auditor |
| 13 | Verify RevenueCat | App Store Release Auditor |
| 14 | Verify Supabase | Security Auditor |
| 15 | Verify Sentry | Security Auditor |
| 16 | Verify PostHog | Security Auditor |
| 17 | Verify App Store metadata | App Store Release Auditor |
| 18 | Verify build number | Release Manager |
| 19 | Verify version | Release Manager |
| 20 | Run Preview Build | CEO + Release Manager |
| 21 | Analyze build logs | Release Manager |
| 22 | Generate Release Notes | Release Manager |
| 23 | Generate QA Checklist | AI QA Engineer |
| 24 | Generate Manual iPhone Test Plan | AI QA Engineer |
| 25 | Report final status | Release Manager |
| 26 | Record release in project history | Project Historian |

### Forbidden actions (all agents)

- Auto-merge
- Auto-push
- Auto-upload to TestFlight
- Auto-submit to App Store
- Skip QA or ignore WARN/FAIL without documenting in `KNOWN_ISSUES.md`

---

## Command examples

### Start a release (CEO)

```bash
# Phase 1 bootstrap + report templates
~/Projects/ai-dev-tools/scripts/prepare-youtrader-release.sh 1.6.0

# Copy full Release Manager prompt
~/Projects/ai-dev-tools/scripts/release-youtrader-prompt.sh 1.6.0 --copy
```

In Cursor chat:

```
Prepare Release 1.6.0
```

Approve each step explicitly, e.g.:

```
Approved — proceed to step 2
```

### Parallel agents (Step 2 — delegated)

```bash
~/Projects/ai-dev-tools/scripts/launch-youtrader-5-agents.sh
```

Monitor:

```bash
tail -f ~/Projects/ai-dev-tools/logs/youtrader-agents/session-*/agent-*.log
git worktree list
```

### Senior review (Step 4)

```bash
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh code-reviewer --copy
```

### QA pipeline (Step 8)

```bash
cd ~/Projects/youtrader-final
npm run typecheck
npm run translations:check
expo export --platform ios
```

### Auditor prompts

```bash
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh qa-engineer --copy
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh localization-auditor --copy
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh supabase-security --copy
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh performance-auditor --copy
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh app-store-release-auditor --copy
```

### Parallel Code setup (one-time / after agent changes)

```bash
~/Projects/ai-dev-tools/scripts/configure-parallel-code-youtrader.sh
~/Projects/ai-dev-tools/scripts/verify-parallel-code-youtrader.sh
```

---

## Release artifacts

Each release produces:

```
docs/releases/1.6.0/
├── RELEASE_REPORT.md       # Master 25-step log
├── QA_REPORT.md
├── SECURITY_REPORT.md
├── LOCALIZATION_REPORT.md
├── PERFORMANCE_REPORT.md
├── CHANGELOG.md
├── RELEASE_NOTES.md
├── KNOWN_ISSUES.md
├── MANUAL_TESTING.md
└── APP_STORE_CHECKLIST.md
```

Templates: `~/Projects/ai-dev-tools/youtrader/release/templates/`

---

## Non-release development (day-to-day)

For ad-hoc tasks **outside** a release, you may still use Parallel Code directly — but for production-bound work, route through the Release Manager before TestFlight.

| Task type | Entry point |
|-----------|-------------|
| Single bug fix | Cursor + `senior-rn` preset |
| UI polish | Cursor + `ui-ux` preset |
| Research only | DeerFlow workflow |
| Full release | **Prepare Release X.Y.Z** only |

---

## Infrastructure stack

```
Cursor / Codex
      │
      ▼
9Router (:20128) ──► OpenRouter
      │
      ├── Parallel Code ──► git worktrees (Agents 1–3)
      │
      └── DeerFlow (:2026) ──► read-only research (Agents 4–5)
```

Secrets: `~/.config/youtrader-ai/.env` — **never** in Expo public env.

---

## Future extension points

The hierarchy is designed to add agents without changing CEO workflow.

| Extension | How to add |
|-----------|------------|
| New parallel worker | Add profile to `parallel-code/manifest.json`, map under `parallel-code-manager` in `hierarchy.json`, add mission to `launch-youtrader-5-agents.sh` |
| New release auditor | Add `agents/<name>.md`, register read-only profile, add step to `prepare-release.json`, add report template |
| Project historian domains | Add section to `docs/history/` + template in `ai-dev-tools/youtrader/history/templates/` |
| Android release | Duplicate workflow JSON with platform-specific steps; same Release Manager trigger |
| CI gate | Wire `prepare-youtrader-release.sh` + typecheck/export in GitHub Actions; Release Manager consumes CI logs in Step 21 |
| Maestro E2E | QA Engineer runs `docs/MAESTRO_SMOKE_TESTS.md` in Step 8 |
| Automated merge bot | **Not allowed** without explicit architecture change — CEO merge remains Step 7 |
| Staging environment | Add Step 13.5 Supabase branch verification via Supabase MCP |
| Localization service | Localization Auditor exports missing keys CSV for translators |
| Performance budgets | Performance Auditor enforces max bundle size / startup ms thresholds in `PERFORMANCE_REPORT.md` |

To extend:

1. Edit `orchestration/hierarchy.json`
2. Edit `orchestration/workflows/prepare-release.json`
3. Run `configure-parallel-code-youtrader.sh`
4. Update this document

---

## Quick reference

| I want to… | Command / phrase |
|------------|------------------|
| Start release | `Prepare Release 1.6.0` |
| Record release history | `Record release 1.6.0` |
| Ask why something exists | `Why is … implemented this way?` |
| Init history docs | `init-youtrader-history.sh --seed` |
| See hierarchy | `orchestration-youtrader-status.sh` |
| Bootstrap reports | `prepare-youtrader-release.sh 1.6.0` |
| Launch 5 agents | `launch-youtrader-5-agents.sh` |
| Copy agent prompt | `pc-youtrader-prompt.sh <id> --copy` |
| Historian prompt | `historian-youtrader-prompt.sh --copy` |
| Configure Parallel Code | `configure-parallel-code-youtrader.sh` |

**Remember:** Releases → **AI Release Manager**. Knowledge → **AI Project Historian**.
