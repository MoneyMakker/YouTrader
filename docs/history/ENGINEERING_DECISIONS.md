# YouTrader Engineering Decision Log

Numbered architectural and engineering decisions (ADR-style).  
**Maintained by:** AI Project Historian  
**Last updated:** 2026-07-08

**Next decision number:** 3

---

## How to read

- **Status:** `accepted` · `superseded` · `deprecated`
- If no record exists for a question, answer: *Unknown — decision predates recorded history.*

---

<!-- Decisions appended below as ## Decision #N — Title -->

## Decision #1 — Journal is source of truth; analytics and AI explain it

**Date:** Unknown — decision predates recorded history  
**Status:** accepted  
**Sources:** MASTER_CONTEXT.md §1 Project Overview

### Context
YouTrader is a trading journal, not a signal or prediction product.

### Decision
Local journal data is authoritative. Deterministic analytics engines compute from journal entries. AI coaches and explains; it does not invent metrics or replace engines.

### Alternatives considered
Unknown — decision predates recorded history.

### Tradeoffs
Requires careful gating so AI copy never implies buy/sell/hold signals.

### Future implications
All new features must preserve deterministic analytics vs AI separation.

---

## Decision #2 — Large orchestrator in App.tsx with extracted src/ modules

**Date:** Unknown — decision predates recorded history  
**Status:** accepted  
**Sources:** ARCHITECTURE.md

### Context
Expo RN app grew with navigation and feature surface in one file.

### Decision
Keep main orchestration in `App.tsx`; extract helpers to `src/**` incrementally.

### Alternatives considered
Unknown — decision predates recorded history. (Full navigation refactor not documented.)

### Tradeoffs
Merge conflicts on parallel agent work; TD-001 tracks extraction debt.

### Future implications
Extract only when task scope requires; avoid big-bang rewrite.

