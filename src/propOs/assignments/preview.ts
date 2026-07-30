import type {
  AssignabilityRejectReason,
  AssignableTradeRow,
  AssignmentImpactPreview,
} from "./types";

export function buildAssignmentImpactPreview(input: {
  rows: AssignableTradeRow[];
  selectedIds: string[];
  accountId: string;
  challengeId: string;
}): AssignmentImpactPreview {
  const selected = new Set(input.selectedIds);
  const picked = input.rows.filter((r) => selected.has(r.trade.identity.tradeClientId));
  const rejected: Array<{ tradeClientId: string; reason: AssignabilityRejectReason }> = [];
  const requiresReassignment: string[] = [];
  const ok: AssignableTradeRow[] = [];

  for (const row of picked) {
    if (!row.assignable && row.rejectReason === "already_assigned_other_challenge") {
      requiresReassignment.push(row.trade.identity.tradeClientId);
      continue;
    }
    if (!row.assignable && row.rejectReason) {
      rejected.push({
        tradeClientId: row.trade.identity.tradeClientId,
        reason: row.rejectReason,
      });
      continue;
    }
    ok.push(row);
  }

  const times = ok
    .map((r) => r.trade.occurredAtUtc)
    .filter((t): t is string => Boolean(t))
    .sort();

  const recalc = new Set<string>([input.challengeId]);
  for (const row of picked) {
    if (row.currentAssignment?.challengeId) {
      recalc.add(row.currentAssignment.challengeId);
    }
  }

  return {
    selectedCount: picked.length,
    totalRealizedPnlMajor: ok.reduce((s, r) => s + r.trade.pnlMajor, 0),
    earliestOccurredAt: times[0] ?? null,
    latestOccurredAt: times[times.length - 1] ?? null,
    proposedAccountId: input.accountId,
    proposedChallengeId: input.challengeId,
    currentDestinationSummary: picked.map((r) => ({
      tradeClientId: r.trade.identity.tradeClientId,
      challengeId: r.currentAssignment?.challengeId ?? null,
    })),
    rejected,
    requiresReassignment,
    recalculationScopeChallengeIds: [...recalc],
    engineDisclaimer: "final_metrics_from_engine_after_recalc",
  };
}
