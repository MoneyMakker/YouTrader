# YouTrader Auth Setup Checklist

Manual configuration for Apple, Google, and email sign-in with Supabase. All methods create the same Supabase `user_id` and sync journal data via `trade_journal.user_id`.

## Quick reference — redirect URIs

All auth flows use **`getAuthRedirectUri()`**:

| Runtime | URI |
|---------|-----|
| Expo Go | `exp://192.168.x.x:8081/--/auth` (from Metro — copy from logs) |
| Dev / TestFlight / App Store | `youtrader://auth` |

Add **both** to Supabase → Authentication → URL Configuration:

1. **Site URL** — set to your current runtime URI above (**NOT** `http://localhost:3000`)
2. **Redirect URLs** — same URI(s) plus Supabase callback

**Never use localhost on mobile.** If Safari opens localhost, Supabase rejected `redirectTo` / `emailRedirectTo` and fell back to Site URL.

---

## Apple (native iOS)

### Apple Developer

- [ ] **Sign in with Apple** on App ID `com.youtrader.pro`

### Supabase → Apple

- [ ] Provider **enabled**
- [ ] **Client IDs**: `com.youtrader.pro`, `host.exp.Exponent` (Expo Go)
- [ ] Uses `signInWithIdToken` — no OAuth secret on iOS

### Expo

- [ ] `expo-apple-authentication` plugin + entitlements (already in repo)

---

## Google (native iOS — recommended)

### Google Cloud Console

Create credentials at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).

**1. Web application client** (required for Supabase + native idToken):

- [ ] **Authorized redirect URIs**:
  - `https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] Copy **Client ID** → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- [ ] Copy **Client Secret** → Supabase Google provider

**2. iOS client**:

- [ ] Application type: **iOS**
- [ ] Bundle ID: `com.youtrader.pro`
- [ ] Copy **Client ID** → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

### Supabase → Authentication → Providers → Google

- [ ] Provider **enabled**
- [ ] **Client ID** = Web client ID (primary)
- [ ] **Client Secret** = Web client secret
- [ ] **Authorized Client IDs** (comma-separated):
  - Web client ID
  - iOS client ID
- [ ] **Skip nonce check**: **enabled** (required for native `@react-native-google-signin/google-signin` on iOS)
- [ ] **Redirect URLs** (URL Configuration):
  - `youtrader://auth`
  - `exp://*` paths for Expo Go (add your dev machine URI from logs)
  - `https://<project-ref>.supabase.co/auth/v1/callback`

### Environment (`.env` / EAS secrets)

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=yyyy.apps.googleusercontent.com
```

`app.config.js` auto-adds the Google Sign-In plugin with `iosUrlScheme` derived from the iOS client ID.

### App flow (native — iPhone & iPad)

1. `GoogleSignin.signIn()` — native account picker (no browser)
2. `signInWithIdToken({ provider: "google", token: idToken })`
3. Supabase session → `onAuthStateChange` → cloud sync by `user_id`

### Rebuild required

After setting Google env vars, run a **new native build**:

```bash
eas build --profile development --platform ios
# or TestFlight / production profile
```

---

## Email (magic link / OTP)

### Supabase → Email

- [ ] Email provider **enabled**
- [ ] Redirect URL: `youtrader://auth`

### App flow

1. `signInWithOtp` → user sees *"Check your email to finish signing in."*
2. Tap link → deep link → `completeAuthSessionFromUrl`

---

## Session, sync & account linking

| Concern | Behavior |
|--------|----------|
| Session persist | AsyncStorage via `@supabase/supabase-js` (`persistSession: true`) |
| App launch | `getSession()` + `onAuthStateChange` restores session |
| Cloud sync | `trade_journal` + preferences keyed by `user_id` |
| Same email, different provider | Supabase links identities when possible |
| Conflict | App shows: *"This email is already connected to another sign-in method..."* |
| Logout | `signOut()` + clear local cache; Google native `signOut()` when applicable |
| Account switch | Logout clears local user cache; cloud data stays on server |

---

## Expo Go vs Development Build vs TestFlight

| Method | Expo Go | Dev build | TestFlight / App Store |
|--------|---------|-----------|------------------------|
| **Apple** | ✅ (add `host.exp.Exponent` to Supabase) | ✅ | ✅ |
| **Google** | ⚠️ Browser OAuth fallback only (often unreliable) | ✅ Native | ✅ Native |
| **Email** | ⚠️ Depends on link opening correct app | ✅ | ✅ |

**Google in Expo Go:** Native module is not available. App falls back to browser OAuth, which usually fails without the custom URL scheme. **Use a Development Build for Google testing.**

**TestFlight readiness:** After setting `EXPO_PUBLIC_GOOGLE_*` in EAS secrets and rebuilding, Google native sign-in is ready for TestFlight QA alongside Apple and Email.

---

## QA checklist

1. Apple → Face ID → main app → journal syncs
2. Google → native picker → main app → same `user_id` if same email
3. Email → inbox → tap link → main app
4. Logout (all providers)
5. Kill app → reopen → session restored
6. Reinstall → login → cloud journal restored
7. iPhone + iPad same account → data syncs
8. Cancelled sign-in → no crash, no technical errors
9. `npm run typecheck` passes

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Google native button does nothing | Rebuild after adding `EXPO_PUBLIC_GOOGLE_*` env vars |
| `No idToken` / empty token | `webClientId` must be the **Web** client ID, not iOS |
| Nonce validation failed | Enable **Skip nonce check** in Supabase Google provider |
| `DEVELOPER_ERROR` (Android) | SHA-1 fingerprint in Google Cloud (Android only) |
| Browser opens for Google on TestFlight | Env vars missing → falls back to OAuth; set env + rebuild |
| Account conflict | User must sign in with the provider originally used |

Dev logs: `[YouTrader:google-auth]`, `[YouTrader:apple-auth]`, `[YouTrader:email-auth]`.
