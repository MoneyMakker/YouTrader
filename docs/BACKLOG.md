# YouTrader 2.0 Master Backlog

## Purpose and operating rules

This is the canonical implementation backlog for YouTrader 2.0. It is
derived from the product vision, approved roadmap, architecture decisions,
security requirements, testing strategy, release process, and the current
repository state. It replaces the missing task-level inventory referenced by
[AGENTS.md](../AGENTS.md).

Task IDs and scope are defined by the current contents of this document; no
numeric task range is implied outside the records below.

The product loop is **Log → Review → Understand → Improve → Repeat**. Every
task below must strengthen that loop, its trust foundation, or its release
reliability. Do not add market-terminal, brokerage, social, copy-trading,
autonomous recommendation, or speculative gamification work without a Product
Owner decision.

### Status meanings

- **DONE** — approved and implemented; retain regression coverage.
- **READY** — sufficiently defined to execute through the one-task workflow.
- **BLOCKED** — cannot begin until the stated external decision or prerequisite exists.
- **DEFERRED** — deliberately outside the current critical path.

Execution lifecycle is separate from backlog readiness. Task reports use
`IN PROGRESS`, `READY FOR REVIEW`, `APPROVED`, and `MERGED`. A task becomes
`DONE` here only after its approved implementation is present in the target
branch and its applicable gates are satisfied.

### Execution rules

- Execute one task in the listed order: implementation, tests, documentation,
  one commit, independent review, then Product Owner approval.
- Preserve user data, public behavior, authorization boundaries, and local-first
  operation unless a task explicitly changes them.
- Do not apply migrations, deploy Edge Functions, connect external services, or
  alter production data without separate explicit approval.

## Critical path

1. Resolve YT-002 policy block → YT-002 → YT-003 → YT-004
2. YT-006 → YT-007
3. YT-008 → YT-009 → YT-010
4. YT-011 → YT-012 → YT-013
5. YT-014 → YT-015 → YT-016
6. YT-017 → YT-018 → YT-019

YT-005 is a separate governance blocker for destructive account-data work. It
does not technically block offline queue verification in YT-006.

## Release blockers

- AI requests must fail closed before a provider call when reservation or
  database access fails.
- Protected media, user data, and authenticated endpoints require verified
  ownership and negative-access coverage.
- Offline journal changes must remain recoverable and idempotent through
  restart and reconnect.
- Primary workflows need accessible loading, empty, error, and offline states.
- Release gates require the checks in [TESTING.md](./TESTING.md) and
  [RELEASE.md](./RELEASE.md), plus approved environment-specific validation.

## Milestones

| Milestone | Completion condition |
|---|---|
| Trust foundation | YT-001 through YT-004 and YT-006 are approved and their applicable local, integration, and device checks are complete. YT-005 remains a separately tracked governance gate. |
| Daily loop | YT-007 through YT-013 make Journal, Review, risk, and the next action understandable and resilient. |
| Premium quality | YT-014 through YT-016 deliver accessible, coherent, evidence-based product surfaces. |
| Release reliability | YT-017 through YT-019 establish measured performance, controlled release validation, and maintenance boundaries. |

---

## Epic 1 — Trust, Security, and Privacy Foundation

**Goal:** Make authentication, AI access, media, and account controls worthy
of a high-trust trading journal.

**Description:** Secure client sessions, enforce server-side AI controls, and
verify user-owned data/media boundaries. This implements the Trust milestone
of [ROADMAP_2.0.md](./ROADMAP_2.0.md) and the controls in
[SECURITY.md](./SECURITY.md).

**Priority:** Critical

### YT-001 — Secure persisted Supabase sessions

| Field | Definition |
|---|---|
| ID | YT-001 |
| Title | SecureStore session persistence and legacy migration hardening |
| Objective | Keep native Supabase sessions out of generic AsyncStorage while preserving a safe one-time migration for existing users. |
| User Story | As a signed-in trader, I want my session stored securely and logout to remove persisted access so another person cannot restore it from local storage. |
| Acceptance Criteria | Native Supabase storage uses SecureStore; legacy data is removed only after a secure write; logout clears secure and legacy data; migration and logout regression coverage exists; tokens are not logged. |
| Dependencies | Expo SecureStore, Supabase Auth storage contract, existing legacy AsyncStorage key. |
| Estimated Complexity | M |
| Risk | High — session persistence and migration behavior. |
| Status | DONE |
| Notes | Approved hardening is present in commit `5efb6b9` (cherry-pick of `bd31e65`); see ADR-001, ADR-008, `src/auth/secureSessionStorage.ts`, and `scripts/security/session-storage-qa.ts`. Preserve and rerun regression/device coverage when changing authentication or storage behavior. |

