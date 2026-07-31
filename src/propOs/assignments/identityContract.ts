/**
 * Canonical Prop OS journal trade identity contract (Phase 2C final).
 *
 * Database
 * --------
 * - Primary key: `trade_journal.id` (uuid). Immutable after insert (PK).
 * - Owner-scoped uniqueness: `UNIQUE (trade_journal.user_id, trade_journal.client_id)`.
 * - Identity triplet uniqueness: `UNIQUE (user_id, id, client_id)` so assignment
 *   events can FK the pair together.
 * - `client_id` is an immutable provenance alias after creation
 *   (trigger `prop_os_trade_journal_client_id_immutable`).
 * - Assignment events store BOTH:
 *     `journal_trade_id` → canonical PK
 *     `trade_client_id` → provenance alias
 *   Bound by composite FK:
 *     `(user_id, journal_trade_id, trade_client_id)
 *        → trade_journal(user_id, id, client_id)`
 *   A row mixing Trade A's id with Trade B's client_id is rejected by Postgres.
 * - Soft-deleted / hidden: `trade_journal.deleted_at IS NOT NULL` → unsupported.
 * - Cross-user: journal lookup is always owner-scoped; collision cannot grant access.
 * - Duplicate import aliases: unique `(user_id, client_id)` prevents a second target
 *   under the same alias; canonical assignment target remains `journal_trade_id`.
 *
 * TypeScript
 * ----------
 * - `journalTradeId`: canonical PK when resolved from the journal row.
 * - `tradeClientId`: provenance alias used by App `Trade.id` / command payloads.
 * - Missing canonical identity → unsupported for assignment.
 */

export const PROP_OS_JOURNAL_TRADE_IDENTITY = {
  canonicalPrimaryKey: "trade_journal.id",
  provenanceAlias: "trade_journal.client_id",
  ownerScopedUnique: ["trade_journal.user_id", "trade_journal.client_id"],
  identityTripletUnique: ["trade_journal.user_id", "trade_journal.id", "trade_journal.client_id"],
  assignmentEventFk: {
    journalTradeId: "prop_trade_assignment_events.journal_trade_id → trade_journal.id",
    userTrade: "prop_trade_assignment_events(user_id, trade_client_id) → trade_journal(user_id, client_id)",
    identityTriplet:
      "prop_trade_assignment_events(user_id, journal_trade_id, trade_client_id) → trade_journal(user_id, id, client_id)",
  },
  immutability: {
    journalId: "primary key",
    clientId: "trigger prop_os_trade_journal_client_id_immutable",
  },
  softDeletedBehavior: "deleted_at IS NOT NULL → not assignable",
  crossUserCollision: "owner-scoped lookup only; no access grant",
  mismatchBehavior: "composite FK rejects journal_trade_id from A + trade_client_id from B",
} as const;
