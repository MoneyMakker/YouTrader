/**
 * Phase 2C — Trade assignment domain contracts.
 * Append-only events; current assignment derived from history.
 */

import type { PropOsCommandState } from "../commands/types";

export const ASSIGNMENT_BULK_MAX = 50 as const;
export const ASSIGNMENT_SCHEMA_VERSION = "prop-os-schema-v0" as const;

export type TradeAssignmentSource =
  | "manual"
  | "verified_import"
  | "system_suggestion";

/** Append-only event states (Phase 2C). */
export type TradeAssignmentEventState = "assigned" | "superseded" | "removed";

export type PropOsTradeIdentity = {
  /** Canonical journal identity = Trade.id / trade_journal.client_id */
  tradeClientId: string;
  userId: string;
  providerSource?: string | null;
  externalTradeId?: string | null;
  /** Soft-deleted or hidden legacy rows are not assignable. */
  deletedAt?: string | null;
};

export type AssignableTradeFact = {
  identity: PropOsTradeIdentity;
  symbol: string;
  direction: string;
  /** Realized P&L in major currency units (journal). Converted to minor at boundary. */
  pnlMajor: number;
  /** Prefer exit timestamp; fall back entry; required for assignability. */
  occurredAtUtc: string | null;
  tradeDate: string | null;
  contracts: number;
  feesMajor?: number | null;
  open: boolean;
};

export type AssignabilityRejectReason =
  | "not_owner"
  | "missing_identity"
  | "deleted_or_hidden"
  | "missing_timestamp"
  | "missing_pnl"
  | "malformed_timestamp"
  | "outside_challenge_window"
  | "open_trade_unsupported"
  | "incomplete"
  | "already_assigned_other_challenge"
  | "challenge_not_accepting"
  | "account_archived"
  | "bulk_limit_exceeded";

export type AssignableTradeRow = {
  trade: AssignableTradeFact;
  currentAssignment: PropTradeAssignmentEvent | null;
  assignable: boolean;
  rejectReason: AssignabilityRejectReason | null;
};

export type PropTradeAssignmentEvent = {
  id: string;
  userId: string;
  tradeClientId: string;
  accountId: string | null;
  challengeId: string | null;
  source: TradeAssignmentSource;
  state: TradeAssignmentEventState;
  effectiveAt: string;
  actor: string;
  clientRequestId: string;
  reasonCode: string | null;
  supersededAssignmentId: string | null;
  assignmentRevision: number;
  createdAt: string;
};

export type PropOsRecalculationState =
  | { kind: "not_required" }
  | { kind: "queued"; assignmentRevision: number }
  | { kind: "running"; assignmentRevision: number }
  | {
      kind: "completed";
      assignmentRevision: number;
      snapshotRevision: number;
    }
  | { kind: "failed"; assignmentRevision: number; reasonCode: string };

export type AssignmentImpactPreview = {
  selectedCount: number;
  totalRealizedPnlMajor: number;
  earliestOccurredAt: string | null;
  latestOccurredAt: string | null;
  proposedAccountId: string;
  proposedChallengeId: string;
  currentDestinationSummary: Array<{
    tradeClientId: string;
    challengeId: string | null;
  }>;
  rejected: Array<{ tradeClientId: string; reason: AssignabilityRejectReason }>;
  requiresReassignment: string[];
  recalculationScopeChallengeIds: string[];
  engineDisclaimer: "final_metrics_from_engine_after_recalc";
};

export type AssignTradesCommand = {
  clientRequestId: string;
  accountId: string;
  challengeId: string;
  tradeClientIds: string[];
  source?: TradeAssignmentSource;
  reasonCode?: string;
};

export type ReassignTradesCommand = {
  clientRequestId: string;
  accountId: string;
  challengeId: string;
  tradeClientIds: string[];
  confirmReassignment: true;
  source?: TradeAssignmentSource;
  reasonCode?: string;
};

export type RemoveTradeAssignmentsCommand = {
  clientRequestId: string;
  accountId: string;
  tradeClientIds: string[];
  reasonCode?: string;
};

export type AssignmentCommandResult = {
  events: PropTradeAssignmentEvent[];
  assignmentRevision: number;
  affectedChallengeIds: string[];
  recalculation: PropOsRecalculationState;
};

export interface PropOsTradeAssignmentReadStore {
  getAssignmentForTrade(
    userId: string,
    tradeClientId: string,
  ): Promise<PropTradeAssignmentEvent | null>;
  listAssignmentsForChallenge(
    userId: string,
    challengeId: string,
  ): Promise<PropTradeAssignmentEvent[]>;
  listAssignableTrades(
    userId: string,
    opts: {
      accountId: string;
      challengeId: string;
      filter?: AssignmentListFilter;
    },
  ): Promise<AssignableTradeRow[]>;
  getAssignmentHistory(
    userId: string,
    tradeClientId: string,
  ): Promise<PropTradeAssignmentEvent[]>;
  getRecalculationState(
    userId: string,
    challengeId: string,
  ): Promise<PropOsRecalculationState>;
}

export type AssignmentListFilter = {
  assigned?: "assigned" | "unassigned" | "all";
  dateFrom?: string;
  dateTo?: string;
  instrument?: string;
  pnlSide?: "profit" | "loss" | "all";
  conflictOnly?: boolean;
  incompleteOnly?: boolean;
};

export interface PropOsTradeAssignmentWriteService {
  assignTrades(
    cmd: AssignTradesCommand,
  ): Promise<PropOsCommandState<AssignmentCommandResult>>;
  reassignTrades(
    cmd: ReassignTradesCommand,
  ): Promise<PropOsCommandState<AssignmentCommandResult>>;
  removeTradeAssignments(
    cmd: RemoveTradeAssignmentsCommand,
  ): Promise<PropOsCommandState<AssignmentCommandResult>>;
}