### YT-002 — Complete shared AI quota lifecycle

| Field | Definition |
|---|---|
| ID | YT-002 |
| Title | Complete shared AI quota lifecycle |
| Objective | Replace non-atomic, fail-open AI usage counting with an atomic server-side reservation before every protected provider call. |
| User Story | As a subscriber, I receive clear quota outcomes; as the product owner, provider cost cannot be bypassed by concurrent requests or database failures. |
| Acceptance Criteria | Every protected AI provider path reserves quota before invocation; reservation/database failure returns a generic 503 and does not call a provider; a denied reservation returns 429 and does not call a provider; reservation is atomic across concurrent requests; the lifecycle and duplicate-request behavior are documented; logs exclude prompts, tokens, provider keys, and private trading data. |
| Dependencies | `public.security_reserve_ai_quota` migration, service-role-only RPC grant, server entitlement checks, existing Edge Functions and `ai_usage_events`. |
| Estimated Complexity | L |
| Risk | High — provider cost control, availability, and migration correctness. |
| Status | BLOCKED |
| Notes | Repository evidence confirms action-specific buckets using one shared lifecycle service, a service-role-only atomic reservation primitive, and ADR-003 fail-closed 503/429 behavior. It does **not** define terminal reservation states, refund policy, or the client request-id/idempotency contract. Do not apply migrations without approval. |

#### YT-002 policy record

| Question | Repository-backed answer |
|---|---|
| Meaning of “shared” | A shared server-side lifecycle service across action-specific buckets; it is not a documented single global quota pool. `rateLimits.ts` defines daily and weekly action buckets. |
| Authoritative layer | Database/RPC for atomic reservation and enforcement; Edge Functions authorize and invoke it; clients are non-authoritative. |
| Daily and weekly limits | Both are configured, action-specific rules. No repository evidence defines a combined global limit. |
| Reservation timing | The committed RPC is designed to reserve before a provider request, but no current Edge Function wiring makes it authoritative. |
| Current observable states | Existing records distinguish an RPC-inserted `reserved` provider value from later usage records. No repository-backed `completed`, `provider_failed`, `released`, or refund transition exists. |
| Commit/release behavior | TBD — requires Product Owner policy. The repository does not say whether a provider timeout/failure consumes a quota unit or is refunded. |
| Idempotency key and scope | TBD — requires Product Owner policy. The current AI quota RPC has no request identifier and no documented duplicate-result contract. |
| Timeout, retry, duplicate request, client disconnect | TBD — requires Product Owner policy for reservation ownership and retry semantics. |
| Fail-closed behavior | Reservation or database failure must return generic 503 before provider invocation; a denied reservation must return 429 before provider invocation (ADR-003). |

**Required Product Owner decision before YT-002:** choose whether a reservation
is consumed at provider-attempt start or refunded when no provider result is
obtained, and approve the request-identifier/idempotency scope for retries.

### YT-003 — Add AI quota authorization and lifecycle regression coverage

| Field | Definition |
|---|---|
| ID | YT-003 |
| Title | Verify AI quota denial, failure, and concurrency behavior |
| Objective | Prove the AI quota boundary prevents provider calls when authorization, reservation, or database access fails. |
| User Story | As a trader, I get a safe, predictable outcome instead of duplicate charges, hidden failures, or inconsistent quota results. |
| Acceptance Criteria | Local tests cover database failure, denied reservation, concurrent requests, duplicate requests, quota exhaustion, provider failure, malformed requests, and log sanitization; Supabase integration tests cover service-role access, denied anon/authenticated execution, quota boundary, and cross-user isolation; unrun environment-dependent tests are explicitly marked pending. |
| Dependencies | YT-002, [TESTING.md](./TESTING.md), Supabase integration environment for pending tests. |
| Estimated Complexity | M |
| Risk | High — false confidence could leave a cost-control bypass. |
| Status | READY |
| Notes | The testing strategy explicitly requires negative, integration, regression, and failure/recovery coverage for protected flows. |

### YT-004 — Verify protected media ownership and signed access

