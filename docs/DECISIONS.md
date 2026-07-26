# Architecture Decisions

Use this log for durable decisions. Add new entries rather than rewriting historical decisions.

## ADR-001 — SecureStore for persisted Supabase sessions

- **Status:** Accepted
- **Date:** TBD
- **Context:** Mobile authentication sessions are sensitive and must not remain in generic local storage.
- **Decision:** Persist native Supabase sessions through SecureStore with a fail-safe one-time migration from legacy AsyncStorage.
- **Consequences:** Better device protection; migration and logout require regression/device QA.
- **Alternatives considered:** Continue AsyncStorage persistence; force re-authentication for all users.

## ADR-002 — One task workflow

- **Status:** Accepted
- **Date:** TBD
- **Context:** The roadmap contains security-sensitive and product-critical changes.
- **Decision:** Execute one backlog item, one focused commit, independent review, then Product Owner approval.
- **Consequences:** Slower throughput but clearer rollback, ownership, and review.
- **Alternatives considered:** Batch feature commits; autonomous multi-task execution.

## ADR-003 — AI quota fails closed

- **Status:** Accepted
- **Date:** TBD
- **Context:** Provider calls can incur cost and abusive retries must not bypass controls.
- **Decision:** Reservation/database failures return a generic 503 before provider invocation; denied reservations return 429.
- **Consequences:** AI may be temporarily unavailable during quota-store failure; cost and abuse control take precedence.
- **Alternatives considered:** Fail-open quota checks; client-only limits.

## ADR-004 — Journal is the primary product surface

- **Status:** Proposed
- **Date:** TBD
- **Context:** The product promise depends on repeated evidence capture and review.
- **Decision:** Make Journal and the daily review loop primary; other modules support it.
- **Consequences:** Market, gamification, and duplicate AI navigation become secondary or deferred.
- **Alternatives considered:** Market-first dashboard; feature-equal navigation.

## ADR-005 — Today screen guides the next best action

- **Status:** Proposed
- **Date:** TBD
- **Context:** Existing product breadth can create cognitive load.
- **Decision:** Introduce a focused Today hierarchy only through approved backlog work.
- **Consequences:** Requires careful navigation and analytics consolidation.
- **Alternatives considered:** Add more dashboard widgets.

## ADR-006 — Feature flags protect incomplete work

- **Status:** Proposed
- **Date:** TBD
- **Context:** Optional and experimental features must not destabilize core workflows.
- **Decision:** Feature flags require owner, success metric, launch criterion, and rollback path.
- **Consequences:** More release discipline; no hidden permanent experiments.
- **Alternatives considered:** Ship all code paths by default.

## ADR-007 — App.tsx decomposition is deliberate, not opportunistic

- **Status:** Proposed
- **Date:** TBD
- **Context:** `App.tsx` is a large orchestration surface with regression risk.
- **Decision:** Decompose only in approved architecture tasks after core state boundaries and regression coverage are defined.
- **Consequences:** Avoids disruptive rewrites during product/security work.
- **Alternatives considered:** Immediate wholesale rewrite.

## ADR-008 — Prevent legacy session resurrection after logout (YT-001)

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** A partial logout cleanup could delete the SecureStore session
  while leaving the legacy AsyncStorage session. On a later launch, the legacy
  fallback could restore that session into SecureStore.
- **Decision:** Before removing either session value, write a SecureStore
  migration-block marker. Reads return a valid SecureStore session first, but
  never fall back to legacy storage while the marker exists. SecureStore read
  failures and malformed persisted sessions fail closed. Session operations are
  serialized within the adapter to prevent migration/logout races.
- **Migration-block invariant:** If logout cannot remove both stores, the marker
  remains and the old AsyncStorage value cannot be re-migrated. A successful new
  SecureStore login remains usable even if stale-marker cleanup is unavailable.
- **Alternatives considered:** Require both deletions to report success without
  persisted state; retry legacy deletion; delete legacy storage first; remove all
  legacy migration support; force re-authentication for existing users.
- **Consequences:** Logout reports partial cleanup failure instead of silently
  accepting it. Legacy migration remains available for existing users until a
  logout has recorded the block.
- **Remaining platform edge cases:** If the operating system removes both the
  SecureStore session and the migration marker while retaining AsyncStorage, a
  later launch is indistinguishable from a first secure migration. Corrupted
  SecureStore data is rejected; later legacy recovery is permitted only when no
  logout marker exists.
- **Reference:** YT-001 in [BACKLOG.md](./BACKLOG.md).
