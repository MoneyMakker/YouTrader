/**
 * Deterministic engine ordering for assigned trades.
 * Same assignment revision → byte-for-byte equivalent ordered engine input.
 *
 * Contract:
 * 1. Canonical occurred-at: exit → entry → trade_date (resolved upstream).
 * 2. UTC: `occurredAtUtc` must already be ISO-8601 UTC (Z / +00:00).
 * 3. Sort: occurredAtUtc ASC, then tradeClientId ASC (stable tie-breaker).
 * 4. Realized P&L required (major → minor cents); missing rows excluded upstream.
 * 5. Fees/commissions: feesMinor from journal fees (0 if absent; never invented).
 * 6. Open trades: excluded by assignability (`open_trade_unsupported`).
 * 7. Partial fills / grouped executions: one input row per fact; no silent merge.
 * 8. Reversed/cancelled: voided=true; sorted with peers; engine ignores voided.
 * 9. Challenge window: filter before ordering (assignability).
 * 10. Future timestamps: allowed if within challenge window; ordered normally.
 * 11. Malformed timestamps: rejected upstream (`malformed_timestamp`).
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

/** Normalize to canonical UTC ISO string; returns null if malformed. */
export function normalizeOccurredAtUtc(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const ms = Date.parse(String(raw).trim());
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export function orderTradesForEngine(
  trades: AssignableTradeFact[],
  opts?: { voidedIds?: ReadonlySet<string> },
): OrderedTradeInput[] {
  const voided = opts?.voidedIds ?? new Set<string>();
  const rows: OrderedTradeInput[] = [];
  for (const t of trades) {
    const occurredAtUtc = normalizeOccurredAtUtc(t.occurredAtUtc);
    if (!occurredAtUtc) continue;
    if (t.pnlMajor == null || Number.isNaN(t.pnlMajor)) continue;
    rows.push({
      tradeClientId: t.identity.tradeClientId,
      occurredAtUtc,
      realizedPnlMinor: toMinor(t.pnlMajor),
      feesMinor: toMinor(t.feesMajor ?? 0),
      contracts: t.contracts,
      voided: voided.has(t.identity.tradeClientId),
    });
  }

  rows.sort((a, b) => {
    if (a.occurredAtUtc < b.occurredAtUtc) return -1;
    if (a.occurredAtUtc > b.occurredAtUtc) return 1;
    if (a.tradeClientId < b.tradeClientId) return -1;
    if (a.tradeClientId > b.tradeClientId) return 1;
    return 0;
  });
  return rows;
}

/** Byte-stable JSON for equality proofs across the same assignment revision. */
export function orderedEngineInputBytes(ordered: OrderedTradeInput[]): string {
  return JSON.stringify(ordered);
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