| Field | Definition |
|---|---|
| ID | YT-004 |
| Title | Add protected media authorization regression coverage |
| Objective | Verify private user media cannot be uploaded, listed, downloaded, or signed by another user. |
| User Story | As a trader, my screenshots and voice notes remain visible only to me. |
| Acceptance Criteria | Tests cover authenticated owner upload/read, cross-user denial, invalid path ownership, MIME/size rejection, and expired signed URLs; private bucket and path-scope assumptions are documented; pending linked-Supabase tests are checked in but not claimed as passed. |
| Dependencies | Private Storage buckets, secure-upload Edge Function, RLS/storage policies, linked test environment. |
| Estimated Complexity | M |
| Risk | High — private trading evidence and media exposure. |
| Status | READY |
| Notes | Required by [SECURITY.md](./SECURITY.md) and the negative-access test layer in [TESTING.md](./TESTING.md). |

### YT-005 — Make data export and account-deletion completion states trustworthy

| Field | Definition |
|---|---|
| ID | YT-005 |
| Title | Clarify account data controls and completion states |
| Objective | Make export, deletion, and cloud-data outcomes understandable without weakening retention or privacy controls. |
| User Story | As a trader, I can find my data controls and know whether export or account deletion completed, failed, or needs action. |
| Acceptance Criteria | Account, export, deletion, and subscription states are discoverable; loading, success, failure, and recovery messages are accessible and localized; deletion/export behavior and retained operational records are documented before destructive automation is introduced. |
| Dependencies | Settings/account controls, privacy requirements, documented deletion/retention policy. |
| Estimated Complexity | M |
| Risk | High — irreversible user-data and privacy expectations. |
| Status | BLOCKED |
| Notes | Product need is established by the roadmap and release checklist. Exact retention and deletion semantics require Product Owner/legal clarification before implementation. |

---

## Epic 2 — Offline Reliability and Data Integrity

**Goal:** Ensure journal evidence survives offline use, account changes, restart,
and reconnect.

**Description:** Preserve the local-first journal promise and make sync state
visible enough for traders to trust their records.

**Priority:** Critical

### YT-006 — Verify offline queue recovery and account isolation

| Field | Definition |
|---|---|
| ID | YT-006 |
| Title | Add offline queue recovery and user-isolation regression coverage |
| Objective | Verify queued trade changes remain scoped to the correct user and reconcile safely after restart or reconnect. |
| User Story | As a trader, I can log trades offline and trust that they will not disappear, duplicate, or appear in another account. |
| Acceptance Criteria | Tests cover offline create/update/delete, restart, reconnect, retry, duplicate delivery, and account switch; server sync remains user-scoped and idempotent; failures surface a safe retry state without losing local intent. |
| Dependencies | `src/sync/offlineQueue.ts`, reconnect flow, authenticated Supabase sync, test fixtures. |
| Estimated Complexity | L |
| Risk | High — potential journal data loss or cross-account exposure. |
| Status | READY |
| Notes | Directly required by the Architecture data-flow invariants and Testing manual checklist. |

### YT-007 — Expose trade-level offline and sync state

| Field | Definition |
|---|---|
| ID | YT-007 |
| Title | Surface saved, syncing, synced, and retry-required trade states |
| Objective | Make local-first persistence visible at the trade level without changing sync semantics. |
| User Story | As a trader, I know whether a trade is safely stored locally, syncing, complete, or needs retry. |
| Acceptance Criteria | Trade-level state distinguishes local save, in-progress sync, success, and recoverable failure; messages work offline and with assistive technology; retry does not duplicate remote data. |
| Dependencies | YT-006, existing cloud-sync status, journal presentation layer, localization. |
| Estimated Complexity | M |
| Risk | Medium — incorrect status can damage user trust. |
| Status | READY |
| Notes | Supports the Daily Loop milestone and the local-first architecture. |

---

## Epic 3 — Product Focus and Information Architecture

**Goal:** Make the daily Journal → Review → Risk → next-action workflow the
clearest path through the app.

**Description:** Reduce cognitive load without removing the existing trusted
journal, analytics, prop-risk, or data-ownership workflows.

**Priority:** High

### YT-008 — Create a Journal-first first-run and empty-state path

| Field | Definition |
|---|---|
| ID | YT-008 |
| Title | Focus first-run and empty states on logging the first trade |
| Objective | Help a new or empty-state user enter the evidence-capture loop before exposing unavailable analytics. |
| User Story | As a new trader, I immediately understand the smallest useful next action: log my first trade. |
| Acceptance Criteria | Empty Journal and review states explain the value of one first trade; primary action opens the existing trade-entry path; copy is localized, accessible, and does not promise analytics without data. |
| Dependencies | Existing journal entry flow, localization, shared state patterns. |
| Estimated Complexity | M |
| Risk | Low — navigation and onboarding regression. |
| Status | READY |
| Notes | Derived from the product vision’s core loop and the roadmap’s Daily Loop milestone. |

