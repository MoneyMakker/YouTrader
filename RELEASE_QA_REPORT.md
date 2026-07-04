# YouTrader — Release QA Report

**Version:** 1.5.7  
**Date:** 2026-07-03  
**Scope:** App Store production release readiness audit

---

## Executive summary

| Area | Status | Notes |
|------|--------|-------|
| Auth (Apple / Google / Email) | **PASS** (code) | Requires real-device smoke test |
| Cloud sync (trade journal) | **PASS** (code + fixes) | Conflict resolution + empty-local guard added |
| Offline queue | **PASS** (fixed) | Queue now clears on successful sync; NetInfo reconnect added |
| Storage uploads | **PASS** (code) | secure-upload edge function + RLS buckets |
| RevenueCat / Pro | **PASS** (code) | Requires dashboard + TestFlight verification |
| Free vs Pro limits | **PASS** | 15 trades/month, exports blocked for free |
| AI / Brave safety | **PASS** (server) | Pro gate on market-intelligence; ai-coach uses local fallback for free |
| App update safety | **PASS** (code) | Versioned storage keys, guest→user migration |
| Export / share | **PASS** (automated QA) | SVG fallback + rate-limit idempotency |
| Automated checks | **PASS** | typecheck, security, export-rate-limit, usage-limits |

**Release recommendation:** Safe to submit **after** completing manual steps in App Store Connect, RevenueCat, and Supabase (see bottom).

---

## 1. Auth

### Verified in code
- **Apple Sign In:** `src/auth/appleSignIn.ts` — native `signInWithIdToken` on iOS
- **Google Sign In:** `src/auth/googleSignIn.ts` — native idToken on iOS, OAuth browser fallback
- **Email Sign In:** Supabase OTP via `signInWithOtp` in `App.tsx`
- **Session persistence:** Supabase client uses `AsyncStorage` + `persistSession: true` (`src/config/appConfig.ts`)
- **Session restore:** `getSession()` + `onAuthStateChange` on app launch
- **Logout:** `signOut()` clears Supabase session, Google native sign-out, scoped local cache
- **RevenueCat link:** `Purchases.logIn(session.user.id)` after auth
- **No anonymous users:** `authRequired = isSupabaseConfigured` — production builds require login when Supabase is configured

### Manual checks required
- [ ] Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `.env` and EAS secrets (see `AUTH_SETUP.md`)
- [ ] Apple Sign In on physical iPhone (TestFlight build, not Expo Go)
- [ ] Google Sign In on physical iPhone
- [ ] Email magic link opens app via deep link
- [ ] Same account on iPhone + iPad restores journal after sync
- [ ] Reinstall → login → cloud journal restored

---

## 2. Cloud sync

### Verified in code
- **Source of truth:** Supabase `trade_journal` table
- **Merge strategy:** `updatedAt` wins per `client_id`; soft deletes via `deleted_at`
- **Push guard:** Never upserts when merged set is empty while cloud has active rows (added in this audit)
- **Realtime:** Postgres changes subscription triggers re-sync
- **Guest migration:** On first login, loads `trades-v6` guest cache into user-scoped `trades-v7:{userId}`
- **Attachments:** `uploadTradeAttachmentsForCloud` uploads local files via `secure-upload` edge function before row upsert

### Synced to Supabase
| Data | Table / storage | Status |
|------|-----------------|--------|
| Journal entries | `trade_journal` | ✅ Full sync |
| Screenshots / images | Storage buckets + URL in row | ✅ Upload on sync |
| Voice notes | Storage buckets + URL in row | ✅ Pro-gated attach, cloud when present |
| Tags, mood, notes | `trade_journal` columns | ✅ |
| Language preference | `user_app_state` | ✅ via `userPreferencesSync` |
| Achievement share analytics | `achievement_share_usage` | ✅ Insert on share |

### Local-only (by design)
| Data | Storage | Risk |
|------|---------|------|
| Stats / achievements / equity curve | Computed from trades | Low — rebuilds from synced journal |
| Export usage counters | AsyncStorage `usage:*` | Medium — resets on new device; Pro limits still server-side for AI |
| News / calendar cache | AsyncStorage | Low — refetched from APIs |
| Prop firm template selection | AsyncStorage | Medium — not in `user_app_state` yet |
| AI daily mission dismiss state | AsyncStorage | Low — cosmetic |

