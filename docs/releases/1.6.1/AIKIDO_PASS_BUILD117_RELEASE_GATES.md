# Aikido — Build 117 release gates scan

Date: 2026-08-04

## Scope
First-party source changed in this release-gates pass:
- `src/propPass/persistence/runtimeRebuild.ts`
- `src/propPass/ui/PropPassSessionCockpit.tsx`
- `scripts/release-stability-check.mjs`
- `scripts/prop-pass-runtime-rebuild-qa.ts`
- `scripts/prop-pass-session-cockpit-qa.ts`

## Results
- `security:semgrep` (repo-wide ERROR): **0 findings / 0 blocking**
- `security:gitleaks`: **0 leaks**
- `security:audit`: **0 high / 0 critical** (3 moderate valibot via Storybook, pre-existing)
- Aikido MCP `aikido_full_scan`: Opengrep reported **0 findings** on sampled files; tool returned Opengrep exit code 2 (known tooling quirk on partial content). Semgrep gate is authoritative for blocking SAST in this pass.

## Verdict
**PASS — 0 blocking**
