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

---

1. Absolute local repository path: `/Users/valentynborovyk/Projects/youtrader-final`
2. Final branch: `release/1.6.1-build-115`
3. Final HEAD at archive: `bc97e1f47adb736fe721639d40a5073ce9dd9a63` (later docs/release commits may follow)
4. Final TestFlight tag: `testflight-1.6.1-115` (create/push after ASC processing confirmation + clean tree)
5. Public version / build: **1.6.1 / 115**
6. TestFlight upload status: **UPLOADED** via EAS Submit (`6a559e78-62ef-44a0-b34e-4fc902f74324`) at `2026-08-02T16:50:03Z`
7. App Store Connect build status: **PROCESSING** at handoff (poll ASC TestFlight)
8. Internal testing assignment: **NOT ENABLED yet** — ASC browser session required 2FA; add build 115 to existing internal group when Ready to Test
9. Working tree: may include untracked historical evidence under `docs/releases/1.6.1/` — do not commit secrets, DerivedData, IPA, archives
10. Important commits (newest first at archive time):
    - `bc97e1f` test(release): complete final build 115 gates
    - `d69b8e3` fix(ui): finish production visual consistency
    - `4f1fa18` refactor(prop-pass): consolidate actionable risk states
    - `96c14eb` fix(stats): finish radar and heatmap contrast
    - `bae35a6` refactor(journal): simplify signed pnl trade entry
    - plus prior Futures / Prop Pass / heatmap work on branch

11. Architecture: Expo React Native TypeScript; orchestration in `App.tsx` / `src/app/YouTraderApp.tsx`; Prop Pass under `src/propPass/`; Stats under `src/stats/`; YDL UI in `src/ydl/`.
12. Main paths:
    - Journal / Add Trade: `src/app/YouTraderApp.tsx`
    - Signed P&L helpers: `src/journal/manualPnl.ts`
    - Futures hub: `src/app/MoreScreen.tsx` (route id `more`)
    - Tab bar: `src/ydl/shell/YdlTabBar.tsx`
    - Radar: `src/stats/StatsRadarCard.tsx`, `src/stats/performanceRadar.ts`
    - Heatmap: `src/stats/StatsHeatmapCard.tsx`
    - Prop Pass screen: `src/propPass/PropPassInternalScreen.tsx`
    - Risk modes: `src/propPass/riskModes.ts`, `src/propPass/ui/PropPassRiskModePanel.tsx`
13. Journal/Add Trade data flow: day panel → openNew/openEdit → signed P&L validates via `resolveSignedTradePnl` → `validateTradeForm` → local journal persistence / sync unchanged.
14. Stats/Radar/Heatmap: deterministic from journal trades only; no fabricated scores.
15. Prop Pass engine: `buildPropPassRiskModePlan` — percents of session risk budget (min daily room, drawdown room, challenge remaining objective); never full deposit.
16. Challenge/Live: UI context chips; Live hides challenge-only wins-to-target framing.
17. Calm/Balanced/Gambler: bands + hard caps; Gambler requires confirm.
18. RevenueCat: entitlement `YouTrader Pro`; products include `youtrader_pro_weekly`, monthly (`youtrader_pro_monthly`), yearly (`youtrader_pro_yearly__`); public SDK key from EAS production env.
19. Supabase: production `izzrlsgumyabdvlmwlwn`; staging CLI `zleojeqkzizeyerhjpur`.
20. Auth: Supabase Auth + native Apple/Google; Apple token store via Edge Function.
21. Edge Functions (production): `store-apple-auth-token` v3, `delete-account` v3 (verify dashboard if versions drift).
22. Apple token lifecycle: **stored:true NOT closed** — disposable SIWA required on production 115.
23. Account deletion: Google disposable PASS; Apple revoke pending stored:true.
24. Commands:
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
bash scripts/qa/build-release-production-115-device.sh
```
25. Env var names only: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_REVENUECAT_*`, `EXPO_PUBLIC_GOOGLE_*`, `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN`, `EXPO_PUBLIC_YT_*`, `APP_ENV`.
26. Credentials: EAS production env / `.env.eas.production` (gitignored); ASC API key on EAS servers (`96YCZY2GGJ`); never commit `.p8` / service role.
27. QA evidence: `docs/releases/1.6.1/evidence/build115-release-20260802/`, `docs/releases/1.6.1/evidence/deletion-smoke-20260802/`, physical RS113 under `phase4f-screenshots/physical/pre115-regression-20260802/`.
28. Expo Doctor: known **16/18**.
29. Aikido MCP invalid token: non-blocking when local security gates pass.
30. Remaining: Apple stored:true/revoke; ASC processing → internal group; optional Weekly env explicitness already defaulted in code; post-115 product polish for Codex only with new auth.
31. **WARNING: build 116 requires new user authorization.**
32. **WARNING: do not submit or release without user authorization.**

Operator Apple steps: `docs/releases/1.6.1/evidence/deletion-smoke-20260802/APPLE_STORED_TRUE_OPERATOR.md`