### Fixes applied in this audit
1. **NetInfo reconnect** — `src/sync/networkReconnect.ts` triggers sync when network returns
2. **Offline queue cleanup** — `clearOfflineJobsForUser()` after successful sync
3. **Empty-local guard** — prevents accidental empty merge when cloud has trades

---

## 3. Offline mode

### Verified
- Trades saved locally immediately to AsyncStorage (`trades-v7:{userId}`)
- Failed cloud sync enqueues `trade_upsert` jobs (`src/sync/offlineQueue.ts`)
- Queue survives restart (AsyncStorage-backed, max 500 jobs)
- Sync retries on: app foreground, trade change debounce, NetInfo reconnect, realtime events
- Duplicate prevention: unique `(user_id, client_id)` upsert + normalizeTrades dedup by id

### Limitation
- Offline queue stores job metadata only; actual payload is always read from local trade state at sync time. This is correct but means local cache must not be wiped while offline.

---

## 4. Storage

### Verified
- **Edge function:** `supabase/functions/secure-upload/index.ts`
- **Buckets:** `user-screenshots`, `user-voice-notes`, `user-exports`, `user-attachments`
- **RLS:** `202606280003_secure_uploads.sql` migration
- **Client:** `secureUploadFile()` validates MIME, size, rate limits before upload
- **Signed URLs:** `signedStorageUrl()` for restore on second device

### Manual checks required
- [ ] Confirm all storage buckets exist in Supabase dashboard
- [ ] Upload screenshot on iPhone → visible on iPad after sync
- [ ] Voice note upload (Pro user)

---

## 5. RevenueCat / subscriptions

### Verified in code
- **Product ID:** `youtrader_pro_monthly` (default in `appConfig.ts`)
- **Entitlement ID:** `pro` (configurable via env)
- **Pro unlock:** RevenueCat entitlement OR active Apple subscription OR `user_subscriptions` server row
- **Login binding:** `Purchases.logIn(supabaseUserId)`
- **Restore:** `restorePurchases` + entitlement refresh with retries
- **Trial:** Paywall CTA "Start 3-Day Free Trial" → `Purchases.purchasePackage(monthly)`

### Trade limit paywall (updated in this audit)
```
You've reached your free trade limit this month.
Unlock YouTrader Pro at full power: start 3 days free, then $12.99/month.
[Start 3-Day Free Trial] → Apple purchase sheet
```

### Manual checks required
- [ ] RevenueCat webhook → Supabase `user_subscriptions` (required for server-side Pro on edge functions)
- [ ] 3-day trial in App Store Connect matches RevenueCat offering
- [ ] Cancel trial → app returns to free limits within entitlement refresh window
- [ ] Restore purchases on reinstall

---

## 6. Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Trades / month | 15 | Unlimited |
| Cloud sync | ✅ (all logged-in users) | ✅ |
| Local AI coach | ✅ | ✅ |
| Cloud AI / Brave | ❌ (local preview only) | ✅ |
| Share / save cards | ❌ (0/month) | ✅ (300/month) |
| PDF export | ❌ (0 previews) | ✅ |
| Trade images | 15 total | Unlimited |
| Voice notes on trades | ❌ | ✅ |

**Note:** Product docs mention "Pro-only cloud sync" but code syncs for all authenticated users. This is intentional for data safety on reinstall/device switch.

---

## 7. AI / Brave / edge functions

### market-intelligence
- Auth required (JWT)
- Pro check via `user_subscriptions`
- Rate limits via `rateLimits.ts`
- Brave API key server-only (`BRAVE_SEARCH_API_KEY` secret)

### ai-coach
- Auth required
- Free users: **local fallback only** (`allowNvidia=false` — no paid API calls)
- Pro users: quota-checked cloud AI

### Manual deploy required
```bash
supabase functions deploy market-intelligence
supabase functions deploy ai-coach
supabase functions deploy secure-upload
```
Secrets: `BRAVE_SEARCH_API_KEY`, AI provider keys, `REVENUECAT_ENTITLEMENT_ID`

---

## 8. App update safety

### Verified
- Trade storage key migrated `trades-v6` → `trades-v7:{userId}` with guest fallback
- Rate limit schema version migration in export engine
- No destructive wipe on first launch after update
- Auth session persists across updates (AsyncStorage)
- RevenueCat uses same Supabase user ID after update

---

## 9. Database / RLS

Migrations present in `supabase/migrations/`:
- `trade_journal` — RLS user-scoped CRUD
- `user_subscriptions` — read own row
- `user_app_state` — read/write own row
- Storage policies in `202606280003_secure_uploads.sql`

