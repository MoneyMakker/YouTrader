# Contributing

## Before You Start

Read [AGENTS.md](../AGENTS.md), [BACKLOG.md](./BACKLOG.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP_2.0.md](./ROADMAP_2.0.md), [SECURITY.md](./SECURITY.md), and [TESTING.md](./TESTING.md). `BACKLOG.md` is the implementation source of truth.

## Development Workflow

1. Confirm the active backlog item and inspect the relevant code.
2. Check `git status`; preserve unrelated dirty changes.
3. Implement exactly one task.
4. Add applicable tests and update documentation.
5. Run typecheck, relevant tests, security checks, and `git diff --check`.
6. Self-review, create one focused commit, and perform independent review.
7. Wait for Product Owner approval before starting another task.

## Branch Strategy

Use short-lived branches with the `codex/` prefix unless an approved task names a branch. Keep one task per branch/commit where practical. Never force-push, merge, deploy, apply migrations, or change external accounts without explicit authorization.

## Commit Rules

- One backlog item equals one focused commit.
- Use the task ID and a conventional subject, for example: `YT-041 feat(today): implement Today screen information architecture`.
- Do not stage unrelated working-tree changes.

## Review and Definition of Done

Follow the Definition of Done and independent-review process in [AGENTS.md](../AGENTS.md). `READY`, `BLOCKED`, `DEFERRED`, and `DONE` describe backlog readiness; `READY FOR REVIEW` describes an implementation awaiting Product Owner approval.

## Testing and Documentation

Use the applicable test layers in [TESTING.md](./TESTING.md). Never claim pending environment/device tests passed. Update architecture, decisions, security, testing, release, and changelog documentation whenever behavior or operations change.
