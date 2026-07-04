# Email + Password Auth Setup (YouTrader)

YouTrader uses **email and password** only for email login. No magic links, no OTP codes for sign-in.

---

## 1. Enable Email provider

**Authentication → Providers → Email**

- Enable **Email**
- Enable **Confirm email** (recommended for new signups)
- Save

---

## 2. URL Configuration

**Authentication → URL Configuration**

| Setting | Value |
|--------|--------|
| **Site URL** | `youtrader://auth` |
| **Redirect URLs** | `youtrader://auth` |
| | `youtrader://auth/confirm` |
| | `youtrader://auth/reset-password` |

For Expo Go dev builds, also add redirect URIs from `expo-auth-session` logs.

---

## 3. Email templates

### Confirm signup

**Authentication → Emails → Confirm signup**

Redirect users to:

```
youtrader://auth/confirm
```

The app shows a confirmation message and **does not auto-login**. User returns and signs in with email + password.

### Reset password

**Authentication → Emails → Reset password**

Redirect users to:

```
youtrader://auth/reset-password
```

The app opens a **Reset password** modal (new password + confirm).

---

## 4. Supabase methods used in the app

| Action | Method |
|--------|--------|
| Sign in | `supabase.auth.signInWithPassword({ email, password })` |
| Sign up | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: "youtrader://auth/confirm" } })` |
| Forgot password | `supabase.auth.resetPasswordForEmail(email, { redirectTo: "youtrader://auth/reset-password" })` |
| Update password | `supabase.auth.updateUser({ password })` |
| Change email | `supabase.auth.updateUser({ email })` |

---

## 5. Deep links handled

| URL | Behavior |
|-----|----------|
| `youtrader://auth/confirm` | Verify email, sign out, prompt user to sign in manually |
| `youtrader://auth/reset-password` | Recovery session → reset password modal |
| Google OAuth (Expo Go only) | OAuth callback via PKCE |

**Not used for login:** magic links, `signInWithOtp`, `verifyOtp` for email login, `exchangeCodeForSession` for email login.

---

## 6. QA checklist

- [ ] Create account with email/password
- [ ] Confirmation email arrives
- [ ] After confirm, sign in with email/password works
- [ ] Wrong password shows friendly error
- [ ] Forgot password email arrives
- [ ] Reset password deep link opens modal and updates password
- [ ] Change password in Settings works
- [ ] Change email in Settings works (confirmation if required)
- [ ] Session persists after app restart
- [ ] RevenueCat `Purchases.logIn(user.id)` runs after login
- [ ] Cloud sync works after login

```bash
npm run typecheck
npm run test:email-password
npm run test:release-readiness
```
