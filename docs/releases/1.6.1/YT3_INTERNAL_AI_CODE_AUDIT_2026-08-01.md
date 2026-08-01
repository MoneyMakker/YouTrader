# Internal AI code audit — 2026-08-01

Policy: no user-facing AI positioning. Internal modules may remain for coaching/PI/news presentation primitives.

## `src/app/ai/*`

| File | Classification | Used by | Action |
|------|----------------|---------|--------|
| `sharedUi.tsx` | Internal UI primitives (`MetricPillRow`, `TerminalGlassCard`, coach prose) | Stats Radar/Heatmap/Equity, news card, YouTraderApp | **Commit — required** |
| `coachRead.tsx` | News sentiment read helpers | `AiNewsSentimentCard` | **Commit — required** |
| `animations.tsx` | Decorative motion primitives | exported via index; secondary | **Commit — required by exports** |
| `propCoach.tsx` | Prop Pass coaching cards (legacy name) | YouTraderApp Prop surfaces | **Commit — required**; rename later if product asks |
| `tradeVision.tsx` | Trade review coach section | YouTraderApp journal review | **Commit — required** |
| `assistant.tsx` | Market assistant block (tracked) | YouTraderApp | **Keep** |
| `index.ts` | Barrel | imports | **Commit — required** |

## Commit `6a9f130`

Client API hardening for coach/market intelligence + PI panel. **Still used.** Not dead. No AI tab / paywall AI marketing introduced.

## Requirements check

| Requirement | Status |
|-------------|--------|
| No AI tab | PASS (nav contract unchanged) |
| No AI marketing / a11y / notification / paywall copy | PASS via `forbiddenAiCopy` |
| No unused client init at startup | PARTIAL — modules load with screens that import them; no separate AI bootstrap |
| Dead AI Analytics removal | No separate dead analytics client found beyond shared primitives still referenced |

## Status

**CODE PASS** for required internal modules commit. Cosmetic rename of `ai/` folder deferred (contract risk).
