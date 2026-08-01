# Working Tree Classification — final actions 2026-08-01 (continuation)

Initial dirty ≈400. After ignores + commits: **14** residual paths.

## Bulk outcomes applied

| Class | Outcome |
|-------|---------|
| D `build/` | **gitignore** |
| E `.codex/`, `.cursor/plans/` | **gitignore** |
| C phase4f / first-launch / simulator-recovery / stats-redesign / qa-logs dumps | **gitignore** (reports `.md` remain commitable) |
| G `*.bak` | **gitignore**; bak deleted from tree |
| F credentials | already relocated; guard PASS |

## Product paths — final action

| Path | Action | Commit |
|------|--------|--------|
| `src/app/ai/*` (required modules) | commit verified | `ad4a246` |
| `src/app/theme.ts`, `ui/`, `utils/` | commit verified | `13b548e` |
| `src/app/styles.ts`, `TraderStatusDashboard`, `startupPerf` | commit verified | `fae51eb` |
| `src/config/growthConfig.ts` | commit verified | `b7b7435` |
| PI migration + processor + contracts | commit verified | `cec49fe` |
| Edge AI/market-intel staging | commit verified (undeployed) | `763b61b` |
| Contract selftests + RC handoff + high-risk audit | commit verified | `9adae1e` |
| Simulator/physical harnesses | commit verified | `8126cd8` |
| Calculator/stats QA helpers | commit verified | `2c4647b` |
| `.gitignore` hygiene | commit verified | `7c0f67a` |

## Residual dirty (documented incomplete / local)

| Path | Classification | Action |
|------|----------------|--------|
| `.cursor/mcp.json` | E local | exclude (tracked override; do not commit tokens) |
| `AGENTS.md` | E docs | keep WIP / optional later |
| `docs/MY_UI.md` | E docs | keep WIP |
| `docs/releases/.../simulator-recovery/prop-pass-home-with-snapshot.png` | C tracked evidence | preserve; folder newly gitignored for untracked only |
| `scripts/apply-i18n-*.mjs`, `i18n-batch-add.mjs` | H incomplete i18n tooling | preserve WIP |
| `scripts/translations/{de,es,fr,it,uk}.json` | H incomplete | preserve WIP |

## Status

Dirty path target: **minimal documented WIP only** — **CODE PASS** for reduction (400→14).
