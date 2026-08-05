# Build 117 — Concise Release Checkpoint

Updated: 2026-08-05 (PO reconfirm: physical auth-first PASS; next = Apple stored/revoke)

## Identity
- Branch: `feature/prop-pass-trading-os-build117`
- HEAD: `c95bb96`
- Version/build: `1.6.1 (117)`
- Candidate: `YT_BUILD_FP_v1:c95bb96:117:Release`
- IPA sha256: `02552c68df5ff8a33d5c18687dc833956bc86ec2af1cf5523d9fced25eac5622`
- Working tree: CLEAN

## PASS (do not re-run)
- Canonical Expo config; Expo Doctor; legacy FirstLaunchFunnel removed
- Account-first automated matrix; Aikido; full automated gates
- Candidate matches final HEAD
- Active user → Journal; inactive authenticated → Paywall; Paywall before login impossible
- Physical auth-first (PO 2026-08-05):
  - Onboarding→Auth; Apple login; Google login; Logout→Auth; Relaunch→Auth
  - Account A/B isolation; Manual Restore; CustomerInfo network recovery
  - **PHYSICAL AUTH-FIRST MATRIX: PASS**

## Remaining blockers (NOT PASS)
- Apple lifecycle gate (2026-08-05): sign-in/user-deleted/token-row-cleared observed; **missing sanitized `stored:true` + `appleRevoked:true` response bodies + Auth-return evidence** → FAIL
- Exact Weekly / Monthly / Yearly purchase flows
- Final clean App Store Distribution archive `1.6.1 (117)`
- TestFlight upload + processing + internal testing group
- Exact source tag

## Holds
- CLIENT WAKE-UPS: OFF
- GLOBAL REAL-USER ACTIVATION: OFF
- BUILD 118 CREATED: NO
- APP STORE REVIEW: NOT PERFORMED
- PUBLIC RELEASE: NOT PERFORMED
- FINAL ARCHIVE 117: NOT CREATED
- TESTFLIGHT UPLOAD: NOT PERFORMED
