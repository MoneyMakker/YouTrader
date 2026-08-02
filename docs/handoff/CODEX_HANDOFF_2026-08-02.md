# Codex Handoff — YouTrader 1.6.1 (115)

## CODEX START HERE

```bash
cd /Users/valentynborovyk/Projects/youtrader-final
git fetch origin
git checkout release/1.6.1-build-115
git pull --ff-only
git log --oneline --decorate -15
git status --short
```

Expected after pull: clean working tree (`git status --short` empty).

Tooling baseline observed at handoff: Node `v22.22.3`, npm `10.9.8`.

---

1. Absolute local repository path: `/Users/valentynborovyk/Projects/youtrader-final`
2. Final branch: `release/1.6.1-build-115`
3. Final HEAD (docs cleanup may add a descendant): see `git rev-parse HEAD` after pull; TestFlight binary source commit remains `2c6cd5b372518ba809292b57b1021ffa0815ad42`
4. Final TestFlight tag: `testflight-1.6.1-115` → commit `2c6cd5b` (**do not move/force-update this tag**)
5. Public version / build: **1.6.1 / 115**
6. TestFlight upload status: **UPLOADED** via EAS Submit (`6a559e78-62ef-44a0-b34e-4fc902f74324`) at `2026-08-02T16:50:03Z` — see tracked `docs/releases/1.6.1/evidence/build115-release-20260802/UPLOAD.json`
7. App Store Connect build status: **PROCESSING** at upload handoff (poll ASC TestFlight; do not upload again)
8. Internal testing assignment: **NOT ENABLED yet** — requires ASC operator session after Ready to Test; add only to an **existing internal** group
9. Working tree: must be **CLEAN** for Codex start; local QA dumps (if any) are ignored under `artifacts/` and are optional
10. Important commits (newest application/release lineage before/at TF tag):
    - `2c6cd5b` chore(release): prepare YouTrader 1.6.1 build 115
    - `bc97e1f` test(release): complete final build 115 gates
    - `d69b8e3` fix(ui): finish production visual consistency
    - `4f1fa18` refactor(prop-pass): consolidate actionable risk states
    - `96c14eb` fix(stats): finish radar and heatmap contrast
    - `bae35a6` refactor(journal): simplify signed pnl trade entry
11. Architecture: Expo React Native TypeScript; orchestration in `App.tsx` / `src/app/YouTraderApp.tsx`; Prop Pass under `src/propPass/`; Stats under `src/stats/`; YDL UI in `src/ydl/`.
12. Main paths (all tracked):
    - Journal / Add Trade: `src/app/YouTraderApp.tsx`
    - Signed P&L helpers: `src/journal/manualPnl.ts`
    - Futures hub: `src/app/MoreScreen.tsx` (route id `more`)
    - Tab bar: `src/ydl/shell/YdlTabBar.tsx`
    - Radar: `src/stats/StatsRadarCard.tsx`, `src/stats/performanceRadar.ts`
    - Heatmap: `src/stats/StatsHeatmapCard.tsx`
    - Prop Pass screen: `src/propPass/PropPassInternalScreen.tsx`
    - Risk modes: `src/propPass/riskModes.ts`, `src/propPass/ui/PropPassRiskModePanel.tsx`
