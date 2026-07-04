# Email Auth Setup (YouTrader)

YouTrader supports **email magic link** sign-in (default) and optional **6-digit OTP** if you change the Supabase email template.

The production Supabase project currently sends **magic link** emails (`Your sign-in link` + **Sign in** button). The app UI matches that flow.

---

## 1. Supabase Dashboard — URL Configuration

Go to **Authentication → URL Configuration**.

| Setting | Value |
|--------|--------|
| **Site URL** | `youtrader://auth` |
| **Redirect URLs** (add all) | `youtrader://auth` |
| | `youtrader://auth/reset-password` |

For Expo Go dev builds, also add the redirect URI printed in Xcode logs when sending a link (from `expo-auth-session`).

---

## 2. Magic link flow (current — recommended)

### Template to edit

**Authentication → Emails → Magic Link**

Default subject: `Your sign-in link`

Keep the confirmation link variable:

```html
<h2>Your sign-in link</h2>
<p>Follow the link below to sign in. This link expires shortly and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
```

Do **not** remove `{{ .ConfirmationURL }}` for magic link flow.

### How the app works

1. User enters email → app calls `signInWithOtp` with `emailRedirectTo: youtrader://auth?flow_id=<uuid>`.
2. User taps **Sign in** in the email on the same device.
3. App opens via deep link → PKCE `exchangeCodeForSession` (or `verifyOtp` / `setSession` fallback).
4. `flow_id` must match the pending flow stored when the email was sent.

### Redirect URL

Magic links must redirect to:

```
youtrader://auth?flow_id=<generated-uuid>
```

The base `youtrader://auth` must be in **Redirect URLs**.

---

## 3. Optional — 6-digit OTP flow

Only switch the app to OTP UI after updating the template.

### Template to edit

**Authentication → Emails → Magic Link** (same template Supabase uses for `signInWithOtp`)

Replace body with visible code:

```html
<h2>Your sign-in code</h2>
<p>Enter this 6-digit code in YouTrader:</p>
<p style="font-size: 28px; letter-spacing: 6px;"><strong>{{ .Token }}</strong></p>
<p>This code expires shortly.</p>
```

Required variable: **`{{ .Token }}`** (6-digit OTP).

Remove reliance on `{{ .ConfirmationURL }}` if you want code-only emails.

### App changes for OTP

If you enable OTP in Supabase, the app must:

- Call `signInWithOtp` **without** `emailRedirectTo`
- Show 6-digit code input
- Verify with `verifyOtp({ email, token, type: "email" })`

See `EMAIL_OTP_SETUP.md` for legacy OTP notes.

---

## 4. Password reset

**Authentication → Emails → Reset Password**

Redirect URL used by the app:

```
youtrader://auth/reset-password
```

Add to **Redirect URLs**.

---

## 5. Troubleshooting

| Symptom | Fix |
|--------|-----|
| Email has link but app asks for code | Project still on magic link template — use magic link UI (current build) or update template to `{{ .Token }}` |
| `flow_state_not_found` | Open link on same device that requested it; resend link |
| Link opens browser, not app | Confirm `youtrader` URL scheme in `app.json` / iOS Info.plist |
| Redirect error | Add exact `youtrader://auth` to Supabase Redirect URLs |

---

## 6. QA checklist

- [ ] Continue sends email
- [ ] Step 2 shows “Check your email” (no code field)
- [ ] Tapping email link signs in
- [ ] Resend works after cooldown
- [ ] Cancel / reopen modal works
- [ ] Password tab still works
- [ ] Apple / Google login unchanged
- [ ] Session persists after restart
- [ ] RevenueCat `logIn(user.id)` still runs

Run locally:

```bash
npm run typecheck
npm run test:email-otp
npm run test:release-readiness
```
