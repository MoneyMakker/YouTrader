# YT3 Device Regression Recovery — Progress

**Branch:** `fix/yt3-device-regression-recovery`  
**Safety tag:** `yt3-broken-113-head-6500391`  
**Build policy:** stay on **113** · no 114 · no TF upload · production Supabase untouched  

## Phase 4F

**FAILED / NO-GO** until physical evidence proves otherwise.

## Commits so far

| Commit | Scope |
| --- | --- |
| `963b2c5` | Audit + FAILED Phase 4F report |
| `58fac91` | YDL dark product theme + readable status titles |
| `ae8b4e1` | Acquisition funnel + Apple CTA restore + Prop Pass tab gate + copy |
| (latest) | Assignment remote hydrate + YDL shell deps |

## Restored in code (not yet physical PASS)

- Onboarding → Paywall → Auth → Main state machine + unit QA
- Apple CTA no longer silently hidden on staging
- Prop Pass tab only when allowlisted + activation eligible
- Dark-on-dark contrast (system light + missing title color)
- Journal / paywall copy no longer pushes “AI coaching”
- Assignment flow loads remote current assignments; no fake memory write success

## Blocked / remaining

1. **Apple provider on staging Supabase** — Management API PATCH **403**; still `provider_disabled` in Auth logs.  
   **One manual action:** Dashboard → YouTrader Staging → Auth → Providers → Apple → Enable + Client ID `com.youtrader.pro` + secret.
2. **Google E2E** — config present; physical proof required.
3. **Rebuild + install Release-Staging 113** with Metro OFF on iPhone 4S and capture screenshots.
4. **Allowlisted Prop Pass content** after rebuild (env already has `staging_preview` + allowlist in gitignored `.xcode.env.staging`).
5. Aikido scan — auth token invalid this session.

## Do not claim

- Auth restored / PASS  
- Phase 4F PASS  
- Production ready  