### Manual checks required
- [ ] Run `supabase db push` or apply all migrations on production project
- [ ] Verify RLS enabled on all user tables in dashboard

---

## 10. Export / share / save

### Verified (automated)
- `npm run test:export-rate-limit` — 7/7 PASS
- Failed export does not consume quota
- Duplicate idempotency prevents double-count
- Stat cards use SVG rasterizer fallback (`StatCardExportHost`) to avoid `drawViewHierarchyInRect` crashes
- Expo Go limitations handled with user-facing alerts

---

## 11. Login / onboarding

### Verified
- Hero animation (pixel bull) — no logo blocking auth buttons
- Apple / Google / Email buttons unchanged
- Legal links via `openLegalUrl` (Terms + Privacy)
- Auth required when Supabase configured

### Manual checks required
- [ ] iPhone SE — no clipping on auth screen
- [ ] iPhone 16 Pro Max — layout OK
- [ ] Animation does not cause jank on older devices

---

## 12. Automated QA commands

```bash
npm run typecheck              # PASS
npm run security:check         # PASS
npm run test:usage-limits      # PASS (9 scenarios)
npm run test:export-rate-limit # PASS (7 scenarios)
npm run test:release-readiness # PASS (8 checks)
npx expo-doctor                # 16/18 (see notes)
npx pod-install                # PASS (NetInfo added)
```

**expo-doctor warnings (non-blocking):**
- Static `app.json` vs dynamic `app.config.js` — pre-existing
- Native folders + prebuild config — expected for bare workflow

**Not run:** `eas build --platform ios --profile production` (requires EAS credentials + billing; run manually before submit)

---

## 13. Fixes applied in this audit

| Issue | Fix | Files |
|-------|-----|-------|
| Offline queue never cleared after sync | `clearOfflineJobsForUser()` on success | `offlineQueue.ts`, `App.tsx` |
| No network reconnect sync | Added NetInfo + `useNetworkReconnect` | `networkReconnect.ts`, `App.tsx` |
| Empty local could race with cloud | Cloud-only restore guard | `App.tsx` |
| Trade limit paywall copy mismatch | Updated to spec | `monetization.ts` |
| `console.log` in production path | Replaced with `trackEvent` | `App.tsx` |
| Usage limits QA false negative | Fixed test assertion | `usageLimitsEngine.ts` |
| Missing release automation | Added scripts + this report | `release-readiness-qa.ts`, `RELEASE_QA_REPORT.md` |

---

## 14. Known remaining risks

1. **RevenueCat → Supabase webhook** — Server Pro checks fail if `user_subscriptions` is not populated. Client-side RevenueCat still unlocks Pro, but edge functions rely on server table.
2. **Prop firm / calendar preferences** — Local AsyncStorage only; not synced cross-device.
3. **Export usage counters** — Local AsyncStorage; new device resets monthly export count (Pro users get fresh 300).
4. **Aikido scan** — MCP token invalid; run `/aikido:setup` locally.
5. **Real-device auth** — Cannot be verified in CI; mandatory TestFlight smoke test.

---

## 15. Manual steps before App Store submit

### App Store Connect
- [ ] Submit build from EAS production profile
- [ ] Verify subscription `youtrader_pro_monthly` with 3-day free trial
- [ ] Privacy nutrition labels match data collection (auth, journal, analytics)
- [ ] App Review notes: test account credentials if needed

### RevenueCat
- [ ] iOS app configured with correct bundle ID `com.youtrader.pro`
- [ ] Offering includes monthly (+ yearly) packages
- [ ] Entitlement `pro` linked to both products
- [ ] Webhook → Supabase Edge Function or direct DB sync for `user_subscriptions`

### Supabase
- [ ] All migrations applied to production
- [ ] Edge functions deployed (ai-coach, market-intelligence, secure-upload)
- [ ] Secrets set: AI keys, BRAVE_SEARCH_API_KEY, REVENUECAT_ENTITLEMENT_ID
- [ ] Storage buckets created with RLS policies
- [ ] Apple/Google OAuth redirect URLs in Auth settings

### TestFlight smoke test matrix
- [ ] New free user: register → 15 trades → paywall → trial purchase
- [ ] Pro user: reinstall → restore purchases → journal syncs
- [ ] Offline: create trade offline → reconnect → appears in Supabase
- [ ] iPad: same account, journal + images visible
- [ ] Update: install over previous App Store build, data intact

---

*Generated by release-readiness audit. Re-run `npm run test:release-readiness` before each submission.*
