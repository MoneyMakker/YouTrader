# Backlog — App Store Connect metadata cleanup (DO NOT EXECUTE NOW)

Status: **DEFERRED** until owner explicitly authorizes listing cleanup / build 115 upload.

Scope freeze (2026-08-01) forbids:

- screenshot deletion/replacement
- app-name / subtitle / description / keywords / promotional text AI cleanup
- Add for Review / Submit for Review
- TestFlight upload
- build 115 creation

When authorized later, clean obsolete AI positioning from:

- App name (`YouTrader 一 Trading Journal AI` → Futures Trading Journal format within 30 chars)
- Subscription group display name / app name localization
- Version promotional text, description, What’s New, review notes
- Product localization strings that still mention AI
- Screenshot set (e.g. `Screenshot ai.jpeg`) only with explicit media approval

Do not run this work during the current subscription/QA phase.
