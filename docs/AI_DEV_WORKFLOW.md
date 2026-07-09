# AI Development Workflow

Last updated: 2026-07-02

> **Release orchestration:** For the CEO → Release Manager hierarchy and 25-step `Prepare Release` workflow, see **[AI_DEVELOPMENT_WORKFLOW.md](./AI_DEVELOPMENT_WORKFLOW.md)**.

This document describes free or near-zero-cost AI development tools for YouTrader. These tools are for Codex/Cursor/developer workflow only. They must not be bundled into the Expo mobile app, must not add runtime dependencies, and must not store secrets in the repository.

## Installed Or Project-Configured

### Context7 MCP

Configured for Cursor in `.cursor/mcp.json`.

Purpose:

- Fetch current documentation while coding.
- Use for Expo, React Native, Supabase, RevenueCat, Sentry, PostHog, and TypeScript docs.
- Reduce stale assumptions when APIs change.
- Check current EAS Update, Apple, and Expo SDK docs before touching release/build behavior.

Safe usage:

```text
Use Context7 for Expo SDK 54 ImagePicker/FileSystem docs before changing Journal media.
Use Context7 for Supabase JS v2 docs before changing auth/sync code.
Use Context7 for RevenueCat React Native docs before touching purchases.
```

Cursor MCP command:

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp"]
  }
}
```

Rules:

- Do not paste API keys into Context7 prompts.
- Do not use Context7 output as a reason to change production behavior without inspecting local code.
- Prefer official docs returned by Context7 over blog snippets.
- Use Context7 before changing code that touches Expo, React Native, Supabase, RevenueCat, Sentry, PostHog, EAS, or Apple APIs.
- If Context7 is unavailable, use official vendor docs and document the source before making build/runtime changes.

### Playwright MCP

Configured for Cursor in `.cursor/mcp.json`.

Purpose:

- QA web/local browser surfaces when available.
- Inspect generated static docs or web previews.
- Useful for screenshots, layout checks, console errors, and basic flows.

Cursor MCP command:

```json
{
  "playwright": {
    "command": "npx",
    "args": ["-y", "@playwright/mcp@latest"]
  }
}
```

YouTrader usage:

- Use for web previews only when a web/dev server exists.
- Do not treat Playwright MCP as a replacement for real iPhone QA.
- For native Expo flows, still test on simulator/TestFlight/device.

Safe QA examples:

```text
Open local Expo web build and check for console errors.
Verify documentation pages render after markdown changes.
Capture before/after screenshots for a web-rendered export preview if available.
```

## Project Skills

### Taste Skill

Installed at `.agents/skills/taste/SKILL.md`.

Purpose:

- Keep YouTrader UI premium, dark, institutional, trader-first, and App Store-ready.
- Guide visual judgment before and after UI changes.
- Work together with `frontend-design`, `docs/MY_UI.md`, and `design-review`.

Use it when changing:

- screens
- cards
- charts
- empty states
- paywalls
- exports
- PDFs
- share cards
- visible copy

### Caveman Skill

Installed at `.agents/skills/caveman/SKILL.md`.

Purpose:

- Reduce token waste.
- Avoid broad rewrites.
- Force exact file inspection and small diffs.
- Keep Codex/Cursor focused on the requested task.

Use it when:

- the task is broad
- `App.tsx` is involved
- a change risks touching Supabase/RevenueCat/build config
- a previous agent over-edited or used an old snapshot

## Documented Only / Manual Setup

### Claude Mem

Claude Mem is not committed as a project config because memory tools can accidentally store private context, secrets, or stale decisions outside git review.

YouTrader already has repo-local memory files:

- `MASTER_CONTEXT.md`
- `CONTINUATION.md`
- `docs/CODEX_CONTINUATION.md`
- `docs/MY_UI.md`
- `docs/AI_CODING_SECURITY_RULES.md`

Recommended usage:

- Treat repo docs as the source of truth.
- If using Claude Mem globally, store only non-secret workflow preferences.
- Never store Supabase keys, RevenueCat secrets, Apple keys, `.env` contents, private customer data, screenshots, voice notes, or full trade payloads.
- If memory conflicts with repository docs, repository docs win.

Manual setup pattern:

```text
Install Claude Mem only in your personal/global AI tool environment.
Add a rule that YouTrader source of truth is docs/CODEX_CONTINUATION.md + MASTER_CONTEXT.md.
Do not sync secrets into memory.
Review and delete stale memories after major releases.
```

## Codex/Cursor Workflow

Start every YouTrader session with:

```text
Read docs/CODEX_CONTINUATION.md, MASTER_CONTEXT.md, CONTINUATION.md, and docs/MY_UI.md.
Run git status.
Use Caveman for small diffs.
Use Context7 only for current docs when an API/library fact matters.
Use Taste + frontend-design + design-review for UI work.
Do not touch Supabase schema, RevenueCat IDs, subscriptions, AI gateway, or build numbers unless explicitly requested.
Run npm run typecheck before final status.
```

Required starter sentence for API-sensitive tasks:

```text
Use Context7 before changing code that touches Expo, React Native, Supabase, RevenueCat, Sentry, PostHog, EAS, or Apple APIs.
```

## Context7 Recipes

Expo / React Native:

```text
Use Context7 to check Expo SDK 54 docs for expo-image-picker, expo-file-system, expo-audio, expo-media-library, and expo-notifications.
```

Supabase:

```text
Use Context7 to check Supabase JS v2 docs before auth, storage, Edge Function, or RLS-related client changes.
Do not use service_role in Expo code.
```

RevenueCat:

```text
Use Context7 to check current react-native-purchases docs before changing purchase, restore, offering, entitlement, or trial handling.
Do not change product IDs or entitlement IDs without explicit instruction.
```

Observability:

```text
Use Context7 to check Sentry React Native and PostHog React Native docs before changing instrumentation.
Keep events metadata-only.
```

EAS / OTA:

```text
Use Context7 to check current EAS Update docs before changing app.json, eas.json, runtimeVersion, update channels, native build profiles, or OTA playbooks.
Verify whether a change is OTA-safe or requires a new App Store/TestFlight build.
```

Apple APIs:

```text
Use Context7 or official Apple/Expo docs before touching Sign in with Apple, App Store Server Notifications, StoreKit-adjacent flows, entitlements, URL schemes, or iOS permission strings.
```

## Playwright MCP QA Recipes

Use Playwright MCP for:

- local web preview smoke checks
- console error checks
- visual layout checks for web-rendered surfaces
- docs rendering checks

Do not use Playwright MCP for:

- App Store purchase validation
- RevenueCat sandbox purchase proof
- native iPhone camera/photo/microphone permission proof
- native push notification proof

Those require simulator/TestFlight/device QA.

## Safety Rules

- Do not install dev tools as Expo runtime dependencies.
- Do not commit private MCP configs with tokens.
- Do not commit `.env`, Apple keys, signing files, IPA files, or build outputs.
- Do not let AI tools operate on production dashboards without explicit human review.
- Do not trust tool memory over checked-in docs.
- Run `npm run typecheck` after documentation/config changes when requested.
