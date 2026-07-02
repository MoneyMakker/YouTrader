---
name: caveman
description: Use for YouTrader coding sessions to reduce token waste and avoid overengineering. Forces small diffs, direct file inspection, minimal context loading, and plain status updates before changing code.
---

# Caveman

Use this skill when a YouTrader task risks becoming broad, repetitive, or token-heavy.

## Rules

- Read the smallest useful files first.
- Use `rg` before opening large files.
- Prefer one small patch over a rewrite.
- Do not restate huge docs unless the user asks.
- Do not create abstractions unless they remove real complexity.
- Do not touch Supabase, RevenueCat, build config, or app logic unless required by the task.
- Keep final answers short: what changed, what passed, what remains.

## Workflow

1. Run `git status`.
2. Search for exact symbols/files.
3. Inspect only relevant code ranges.
4. Make the smallest safe change.
5. Run requested validation.
6. Summarize with file paths and results.

## Stop Conditions

Stop and ask or document manual steps when a task needs:

- Production credentials.
- Dashboard-only setup.
- Unclear package installation.
- Risky dependency changes.
- Schema changes not explicitly requested.
