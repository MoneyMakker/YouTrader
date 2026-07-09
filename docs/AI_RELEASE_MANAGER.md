# AI Release Manager — YouTrader

**CEO talks only to the Release Manager.** Full architecture: [AI_DEVELOPMENT_WORKFLOW.md](./AI_DEVELOPMENT_WORKFLOW.md)

## Trigger

```
Prepare Release 1.6.0
```

## Bootstrap

```bash
~/Projects/ai-dev-tools/scripts/prepare-youtrader-release.sh 1.6.0
~/Projects/ai-dev-tools/scripts/release-youtrader-prompt.sh 1.6.0 --copy
~/Projects/ai-dev-tools/scripts/orchestration-youtrader-status.sh
```

## 25 steps

Every step requires **your approval** before the next.

After Step 25, Step **26**: `Record release X.Y.Z` → Project Historian updates `docs/history/`.

1. Validate Git → 2. Launch parallel agents → 3. Collect results → 4. Senior review → 5. Merge recommendations → 6. Your approval → 7. You merge → 8–12. Auditors (QA, i18n, security, performance, App Store) → 13–16. RevenueCat, Supabase, Sentry, PostHog → 17–19. Metadata, build, version → 20–21. Preview build + logs → 22–24. Release notes, QA checklist, manual test plan → 25. Final status.

## Output

`docs/releases/X.Y.Z/` — ten report files (see AI_DEVELOPMENT_WORKFLOW.md).

## Final status

**READY FOR TESTFLIGHT** · **READY FOR APP STORE** · **BLOCKED**

Never auto-merge · never auto-push · never auto-upload · never auto-submit.