### YT-009 — Establish the focused Today hierarchy

| Field | Definition |
|---|---|
| ID | YT-009 |
| Title | Implement the approved Today next-action hierarchy |
| Objective | Present one context-aware next action that directs the trader to log, review, or protect risk. |
| User Story | As a returning trader, I can act on the most useful next step without scanning competing dashboards. |
| Acceptance Criteria | The primary hierarchy is journal/review/risk-oriented; no brokerage, prediction, or market-terminal behavior is introduced; unavailable-data states have a useful fallback; navigation preserves existing destinations. |
| Dependencies | YT-008, existing journal/statistics/prop-risk state, ADR-005. |
| Estimated Complexity | L |
| Risk | Medium — information architecture and navigation regression. |
| Status | READY |
| Notes | ADR-005 explicitly approves a focused Today hierarchy through backlog work. |

### YT-010 — Simplify statistics to an Essential Five default view

| Field | Definition |
|---|---|
| ID | YT-010 |
| Title | Prioritize essential performance, risk, consistency, and behavioral metrics |
| Objective | Make deterministic journal-derived insights understandable before advanced analytics. |
| User Story | As a trader, I can understand my performance and one meaningful improvement signal without navigating dense metric sets. |
| Acceptance Criteria | A default concise metric hierarchy is derived from existing deterministic analytics; advanced metrics remain available without duplicating calculations; sample-size limitations are communicated; labels are localized and accessible. |
| Dependencies | Existing `src/analytics` calculations, YT-008, product metric definitions. |
| Estimated Complexity | M |
| Risk | Medium — interpretation and visual regression. |
| Status | READY |
| Notes | Architecture requires analytics remain deterministic and separate from AI provider calls. |

---

## Epic 4 — AI Review Consolidation

**Goal:** Make AI an evidence-based educational review layer, not a collection
of competing destinations or financial advice surfaces.

**Description:** Consolidate existing review context behind clear evidence,
confidence, latency, quota, and failure communication.

**Priority:** High

### YT-011 — Consolidate AI review entry points around one review workflow

| Field | Definition |
|---|---|
| ID | YT-011 |
| Title | Unify AI review entry points around the journal review workflow |
| Objective | Reduce overlapping AI surfaces while retaining existing educational capabilities. |
| User Story | As a trader, I know where to ask for an evidence-based review of my journal and what action to take next. |
| Acceptance Criteria | AI navigation uses one understandable review entry point; deterministic metrics remain visibly distinct from AI interpretation; existing AI links retain a compatible route or redirect; AI never becomes execution advice. |
| Dependencies | YT-002, YT-010, existing AI Coach and review surfaces, product copy. |
| Estimated Complexity | L |
| Risk | Medium — discoverability and paid-feature regression. |
| Status | READY |
| Notes | Supports the roadmap’s Unified AI Review milestone and Product Vision principles. |

### YT-012 — Add AI evidence, confidence, quota, and safe-failure communication

| Field | Definition |
|---|---|
| ID | YT-012 |
| Title | Explain AI basis, limits, and recoverable failure states |
| Objective | Make AI outputs trustworthy by showing their evidence boundaries and safe operational state. |
| User Story | As a trader, I can tell what the AI used, how reliable it is, whether I have quota, and what to do when the service is unavailable. |
| Acceptance Criteria | AI results identify supporting journal evidence or limitations; low-data and low-confidence states are explicit; loading, quota-denied, timeout, and generic unavailable states are accessible and localized; no prompt, token, or private trading data appears in UI logs or diagnostics. |
| Dependencies | YT-002, YT-003, existing normalized AI response contracts, localization. |
| Estimated Complexity | M |
| Risk | Medium — user trust and privacy. |
| Status | READY |
| Notes | Aligns with Product Vision: evidence before opinion and discipline before prediction. |

---

## Epic 5 — Prop-Firm Risk Experience

**Goal:** Keep prop-firm risk a focused companion to daily discipline rather
than a separate complexity layer.

**Description:** Clarify current safety, rule boundaries, and one recommended
protective action using existing deterministic risk capabilities.

**Priority:** High

### YT-013 — Clarify the current prop-risk workflow

