# App Store Review — Email/Password Sign-In

Last updated: 2026-07-04

Apple Review requires a working username (email) + password login. Magic link alone is **not** acceptable for review.

## Test account (copy into App Store Connect → App Review Information)

**Username:** `apple.review.youtrader@gmail.com`  
**Password:** `AppleReview2026!`

### App Review notes (copy-paste)

```
This is a pre-created test account for App Review.

1. Open the app
2. Tap "Continue with Email"
3. Enter the email and password above
4. Tap "Sign In"

No external brokerage account is required. The app does not execute trades or provide trading signals.
```

---

## 1. Create the review user in Supabase (one-time)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Email: `apple.review.youtrader@gmail.com`
4. Password: `AppleReview2026!`
5. Enable **Auto Confirm User** (or mark email confirmed — see below)

If the user already exists but cannot sign in, reset the password to `AppleReview2026!` and confirm the email.

### Manually confirm email (if confirmation is required)

**Option A — Dashboard**

1. Authentication → Users → select the user
2. Set **Email confirmed** to confirmed / toggle confirmed

**Option B — SQL (service role / SQL editor)**

```sql
update auth.users
set email_confirmed_at = now()
where email = 'apple.review.youtrader@gmail.com';
```

---

## 2. Supabase Auth URL configuration

**Authentication → URL Configuration**

| Setting | Value |
|--------|--------|
| **Site URL** | `youtrader://auth` |
| **Redirect URLs** | `youtrader://auth` |
| | `youtrader://auth/callback` |
| | `youtrader://auth/confirm` (legacy links) |
| | `youtrader://auth/reset-password` |

Do **not** use `localhost` for mobile builds.

---

## 3. Email provider settings

**Authentication → Providers → Email**

| Setting | Recommendation for App Review |
|--------|-------------------------------|
| Enable Email provider | **On** |
| Confirm email | **Off** for simplest review flow, **or On** if you pre-confirm the review account |
| Secure email change | On (production) |
| Double confirm email changes | Optional |

### If Confirm email is ON

- New sign-ups receive a confirmation email with redirect to `youtrader://auth`
- After tapping the link, the app shows: *"Email confirmed. You can now sign in."*
- Review account must be **pre-confirmed** in dashboard (step 1)

### If Confirm email is OFF

- Sign-up returns a session immediately; user enters the app without email step
- Still create the review account manually so Apple uses a known password

---

## 4. Test before submitting to Apple

Run on a **dev build / TestFlight** build (not Expo Go unless redirect URIs match):

```bash
npm run test:email-password
npm run typecheck
```

Manual QA:

1. **Sign in (review account)** — Continue with Email → credentials → Sign In → main app
2. **Sign out** → Sign in again
3. **Create account** (optional) — sign up → check email screen OR immediate entry if confirmation off
4. **Email confirmation** — open link on device → alert *Email confirmed* → sign in with password
5. **Password reset** — forgot password → email → open `youtrader://auth/reset-password` link → set new password
6. **Apple Sign In** — still works on iOS
7. **Google Sign In** — still works

### Device logs (Xcode)

Filter console for:

```
[YouTrader:email-password-auth] sign_in_started
[YouTrader:email-password-auth] sign_in_success
[YouTrader:email-password-auth] sign_in_failed
[YouTrader:email-password-auth] sign_up_started
[YouTrader:email-password-auth] sign_up_success
[YouTrader:email-password-auth] email_confirmation_received
```

---

## 5. Troubleshooting

| Symptom | Fix |
|--------|-----|
| Sign In appears to do nothing | Check email is confirmed; read `sign_in_failed` log message |
| Confirmation email never arrives | Check Supabase Auth email settings / SMTP; or disable confirm email + pre-create review user |
| Link opens browser, not app | Add exact redirect URLs in Supabase; rebuild app with `youtrader` URL scheme |
| "Email not confirmed" | Confirm user in dashboard or complete confirmation link on device |
| Invalid credentials | Reset password in Supabase for review account |

---

## 6. Security notes

- Do not commit real passwords to git
- Rotate `AppleReview2026!` after review if desired
- Review account should have no real trading/broker credentials
- Rate limits apply to auth attempts (client-side guard)
