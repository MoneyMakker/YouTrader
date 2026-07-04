# Email OTP setup (YouTrader)

YouTrader uses **6-digit email OTP codes** for sign-in. Users enter the code inside the app. **No magic links** and **no Safari** for email login.

## 1. Supabase Dashboard — Email template

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Email Templates**.
3. Open the **Magic Link** template (used for OTP when `{{ .Token }}` is present).
4. Replace the body so it shows the **6-digit code**, not a confirmation link.

Example HTML body:

```html
<h2>Your YouTrader sign-in code</h2>
<p>Enter this code in the app:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{{ .Token }}</p>
<p>This code expires soon. If you didn't request it, you can ignore this email.</p>
```

**Important**

- Use `{{ .Token }}` for the 6-digit OTP.
- Do **not** use `{{ .ConfirmationURL }}` for email login (that sends magic links).
- Subject example: `Your YouTrader sign-in code`

## 2. Auth settings

**Authentication** → **Providers** → **Email**

- Enable Email provider.
- Confirm sign-ups / confirmations as required for your project.

## 3. Redirect URLs (still required)

Email OTP login does **not** use redirects. These URLs are still needed for **Google OAuth** (Expo Go) and **password reset**:

| URL | Purpose |
|-----|---------|
| `youtrader://auth` | Google OAuth callback (dev / Expo Go) |
| `youtrader://auth/reset-password` | Forgot-password email link |

Add both under **Authentication** → **URL Configuration** → **Redirect URLs**.

**Site URL** (TestFlight / production): `youtrader://auth`

## 4. App implementation (reference)

| Step | Supabase method |
|------|-----------------|
| Send code | `signInWithOtp({ email, options: { shouldCreateUser: true } })` — **no** `emailRedirectTo` |
| Verify code | `verifyOtp({ email, token: code, type: "email" })` |
| Password sign-in | `signInWithPassword({ email, password })` |
| Change password (Settings) | `updateUser({ password, data: { has_password: true } })` |
| Forgot password | `resetPasswordForEmail(email, { redirectTo: "youtrader://auth/reset-password" })` |

## 5. How to test

1. Build or run the app (TestFlight / dev client).
2. Tap **Continue with Email** → enter email → **Continue**.
3. Check inbox for 6-digit code (not a link).
4. Enter code → **Verify & Continue** → you should land in the app with cloud sync.
5. Optional: **Settings** → **Account** → **Change password**.
6. Optional: Email modal → **Sign in with password** tab after setting a password.

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| Email contains a link, not a code | Update template to use `{{ .Token }}` only |
| Code always invalid | Confirm template change saved; request a new code; check clock skew |
| Password reset fails | Add `youtrader://auth/reset-password` to Redirect URLs |
| Google sign-in fails in Expo Go | Add `youtrader://auth` to Redirect URLs |

## 7. Removed (magic link)

The following are **no longer used** for email login:

- `youtrader://auth` magic-link callbacks
- PKCE `flow_id` for email
- `exchangeCodeForSession` for email
- Opening email in Safari to finish sign-in