| Field | Definition |
|---|---|
| ID | YT-013 |
| Title | Focus prop-firm risk on safety status, rule alert, and next action |
| Objective | Make the current risk position actionable without changing rule calculations. |
| User Story | As a prop-firm trader, I can immediately see whether I am safe, which rule matters, and what to do next. |
| Acceptance Criteria | Existing deterministic risk calculations remain unchanged; the primary view communicates current safety and the most relevant rule/action; missing firm configuration and insufficient trade data have clear states; copy is accessible and localized. |
| Dependencies | Existing `src/propFirm` calculations and templates, YT-009. |
| Estimated Complexity | M |
| Risk | High — risk communication must not imply financial advice or alter firm rules. |
| Status | READY |
| Notes | Product Vision identifies prop-firm traders as a core target audience. |

---

## Epic 6 — UX System, Accessibility, and iOS Quality

**Goal:** Deliver calm, native-feeling primary workflows across ability, device,
network, and display conditions.

**Description:** Establish reusable states and validate accessibility before
expanding product breadth.

**Priority:** High

> **Note (UI infrastructure track):** CEO-directed **UI Infra Phase 6**
> (component hardening + visual regression) is **FINAL APPROVED** with
> 14/14 PNG baselines in `.maestro/ydl/baselines/` — see
> `docs/UI_INFRA_PHASE6.md` and `docs/YDL_ADOPTION_POLICY.md`. It is **not**
> the same as any “AI Phase 6” naming elsewhere. It supports Epic 6 goals but
> does not renumber YT-014 / YT-015.
>
> **YouTrader 3.0 product track** starts with Phase 0 — Prop Domain Architecture
> (0A Schema → 0B Engine → 0C Fixtures → 0D Migration). Audit:
> `docs/architecture/PROP_OS_PHASE0_DATA_AUDIT.md` (**FINAL APPROVED**).
> Domain spec: `docs/architecture/PROP_OS_PHASE_0A_DOMAIN_SPEC.md`.
> Do not redesign AI Analytics → Prop Pass before 0A–0D approval.

### YT-014 — Standardize loading, empty, error, and offline states

| Field | Definition |
|---|---|
| ID | YT-014 |
| Title | Establish reusable primary-workflow state patterns |
| Objective | Remove inconsistent or silent states from Journal, Review, AI, settings, and sync-adjacent screens. |
| User Story | As a trader, I always understand whether data is loading, unavailable, empty, saved locally, or needs recovery. |
| Acceptance Criteria | Shared state patterns cover loading, empty, recoverable error, and offline states; affected primary flows provide an actionable next step; messages are localized and announced to assistive technology; no workflow silently drops an error. |
| Dependencies | YT-007, existing UI primitives, localization. |
| Estimated Complexity | M |
| Risk | Medium — broad presentation regression if applied without staged coverage. |
| Status | READY |
| Notes | Keep business logic outside presentation components per Architecture boundaries. |

### YT-015 — Complete accessibility and device-quality pass for primary flows

| Field | Definition |
|---|---|
| ID | YT-015 |
| Title | Validate Dynamic Type, VoiceOver, motion, dark mode, and permission recovery |
| Objective | Ensure the core daily workflow remains usable with iOS accessibility settings and realistic permission/network outcomes. |
| User Story | As a trader using accessibility settings or a constrained device state, I can still log, review, and manage my account safely. |
| Acceptance Criteria | Journal, review, AI, prop-risk, settings, and subscription flows pass documented VoiceOver and Dynamic Type checks; dark mode and Reduce Motion regressions are addressed; camera/library/notification denial paths explain recovery; device QA evidence is recorded. |
| Dependencies | YT-014, iOS device/simulator access, [TESTING.md](./TESTING.md). |
| Estimated Complexity | L |
| Risk | Medium — broad primary-flow coverage. |
| Status | READY |
| Notes | Requires manual device verification; do not claim it passed without that evidence. |

---

## Epic 7 — Monetization and Subscription Trust

**Goal:** Explain premium value through better review, risk control, and secure
history while keeping entitlement enforcement server-side.

**Description:** Improve clarity without changing purchase identity, product
configuration, or entitlement authority.

**Priority:** High

### YT-016 — Simplify paywall, trial, restore, and subscription-state communication

