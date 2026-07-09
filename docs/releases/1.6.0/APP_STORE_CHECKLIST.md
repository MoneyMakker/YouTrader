# App Store Checklist — 1.6.0

Derived from `docs/APP_STORE_RELEASE_CHECKLIST.md`. Do not paste secrets.

---

## Build Identity

- [ ] Version 1.6.0 in `app.json`, `package.json`, `Info.plist`
- [ ] Build number > last ASC upload
- [ ] Bundle ID `com.youtrader.pro`
- [ ] EAS profile correct
- [ ] No secrets / artifacts staged

---

## RevenueCat

- [ ] `youtrader_pro_monthly` / `youtrader_pro_yearly`
- [ ] `pro` entitlement
- [ ] Sandbox purchase + restore tested

---

## Supabase

- [ ] No service role in client
- [ ] RLS enabled on user tables
- [ ] Edge Function secrets server-side only

---

## Metadata & Assets

- [ ] Screenshots current
- [ ] App icon / branding
- [ ] Privacy Policy URL
- [ ] Terms URL
- [ ] ASO keywords / subtitle reviewed

---

## TestFlight

- [ ] Preview build installed on device
- [ ] Manual QA complete (see `MANUAL_TESTING.md`)

---

## Submission

- [ ] Human approved production build
- [ ] Release notes pasted in ASC
- [ ] **Release Manager did NOT auto-submit**

---

## Checklist Verdict

**Ready for ASC submission:** _PENDING_
