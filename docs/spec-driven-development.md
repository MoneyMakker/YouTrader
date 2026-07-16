# Spec-Driven Development

YouTrader shares Agent-007's versioned SDD contract. Its local `specs/contract` copy is a pinned review artifact; validate drift against the canonical Agent-007 worktree before implementation. The contract stores architecture and evidence references, never secrets or source-code bodies.

Levels 0/1 are proportionate. Level 2/3 work requires a clean isolated worktree, acceptance criteria, risk and evidence record, validation, and approved merge path. Auth, RLS, payments, provider/privacy routing, destructive migrations, TestFlight, and App Store release are always Level 3.
