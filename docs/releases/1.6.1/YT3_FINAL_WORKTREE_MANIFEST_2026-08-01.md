# Final worktree manifest — 2026-08-01

Build **1.6.1 (113)**. Phase 4F FAILED / OPEN / NO-GO.

## Target

Clean worktree after resolving the final 12 residual paths.

## Path outcomes

| Path | Owner | Reason | Status | Action | Related commit | Release impact |
|------|-------|--------|--------|--------|----------------|----------------|
| `.cursor/mcp.json` | Tooling | Local MCP config; may contain tokens | resolved | **restore** to HEAD (exclude) | — | None |
| `AGENTS.md` | Engineering docs | DOCUMENT_HIERARCHY pointer | resolved | **commit** | `233dce6` | Docs only |
| `docs/MY_UI.md` | Design docs | YDL pointer | resolved | **commit** | `233dce6` | Docs only |
| `docs/releases/.../prop-pass-home-with-snapshot.png` | QA evidence | Accidental binary drift on tracked PNG | resolved | **restore** to HEAD | — | None |
| `scripts/apply-i18n-final-app.mjs` | i18n tooling | Unlock copy → Performance details | resolved | **commit** | `d20dd90` | Tooling only |
| `scripts/apply-i18n-replacements.mjs` | i18n tooling | Same wording alignment | resolved | **commit** | `d20dd90` | Tooling only |
| `scripts/i18n-batch-add.mjs` | i18n tooling | Locale seed for unlock key | resolved | **commit** | `d20dd90` | Tooling only |
| `scripts/translations/de.json` | i18n tooling | Remove stale trial/AI unlock keys; add 7-day key | resolved | **commit** | `d20dd90` | Tooling only (not runtime locales) |
| `scripts/translations/es.json` | i18n tooling | Same | resolved | **commit** | `d20dd90` | Tooling only |
| `scripts/translations/fr.json` | i18n tooling | Same | resolved | **commit** | `d20dd90` | Tooling only |
| `scripts/translations/it.json` | i18n tooling | Same | resolved | **commit** | `d20dd90` | Tooling only |
| `scripts/translations/uk.json` | i18n tooling | Same | resolved | **commit** | `d20dd90` | Tooling only |

## Architecture freeze (until live E2E)

Frozen: onboarding funnel, paid-only access, paywall copy/plan UX, Journal lifecycle, Prop Pass IA, Stats/Radar/Heatmap, Settings/More nav, AI terminology removal, startup state machine.

Allowed only: proven regression, live integration failure, a11y/layout/security/App Store compliance.

## Final dirty-path count

**0** after commits `233dce6`, `d20dd90`, and baseline packaging commit (expect clean `git status`).
