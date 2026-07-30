# YouTrader Technical Debt Register

**Maintained by:** AI Project Historian  
**Last updated:** 2026-07-08

## Summary

| Priority | Open items |
|----------|------------|
| High | 1 |
| Medium | 0 |
| Low | 0 |

---

## High priority

| ID | Area | Description | Impact | Effort | Source | Opened |
| TD-001 | architecture | `App.tsx` monolith orchestrator | maintainability, merge conflicts | high | ARCHITECTURE.md | _seed_ |
|----|------|-------------|--------|--------|--------|--------|
| | | | | | | |

## Medium priority

| ID | Area | Description | Impact | Effort | Source | Opened |
| TD-001 | architecture | `App.tsx` monolith orchestrator | maintainability, merge conflicts | high | ARCHITECTURE.md | _seed_ |
|----|------|-------------|--------|--------|--------|--------|
| | | | | | | |

## Low priority

| ID | Area | Description | Impact | Effort | Source | Opened |
| TD-001 | architecture | `App.tsx` monolith orchestrator | maintainability, merge conflicts | high | ARCHITECTURE.md | _seed_ |
|----|------|-------------|--------|--------|--------|--------|
| | | | | | | |

## Resolved (archive)

| ID | Resolved | Resolution |
|----|----------|------------|
| | | |

---

## Phase 6 residuals (non-blocking — opened 2026-07-30)

Recorded after iPhone 17 native launch smoke. **Do not block UI Infra Phase 6 FINAL APPROVAL.** Do not mix into YouTrader 3.0 Phase 0.

| ID | Area | Description | Priority | Notes |
|----|------|-------------|----------|-------|
| TD-P6-001 | startup / auth | Investigate `auth_hydration_timeout` warning on cold launch | Medium | Measure real hydration duration; check false positives; impact on cold launch UX. Warning only — app still reaches `auth_ready`. Evidence: `expo run:ios -d "iPhone 17"` logs. |
| TD-P6-002 | UI / RN | Replace legacy `SafeAreaView` with `react-native-safe-area-context` | Low | Deprecation warning only. Schedule separately from Prop Domain / product roadmap. |
