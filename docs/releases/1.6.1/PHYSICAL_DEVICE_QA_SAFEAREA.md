# Physical-device validation — SafeArea black-screen fix

Date: 2026-07-31  
Device: **iPhone 4S** (marketing name) / **iPhone 14 Pro Max** (`iPhone15,3`)  
iOS: **26.6** (23G71)  
Developer Mode: **enabled**  
UDID: `00008120-00046D54219B401E`  
Scheme: `YouTrader-Staging` / Run+Archive config: `Release-Staging`  
Prior TF build 113: uninstalled before Xcode install  

## Automated physical results

| Test | Result |
|------|--------|
| Cold launch 1–5 (force quit) | **PASS** — S09+S12+S14; insets `top=59 bottom=34`; no watchdog |
| Warm launch 1–3 | **PASS** — S14 present |
| Background → foreground (re-activate) | **PASS** — process alive, S14 retained |
| Signed out (fresh install) | **PASS** — shell/auth path reaches S14 |
| Startup fallback (`EXPO_PUBLIC_FORCE_STARTUP_FAILURE=true`) | **PASS** — `forced_startup_failure` then `startup_watchdog_timeout`; process alive; no S12/S14 |
| Staging backend unreachable host | **PASS** — S14 with `supabaseHost=unreachable-staging-qa.supabase.co` |
| Landscape rotation | **N/A** — iPhone orientations portrait-only |
| Google Sign-In | **Decision:** hide button when `enableNativeGoogleSignIn=false` (`showGoogle={enableNativeGoogleSignIn}`) |

Native safe-area metrics observed after fallback seed:  
`safe_area_insets top=59 right=0 bottom=34 left=0` (not zeros — native override worked).

## Pending (requires PO interactive credentials / visual confirm)

These were **not** fully automated on-device (no screenshots service; no test passwords in repo):

10. Allowlisted account login  
11. Non-allowlisted account login  
12–13. Prop Pass eligibility + navigation  
14. Journal opening  
15. Analytics opening  
16. Logout and relaunch  
5. Expired/invalid session (practical)  
6. Airplane-mode offline (approx covered by unreachable host)  
5b. Fallback Retry / Sign-out button taps (watchdog UI proven by logs; UI tap not automated)

## Gates

- Build 113 remains **NO-GO**  
- Fix **not committed** until interactive matrix items above are confirmed PASS by PO  
- Build 114 **not started**  
- Production Supabase untouched  
- `ios/.xcode.env.staging` restored to real staging host after unreachable test  

## Evidence paths

- `/tmp/yt-phys-qa/cp-cold1.log` … `cp-cold5.log`  
- `/tmp/yt-phys-qa/cp-warm1.log` … `cp-warm3.log`  
- `/tmp/yt-phys-qa/cp-fallback.log`  
- `/tmp/yt-phys-qa/cp-unreachable2.log`  
- `/tmp/yt-phys-qa/cp-healthy.log`  