13. Journal/Add Trade data flow: day panel → openNew/openEdit → signed P&L via `resolveSignedTradePnl` → `validateTradeForm` → local journal persistence / sync unchanged.
14. Stats/Radar/Heatmap: deterministic from journal trades only; no fabricated scores.
15. Prop Pass engine: `buildPropPassRiskModePlan` — percents of session risk budget (min daily room, drawdown room, challenge remaining objective); never full deposit.
16. Challenge/Live: UI context chips; Live hides challenge-only wins-to-target framing.
17. Calm/Balanced/Gambler: bands + hard caps; Gambler requires confirm.
18. RevenueCat: entitlement `YouTrader Pro`; products include `youtrader_pro_weekly`, monthly (`youtrader_pro_monthly`), yearly (`youtrader_pro_yearly__`); public SDK key from EAS production env (never commit values).
19. Supabase: production project ref `izzrlsgumyabdvlmwlwn`; staging CLI ref `zleojeqkzizeyerhjpur`.
20. Auth: Supabase Auth + native Apple/Google; Apple token store via Edge Function.
21. Edge Functions (production): `store-apple-auth-token` v3, `delete-account` v3 (verify dashboard if versions drift).
22. Apple token lifecycle: **stored:true NOT closed** — disposable SIWA required on production 115 (operator doc tracked below).
23. Account deletion: Google disposable **PASS** (tracked JSON); Apple revoke pending stored:true.
24. Commands (safe; no secrets; do **not** upload/rebuild 115 unless newly authorized):
```bash
npm ci
npm run typecheck
npm run translations:check
npm run test:email-password
npm run test:revenuecat-mobile-identity
npm run test:revenuecat-entitlement
npm run release:stability
npm run security:check
npm run security:audit
npm run security:gitleaks
npm run security:semgrep
npx tsx scripts/qa/final-add-trade-115.selftest.ts
npx expo export --platform ios --output-dir /tmp/youtrader-final-115-export
# Production archive script exists for regeneration only — do not create build 116 / do not upload without authorization:
# bash scripts/qa/build-release-production-115-device.sh
```
25. Env var **names** only: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_REVENUECAT_*`, `EXPO_PUBLIC_GOOGLE_*`, `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN`, `EXPO_PUBLIC_YT_*`, `APP_ENV`.
26. Credentials: EAS production env / gitignored `.env.eas.production`; ASC API key hosted on EAS (Key ID `96YCZY2GGJ` is a public key identifier, not a secret); never commit `.p8` / service role / tokens.
27. QA evidence (tracked index): `docs/releases/1.6.1/evidence/EVIDENCE_INDEX.md`  
    Tracked folders: `docs/releases/1.6.1/evidence/build115-release-20260802/`, `docs/releases/1.6.1/evidence/deletion-smoke-20260802/`  
    Optional local-only (ignored, not required): directory `artifacts/local-qa-handoff-20260802/`; ignored screenshot trees matching `docs/releases/**/phase4f-screenshots/` (gitignored).
28. Expo Doctor: known **16/18** (non-blocking).
29. Aikido MCP invalid token: non-blocking when local security gates pass.
30. Remaining product/operator work: Apple stored:true/revoke; ASC processing → internal group; no other product work in this cleanup.
31. **WARNING: build 116 requires new user authorization.**
32. **WARNING: do not submit or release without user authorization.**

Operator Apple steps: `docs/releases/1.6.1/evidence/deletion-smoke-20260802/APPLE_STORED_TRUE_OPERATOR.md`  
File inventory: `docs/handoff/CODEX_HANDOFF_FILE_INVENTORY_2026-08-02.md`  
Release status: `docs/releases/1.6.1/YT3_SCOPE_FREEZE_STATUS_2026-08-01.md`

## Handoff Integrity

- All required paths listed above are tracked in Git (or are intentionally optional/ignored local artifacts).
- Optional local artifacts are **not** required to continue engineering work.
- No secret values are stored in this handoff.
- Branch `release/1.6.1-build-115` contains the necessary source and documentation for Codex.
- TestFlight tag `testflight-1.6.1-115` remains unchanged and continues to identify the uploaded binary’s source commit `2c6cd5b`.
- Build **116** is **not** authorized.

## Self-check (cleanup)

| Check | Result |
|-------|--------|
| `docs/handoff/CODEX_HANDOFF_2026-08-02.md` exists + tracked | PASS |
| Required referenced source/docs/scripts exist + tracked | PASS |
| `docs/releases/1.6.1/evidence/EVIDENCE_INDEX.md` exists + tracked | PASS |
| No required handoff dependency ignored | PASS |
| No required handoff dependency untracked | PASS |
| Tag `testflight-1.6.1-115` local + remote → `2c6cd5b` | PASS |
| Branch `release/1.6.1-build-115` local + remote | PASS |
| Working tree clean after cleanup push | PASS (verify with `git status --short`) |
| Security scans on cleanup commit | PASS (see latest cleanup commit notes) |
| Build 116 absent / not created in cleanup | PASS |
| No App Store / TestFlight action in cleanup | PASS |
