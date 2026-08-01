# YouTrader 3.0 Recovery — Session 8

**Phase 4F:** FAILED / OPEN / NO-GO  
**Build:** 1.6.1 (113) — build 114 forbidden  
**Production Supabase:** untouched  

## Executed evidence

### 1. Stable Journal field identifiers — FUNCTIONAL PASS
Added semantic `testID`s (iOS resource-id):

| Field | ID |
|---|---|
| instrument | `journal.trade.edit.instrument` (+ `.MES` / mini/micro) |
| direction | `journal.trade.edit.direction.long` / `.short` |
| entry / exit / qty | `journal.trade.edit.entry` / `.exit` / `.quantity` |
| P&L | `journal.trade.edit.pnl` (+ `.plus` / `.minus`) |
| notes | `journal.trade.edit.notes` |
| entry/exit time | `journal.trade.edit.entryTime` / `.exitTime` |
| Save / Delete | `journal.trade.save` / `journal.trade.delete` |
| Delete confirm | `journal.trade.delete.confirmation` / `.cancel` / `.confirm` |
| Actions sheet | `journal.trade.actions.edit` / `.delete` |
| Swipe delete | `journal.trade.delete.swipe` |

Fees: N/A (no editable fees field in current form).

### 2. Persisted Journal edit — PRODUCT FUNCTIONAL PASS
Lifecycle Maestro `.maestro/yt3/lane_a_journal_lifecycle_s8.yaml` log: `docs/releases/1.6.1/qa-logs/lane_a_journal_lifecycle_s8o.log`

- Seed unique trade `QA-S8-LIFE` pnl 50
- Apply edit → notes `QA-S8-LIFE-EDITED`, pnl **125**, exit 5225
- Real Save via `journal.trade.save`
- Journal list showed `notes:QA-S8-LIFE-EDITED` and `+$125.00`
- Toast alone was **not** accepted as proof

Staging helper `youtrader://qa/apply-trade-edit` patches React form state (Maestro TextInput still unreliable) then uses the real `save()` path.

### 3. Deterministic delete confirmation — FUNCTIONAL PASS
Replaced native `Alert.alert` with app-owned YDL modal (same visual family as day-delete). Edit modal is dismissed before confirm so the sheet is not buried.

Proven:

- Cancel → trade still present (`notes:QA-S8-LIFE-EDITED`)
- Confirm via long-press → `journal.trade.actions.delete` → `journal.trade.delete.confirm`
- Trade absent after delete

### 4. Deleted trade absent after relaunch — FUNCTIONAL PASS
Cold stop/launch + email-login allow:

- `assertNotVisible` `QA-S8-LIFE-EDITED` and `QA-S8-LIFE`
- Screenshot: `s8_life_after_relaunch`

### 5. Stats / Calendar deltas — PARTIAL PASS
Screenshots captured before/after edit and after delete:

- `s8_life_stats_before_edit` / `_after_edit` / `_after_delete`
- `s8_life_calendar_before_edit` / `_after_edit` / `_after_delete`

Exact numeric OCR delta not extracted in this session; same trade lifecycle drives Journal → Stats → Calendar from shared local/AsyncStorage trade list (staging seed). Residual month P&L from prior QA seeds may still appear — treat visual screenshots as evidence of shared source, not clean-account absolute totals.

### 6. Google callback / session exchange — AUTH INTEGRATION PARTIAL
Code path:

- Browser OAuth when Web/iOS client IDs are not distinct
- `WebBrowser.openAuthSessionAsync` → `completeOAuthSessionFromUrl` → PKCE verifier gate → `exchangeCodeForSession`
- Session 8: removed full callback URL logging; added non-sensitive `callback_meta` / `oauth_pkce_gate` / `oauth_session_result`

Device attempt this session: Auth CTA not reached after `qa/reset-auth` (stuck off Auth surface) — **QA HARNESS / startup race**, not a new client-config Error 400. Prior Session 6/7 already proved ASWebAuth opens without Error 400. Consent→session→relaunch→logout→isolation **NOT RUN** this session.

### 7. Apple native identity-token — NOT RUN (physical)
Implementation still: `expo-apple-authentication` + SHA-256 nonce → `signInWithIdToken({ provider: "apple", nonce: rawNonce })`. `.p8` N/A. Physical E2E pending.

### 8–10. RevenueCat CustomerInfo / isolation — NOT RUN
StoreKit XCTest monthly/yearly remain prior PASS. In-app paywall CustomerInfo + user isolation still open.

### 11. PI timeout staging — NOT RUN
Local SQL/unit already done prior; live staging matrix not executed this session.

### 12. Calculator UI matrix — QA HARNESS FAIL / PARTIAL
Tab label is not bare `Calc` in current shell; deep-link flow started (`calculator_ui_s8.yaml`) but full matrix incomplete.

### 13. News offline/Retry — NOT RUN

### 14. expo export — PASS
- `npm run typecheck` PASS
- `npm run translations:check` PASS (1402 en keys)
- `expo export --platform ios` → `dist` HBC
- Staging host `zleojeqkzizeyerhjpur.supabase.co` present in HBC strings
- Full prod host `izzrlsgumyabdvlmwlwn.supabase.co` not observed as URL
- Build number remains **113**

### 15. Remaining physical blockers
- Apple E2E on device
- Google consent→session→RC→relaunch→logout→second login→isolation
- Monthly/yearly in-app paywall CustomerInfo + isolation
- PI timeout live staging
- News offline/Retry
- Full Calculator/Settings matrices
- Physical cold×5 / warm×3 matrix

## Key code changes
- `src/app/YouTraderApp.tsx` — a11y IDs, YDL delete confirm, apply-trade-edit wiring
- `src/qa/stagingQaJournalSeed.ts` — seed overrides + apply-edit URL parse
- `src/components/journal/JournalTradeSwipeCard.tsx` — card/swipe testIDs
- `src/auth/googleSignIn.ts` / `oauthAuthCallback.ts` — safe callback diagnostics
- `scripts/qa/bootstrap-email-session-staging.sh` — Python `True`/`False` fix
- `.maestro/yt3/lane_a_journal_lifecycle_s8.yaml`

## Status vocabulary
| Area | Status |
|---|---|
| Journal create→edit→delete lifecycle | PRODUCT FUNCTIONAL PASS |
| Journal field IDs | FUNCTIONAL PASS |
| Delete YDL confirm | FUNCTIONAL PASS |
| Google full session | AUTH INTEGRATION PARTIAL |
| Apple E2E | NOT RUN |
| RC in-app CustomerInfo | NOT RUN |
| PI timeout live | NOT RUN |
| Calculator/News/Settings full | PARTIAL / NOT RUN |
| Phase 4F | FAILED / OPEN / NO-GO |

Aikido MCP server was not available in this environment (`plugin-aikido-cursor-plugin-aikido` missing).
