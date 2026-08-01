# YouTrader Engineering Manual

## Project Mission

YouTrader helps traders improve every day. Its core loop is:

**Log → Review → Understand → Improve → Repeat**

Every feature, fix, and design decision must strengthen this loop. YouTrader is not becoming a larger trading platform; it is becoming a better daily improvement system.

## Engineering Principles

- Quality over speed.
- Simplicity over cleverness.
- Small, isolated changes over broad rewrites.
- Preserve backwards compatibility and user data.
- Security, reliability, maintainability, accessibility, and privacy come first.
- User trust is more important than feature count.
- Prefer existing architecture and shared primitives over duplicate systems.
- Do not add complexity without measurable user value.

## Source of Truth

Document hierarchy (beliefs → decisions → engineering → experience → structure → code → ideas):

[`DOCUMENT_HIERARCHY.md`](./.codex/DOCUMENT_HIERARCHY.md)

- Constitution is the highest authority for AI assistants.
- Code must respect Architecture. UI must respect YDL. Product decisions must respect the Product Manifesto.
- If implementation conflicts with a higher document, **stop and report** — do not assume.

[`docs/BACKLOG.md`](./docs/BACKLOG.md) is the canonical implementation backlog (Layer 6 — ideas / sequenced work).
Task IDs, order, scope, dependencies, and backlog readiness are defined by its
current contents.

- Do not invent, remove, reprioritize, or combine backlog work.
- Do not add features without explicit Product Owner approval.
- Stop for approval if an approved task is technically impossible, weakens security, risks data loss, or conflicts with another approved task or a higher hierarchy document.

## Status Vocabulary

Backlog readiness is recorded only in `docs/BACKLOG.md`:

- `READY`
- `BLOCKED`
- `DEFERRED`
- `DONE`

Execution lifecycle is recorded in task reports and reviews:

- `IN PROGRESS`
- `READY FOR REVIEW`
- `APPROVED`
- `MERGED`

A task may be marked `DONE` in the canonical backlog only when its approved
implementation is present in the target branch and all applicable gates have
passed. `READY FOR REVIEW` is not a backlog-readiness status.

## Execution Workflow

For every backlog task, follow this sequence:

1. Read the task and relevant project code.
2. Understand existing architecture and constraints.
3. Implement one focused change.
4. Add or update applicable tests.
5. Run verification.
6. Self-review.
7. Update documentation and changelog when applicable.
8. Create one commit.
9. Perform an independent review.
10. Wait for Product Owner approval.
11. Only then begin the next task.

Never automatically continue to the next backlog item.

## One Task Policy

- Only one backlog task may be active.
- Exactly one backlog task equals exactly one commit.
- Do not mix unrelated changes in a commit.
- Preserve unrelated dirty-worktree changes; do not stage, reset, overwrite, stash, or amend them without explicit approval.

## Definition of Done

A task is **DONE** only when all applicable conditions are true:

- Implementation is complete.
- Unit, integration, regression, negative, and migration tests pass where applicable.
- Typecheck and lint pass.
- Security checks pass.
- Documentation is updated.
- Self-review is complete.
- Independent review is complete.
- Product Owner approval is received.

Until then, task status is **READY FOR REVIEW**.

## Self Review Checklist

Before committing, review the change for:

- Architecture and maintainability
- Security and privacy
- Performance and battery/memory impact
- Accessibility and localization
- Regression risk and backwards compatibility
- Offline behavior and data integrity
- Error handling and edge cases
- Code duplication and unnecessary complexity

Implement required improvements before committing.

## Independent Review

After committing, switch to an independent Staff Engineer mindset. Assume the implementation is wrong and attempt to prove it.

Review correctness, security, race conditions, error handling, rollback safety, offline behavior, migration safety, API compatibility, accessibility, UX, performance, maintainability, and documentation.

The only outcomes are:

- `PASS`
- `PASS WITH CONCERNS`
- `FAIL`

`FAIL` blocks progress until resolved. Product Owner approval is required after review before starting the next task.

## Testing Standards

Use the test types that apply to the task:

- Unit tests
- Integration tests
- Regression tests
- Negative-access tests
- Migration tests
- Manual device QA checklist

Do not claim an unavailable or unrun test passed. Clearly separate locally executed tests from pending integration or device verification.

## Security Rules

Never weaken:

- Authentication and authorization
- Encryption and session handling
- Secrets management
- Privacy and sensitive-data handling
- Rate limiting and idempotency
- Audit logging
- Storage/media ownership protection

Never expose service-role keys, provider secrets, tokens, prompts, or private trading data in clients, logs, tests, documentation, or commits.

## Commit Convention

One backlog task produces one focused commit.

Examples:

```text
YT-041
feat(today): implement Today screen information architecture

YT-002
security: complete shared AI quota lifecycle
```

Do not push, merge, deploy, apply migrations, or change external accounts unless explicitly authorized.

## Stop Conditions

Immediately stop and report when encountering:

- A security concern
- Data-loss possibility
- Migration risk
- Production-breaking behavior
- Architecture conflict
- A dirty worktree that overlaps requested changes
- Failing tests introduced by the task

Do not silently work around a stop condition.

## Progress Report

After a task is ready for review, report:

```text
Task
YT-XXX

Status
IN PROGRESS / READY FOR REVIEW / APPROVED / MERGED

Commit
<hash and message>

Files Changed
...

Tests
...

Risk
Low / Medium / High

Known Limitations
...

Independent Review
PASS / PASS WITH CONCERNS / FAIL

Documentation
...

Waiting For
Product Owner approval
```

## Product Philosophy

YouTrader succeeds by improving clarity, trust, discipline, consistency, and retention. Prefer the smallest useful experience that helps a trader make a better next decision.

Avoid speculative abstraction, feature sprawl, duplicate AI surfaces, unnecessary gamification, and broad trading-platform expansion.

## Future Contributors

Future engineers and AI agents must:

- Respect the approved roadmap and task order.
- Preserve established architecture and user workflows.
- Avoid speculative refactoring and unnecessary abstractions.
- Keep changes small, testable, documented, and reversible.
- Treat user data, subscription access, AI outputs, and trading-related context as high-trust product surfaces.
