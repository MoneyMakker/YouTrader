# YT3 Device Regression Recovery — Progress

**Branch:** `fix/yt3-device-regression-recovery`  
**Safety tag:** `yt3-broken-113-head-6500391`  
**Build policy:** stay on **113** · no 114 · no TF upload · production Supabase untouched  

## Phase 4F

**FAILED / NO-GO** — physical evidence collected; interactive auth + allowlisted Prop Pass still open.

Evidence: `docs/releases/1.6.1/phase4f-screenshots/qa-captures-auto/`

## Commits so far

| Commit | Scope |
| --- | --- |
| `963b2c5` | Audit + FAILED Phase 4F report |
| `58fac91` | YDL dark product theme + readable status titles |
| `ae8b4e1` | Acquisition funnel + Apple CTA restore + Prop Pass tab gate + copy |
| `cc17c56` | Assignment remote hydrate + YDL shell deps |
| `a52242e` / `a73359a` / `87f2f56` | Progress / rebuild / tooling docs |

## Uncommitted this session (not yet committed)

- `src/qa/deviceQaCapture.ts` — staging-only in-app capture + auto-advance walk  
- `src/app/YouTraderApp.tsx` — wire capture walk into shell  
- i18n — paywall “Performance Coach” (all locales)  
- Phase 4F report + screenshot evidence under `docs/releases/1.6.1/phase4f-screenshots/`

## Proven on device (physical PNGs)

- Release-Staging **113** embed launch Metro OFF  
- Paywall → Main auto path (session restored from Keychain)  
- Tabs: Journal, Stats, Calculator, News, Calendar, Settings — **no AI Analytics tab**  
- Journal empty copy references Prop Pass, not AI coaching  
- Prop Pass tab **hidden** for non-allowlisted restored account  
- Dark UI readable on Journal / Settings / Paywall  

## Still blocked

1. **Apple provider on staging Supabase** — Management API PATCH **403**; still `provider_disabled`.  
2. Onboarding + Auth CTA screens — need signed-out / Keychain-cleared install.  
3. Allowlisted Prop Pass home content.  
4. Google interactive E2E.  
5. Aikido token invalid.  
6. Stats “Stats Dashboard” low-contrast title (visual concern).

## Tooling note

`idevicescreenshot` / Maestro remain broken on this iOS 26.6 + Xcode 26 stack.  
Workaround used: `EXPO_PUBLIC_DEVICE_QA_CAPTURE=true` in gitignored `ios/.xcode.env.staging` (now commented off after pull).
