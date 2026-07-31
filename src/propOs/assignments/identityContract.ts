/**
 * Canonical Prop OS journal trade identity contract (Phase 2C remediation).
 *
 * Database
 * --------
 * - Primary key: `trade_journal.id` (uuid). Immutable after insert (PK).
 * - Owner-scoped uniqueness: `UNIQUE (trade_journal.user_id, trade_journal.client_id)`.
 * - `client_id` is an immutable provenance alias after creation
 *   (trigger `prop_os_trade_journal_client_id_immutable`).
 * - Assignment events store:
 *     `journal_trade_id` → FK `trade_journal(id)`
 *     `(user_id, trade_client_id)` → FK `trade_journal(user_id, client_id)`
 * - Soft-deleted / hidden: `trade_journal.deleted_at IS NOT NULL` → unsupported for assignment.
 * - Cross-user: journal lookup is always scoped to `auth.uid()` / owner; collision on
 *   another user's `client_id` cannot grant access (row not found → incomplete / forbidden).
 *
 * TypeScript
 * ----------
 * - `journalTradeId`: canonical PK when resolved from the journal row.
 * - `tradeClientId`: provenance alias used by App `Trade.id` / command payloads.
 * - Missing canonical identity (empty client id, unresolved journal row, soft-deleted)
 *   → trade is unsupported for assignment (`missing_identity` / `deleted_or_hidden` / `incomplete`).
 * - Duplicate imports under the same owner resolve to an explicit duplicate state
 *   (`detectDuplicateIdentities` / unique constraint on insert).
 */

export const PROP_OS_JOURNAL_TRADE_IDENTITY = {
  canonicalPrimaryKey: "trade_journal.id",
  provenanceAlias: "trade_journal.client_id",
  ownerScopedUnique: ["trade_journal.user_id", "trade_journal.client_id"],
  assignmentEventFk: {
    journalTradeId: "prop_trade_assignment_events.journal_trade_id → trade_journal.id",
    userTrade: "prop_trade_assignment_events(user_id, trade_client_id) → trade_journal(user_id, client_id)",
  },
  immutability: {
    journalId: "primary key",
    clientId: "trigger prop_os_trade_journal_client_id_immutable",
  },
  softDeletedBehavior: "deleted_at IS NOT NULL → not assignable",
  crossUserCollision: "owner-scoped lookup only; no access grant",
} as const;