| Field | Definition |
|---|---|
| ID | YT-016 |
| Title | Clarify premium outcomes and purchase recovery states |
| Objective | Make subscription value and recovery behavior understandable without enabling client-only access bypass. |
| User Story | As a trader, I understand what premium improves, can restore a purchase, and can see the accurate status of my access. |
| Acceptance Criteria | Paywall focuses on review, risk control, and secure history; restore, cancellation, unavailable, and entitlement-refresh states are clear, localized, and accessible; protected server resources continue to verify entitlement server-side. |
| Dependencies | Existing RevenueCat integration, server entitlement checks, YT-014. |
| Estimated Complexity | M |
| Risk | High — purchase trust and entitlement regression. |
| Status | READY |
| Notes | The Architecture forbids subscription UI as the sole authorization boundary. |

---

## Epic 8 — Performance and Architecture Reliability

**Goal:** Improve startup, rendering, and maintainability through measured,
deliberate changes rather than opportunistic rewrites.

**Description:** Establish measurable budgets and isolate large composition
surfaces only after state boundaries and regression coverage are clear.

**Priority:** Medium

### YT-017 — Establish performance baselines and budgets for primary workflows

| Field | Definition |
|---|---|
| ID | YT-017 |
| Title | Measure startup, journal, chart, media, and AI presentation performance |
| Objective | Create repeatable performance evidence before optimization or structural change. |
| User Story | As a trader, the app feels responsive without unnecessary battery or memory cost. |
| Acceptance Criteria | Baselines and budgets cover cold launch, journal list, chart rendering, image/media handling, and AI loading; measurements distinguish simulator from device results; regressions have an owner and release threshold. |
| Dependencies | Performance QA tooling, representative non-production data, device access. |
| Estimated Complexity | M |
| Risk | Low — measurement-only work, but misleading data can drive poor decisions. |
| Status | READY |
| Notes | Required before performance optimization; aligns with the Performance QA layer. |

### YT-018 — Deliberately decompose App.tsx composition boundaries

| Field | Definition |
|---|---|
| ID | YT-018 |
| Title | Reduce App.tsx orchestration coupling through approved state boundaries |
| Objective | Improve maintainability without changing Journal, auth, sync, subscription, or navigation behavior. |
| User Story | As an engineer, I can change a focused product area without risking unrelated app-wide state. |
| Acceptance Criteria | A written boundary plan identifies extracted responsibilities; each extraction preserves public behavior and existing state ownership; affected workflows have regression coverage; no wholesale rewrite or duplicate state system is introduced. |
| Dependencies | YT-017, ADR-007, focused regression coverage. |
| Estimated Complexity | L |
| Risk | High — App.tsx is the application integration hub. |
| Status | BLOCKED |
| Notes | ADR-007 requires defined state boundaries and regression coverage before decomposition. The exact first extraction requires a Product Owner-approved boundary plan. |

---

## Epic 9 — Release Readiness and Operational Control

**Goal:** Make releases deliberate, testable, privacy-safe, and reversible.

**Description:** Complete repository-local release evidence and clearly separate
local checks from environment-dependent approval gates.

**Priority:** Critical before a public release

### YT-019 — Create and execute the 2.0 release verification matrix

| Field | Definition |
|---|---|
| ID | YT-019 |
| Title | Verify critical user journeys and release gates |
| Objective | Consolidate required local, integration, device, privacy, and rollback evidence for a 2.0 release decision. |
| User Story | As a release owner, I can tell which critical workflows passed, which are pending, and whether release is safe to approve. |
| Acceptance Criteria | Matrix covers auth/session, journal, offline sync, media, AI quota/failure, subscription, export/deletion, accessibility, privacy, and rollback; each check records command or manual evidence; unavailable environment checks remain pending; no production deployment occurs as part of the task. |
| Dependencies | YT-002 through YT-018 as applicable, [TESTING.md](./TESTING.md), [RELEASE.md](./RELEASE.md), approved non-production environment. |
| Estimated Complexity | M |
| Risk | High — release confidence and operational safety. |
| Status | BLOCKED |
| Notes | Execution requires a stable candidate and Product Owner authorization for environment-specific validation. |

## Deferred scope

The following are intentionally not backlog tasks for the current 2.0 critical
path: widgets, Live Activities, expanded watchlists, additional AI personas,
social/community features, brokerage execution or account linking, a general
market terminal, broader gamification, and desktop/web parity. They do not
strengthen the current product promise enough to justify their complexity.

## Suggested implementation order

Execute the Critical Path order at the top of this document. Within a task,
follow the one-task workflow in [AGENTS.md](../AGENTS.md). A **BLOCKED** task
must not be implemented until its stated decision or prerequisite is recorded
in this backlog or an Architecture Decision Record.
