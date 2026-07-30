/**
 * Deterministic engine ordering for assigned trades.
 * Same assignment set → same ordered input.
 */

import type { AssignableTradeFact } from "./types";

export type OrderedTradeInput = {
  tradeClientId: string;
  occurredAtUtc: string;
  realizedPnlMinor: number;
  feesMinor: number;
  contracts: number;
  voided: boolean;
};

function toMinor(major: number): number {
  return Math.round(major * 100);
}

/**
 * Primary: occurredAtUtc ASC
 * Tie-breaker: tradeClientId ASC
 * Grouped executions: same tradeClientId stay contiguous by occurredAt
 * Timezone: callers must normalize to UTC ISO before ordering
 * Partial fills: each fact row is one ordered unit (no silent merge)
 * Fees: included as feesMinor; not invented
 * Cancelled/reversed: voided=true rows sort with peers but engine may ignore
 * Outside window: filtered before ordering by assignability
 */
export function orderTradesForEngine(
  trades: AssignableTradeFact[],
  opts?: { voidedIds?: ReadonlySet<string> },
): OrderedTradeInput[] {
  const voided = opts?.voidedIds ?? new Set<string>();
  const rows = trades
    .filter((t) => t.occurredAtUtc)
    .map((t) => ({
      tradeClientId: t.identity.tradeClientId,
      occurredAtUtc: t.occurredAtUtc as string,
      realizedPnlMinor: toMinor(t.pnlMajor),
      feesMinor: toMinor(t.feesMajor ?? 0),
      contracts: t.contracts,
      voided: voided.has(t.identity.tradeClientId),
    }));

  rows.sort((a, b) => {
    if (a.occurredAtUtc < b.occurredAtUtc) return -1;
    if (a.occurredAtUtc > b.occurredAtUtc) return 1;
    if (a.tradeClientId < b.tradeClientId) return -1;
    if (a.tradeClientId > b.tradeClientId) return 1;
    return 0;
  });
  return rows;
}

/** Stable revision fingerprint for snapshot input_revision. */
export function assignmentInputRevision(
  assignmentRevision: number,
  ordered: OrderedTradeInput[],
): string {
  const ids = ordered.map((r) => r.tradeClientId).join(",");
  return `asg-rev-${assignmentRevision}:${ids.length}:${hashLite(ids)}`;
}

function hashLite(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
