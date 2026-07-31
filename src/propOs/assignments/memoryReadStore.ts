/**
 * Memory assignment read store.
 */

import { evaluateAssignability } from "./assignability";
import { buildAssignmentImpactPreview } from "./preview";
import type {
  AssignableTradeRow,
  AssignmentImpactPreview,
  AssignmentListFilter,
  PropOsRecalculationState,
  PropOsTradeAssignmentReadStore,
  PropTradeAssignmentEvent,
} from "./types";
import {
  currentAssignmentForTrade,
  type MemoryAssignmentStore,
} from "./memoryStore";

export function createMemoryAssignmentReadStore(
  store: MemoryAssignmentStore,
): PropOsTradeAssignmentReadStore & {
  buildPreview(input: {
    userId: string;
    accountId: string;
    challengeId: string;
    selectedIds: string[];
    filter?: AssignmentListFilter;
  }): Promise<AssignmentImpactPreview>;
} {
  return {
    async getAssignmentForTrade(userId, tradeClientId) {
      return currentAssignmentForTrade(store, userId, tradeClientId);
    },

    async listAssignmentsForChallenge(userId, challengeId) {
      const out: PropTradeAssignmentEvent[] = [];
      const seen = new Set<string>();
      for (const t of store.trades) {
        if (t.identity.userId !== userId) continue;
        const cur = currentAssignmentForTrade(store, userId, t.identity.tradeClientId);
        if (cur?.challengeId === challengeId && !seen.has(cur.tradeClientId)) {
          out.push(cur);
          seen.add(cur.tradeClientId);
        }
      }
      return out;
    },

    async listAssignableTrades(userId, opts) {
      const ch = store.challenges.get(opts.challengeId);
      const acc = store.accounts.get(opts.accountId);
      if (!ch || !acc || ch.userId !== userId || acc.userId !== userId) {
        return [];
      }
      const filter = opts.filter ?? {};
      const rows: AssignableTradeRow[] = [];

      for (const trade of store.trades) {
        if (trade.identity.userId !== userId) continue;
        const current = currentAssignmentForTrade(
          store,
          userId,
          trade.identity.tradeClientId,
        );
        const verdict = evaluateAssignability({
          userId,
          trade,
          current,
          challenge: {
            accountId: opts.accountId,
            challengeId: opts.challengeId,
            accountStatus: acc.status,
            challengeStatus: ch.status,
            startedAt: ch.startedAt,
            endedAt: ch.endedAt,
          },
          allowReassignment: false,
        });

        // Same-challenge already assigned is still listable as assigned
        const sameChallenge =
          current?.state === "assigned" && current.challengeId === opts.challengeId;
        const row: AssignableTradeRow = {
          trade,
          currentAssignment: current,
          assignable: verdict.ok || sameChallenge,
          rejectReason: sameChallenge ? null : verdict.reason,
        };

        if (!passesFilter(row, filter)) continue;
        rows.push(row);
      }
      return rows;
    },

    async getAssignmentHistory(userId, tradeClientId) {
      return store.events
        .filter((e) => e.userId === userId && e.tradeClientId === tradeClientId)
        .slice()
        .sort(
          (a, b) =>
            a.assignmentRevision - b.assignmentRevision ||
            a.createdAt.localeCompare(b.createdAt),
        );
    },

    async getRecalculationState(userId, challengeId) {
      const ch = store.challenges.get(challengeId);
      if (!ch || ch.userId !== userId) return { kind: "not_required" };
      return store.recalc.get(challengeId) ?? { kind: "not_required" };
    },

    async buildPreview(input) {
      const rows = await this.listAssignableTrades(input.userId, {
        accountId: input.accountId,
        challengeId: input.challengeId,
        filter: input.filter,
      });
      return buildAssignmentImpactPreview({
        rows,
        selectedIds: input.selectedIds,
        accountId: input.accountId,
        challengeId: input.challengeId,
      });
    },
  };
}

function passesFilter(row: AssignableTradeRow, filter: AssignmentListFilter): boolean {
  const assigned = filter.assigned ?? "all";
  const isAssigned = row.currentAssignment?.state === "assigned";
  if (assigned === "assigned" && !isAssigned) return false;
  if (assigned === "unassigned" && isAssigned) return false;

  if (filter.instrument && row.trade.symbol !== filter.instrument) return false;
  if (filter.pnlSide === "profit" && !(row.trade.pnlMajor > 0)) return false;
  if (filter.pnlSide === "loss" && !(row.trade.pnlMajor < 0)) return false;

  if (filter.conflictOnly) {
    if (row.rejectReason !== "already_assigned_other_challenge") return false;
  }
  if (filter.incompleteOnly) {
    if (
      row.rejectReason !== "incomplete" &&
      row.rejectReason !== "missing_timestamp" &&
      row.rejectReason !== "missing_pnl" &&
      row.rejectReason !== "malformed_timestamp"
    ) {
      return false;
    }
  }

  if (filter.dateFrom || filter.dateTo) {
    const t = row.trade.occurredAtUtc ? Date.parse(row.trade.occurredAtUtc) : NaN;
    if (Number.isNaN(t)) return false;
    if (filter.dateFrom && t < Date.parse(filter.dateFrom)) return false;
    if (filter.dateTo && t > Date.parse(filter.dateTo)) return false;
  }
  return true;
}

/**
 * Prop Pass compatibility for recalculation.
 * Prior snapshots remain readable while queued/running/failed, but must be
 * exposed as `outdated` — never silently `current`.
 */
export function mapRecalcToPropPassKind(
  state: PropOsRecalculationState,
  opts?: { hasPriorCompatibleSnapshot?: boolean },
):
  | "current"
  | "outdated"
  | "recalculation_pending"
  | "recalculation_failed"
  | "no_compatible_snapshot" {
  switch (state.kind) {
    case "not_required":
      return "current";
    case "completed":
      return "current";
    case "queued":
    case "running":
      if (opts?.hasPriorCompatibleSnapshot) return "outdated";
      return "recalculation_pending";
    case "failed":
      if (opts?.hasPriorCompatibleSnapshot) return "outdated";
      return "recalculation_failed";
    default:
      return "no_compatible_snapshot";
  }
}
