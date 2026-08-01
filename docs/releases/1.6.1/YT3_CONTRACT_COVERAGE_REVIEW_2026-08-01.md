# Contract coverage review — 2026-08-01

Deterministic coverage vs live flows. Gaps filled with `productCoverageContract.selftest.ts` aggregate + existing suites.

| Live flow | Deterministic coverage | Gap |
|-----------|------------------------|-----|
| Weekly no trial | paywallPlanCopy + StoreKit + customerInfo | none (CONTRACT) |
| Monthly 3-day / Annual 7-day | trialEligibility + paywallPlanCopy + StoreKit | none |
| Eligibility / CTA / package routing | paywallPlanCopy + AcquisitionPaywall source guards | LIVE purchase NOT RUN |
| CustomerInfo / renewal / cancel / restore mapping | customerInfoContract fixtures | restore is presentation/routing only |
| Entitlement before auth / mandatory auth | acquisitionPhase + identityLinkContract | LIVE providers NOT RUN |
| Apple / Google / Email link | identityLinkContract (shared post-auth) | LIVE PROVIDER E2E NOT RUN |
| Failure/retry / isolation | identityLinkContract | LIVE NOT RUN |
| Journal / Stats / Calendar / Calculator | productCoverage source + calculator-risk-qa + bottomNav | deep journal lifecycle LIVE NOT RUN |
| Prop Pass / PI / News / Settings | propPassPresentation + piContract + newsFault + settingsIsolation | LIVE NOT RUN |
| Eligible 5-tab / deny 4-tab / Settings dock / Calendar More | bottomNavContract | device flash LIVE NOT RUN |

**Overall:** CONTRACT PASS · LIVE E2E NOT RUN · no blocking contract gaps for static baseline.
