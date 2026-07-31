/**
 * Canonical PI input normalization.
 * Never invent missing values; document exclusions via reason codes.
 */

import { normalizeOccurredAtUtc } from "../assignments/ordering";
import type { PerformanceTradeInput, RawJournalTradeFact } from "./types";

export type NormalizeResult = {
  included: PerformanceTradeInput[];
  excluded: Array<{ tradeClientId: string; reason: string }>;
  exclusionReasons: Record<string, number>;
};

function toMinor(major: number): number {
  return Math.round(major * 100);
}

function mapDirection(raw: string): PerformanceTradeInput["direction"] {
  const d = String(raw ?? "").trim().toUpperCase();
  if (d === "LONG" || d === "BUY") return "long";
  if (d === "SHORT" || d === "SELL") return "short";
  return "unknown";
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Normalize raw journal/assignment facts into closed-trade PI inputs.
 *
 * Exclusions (reason codes):
 * - missing_identity, deleted_or_hidden, open_trade, voided_or_cancelled
 * - missing_pnl, malformed_timestamp, missing_timestamp
 * - duplicate_journal_id
 *
 * Fees: null/undefined → 0 (source contract: fee absence means none recorded).
 * Partial fills / grouped executions: one row per journal trade; no silent merge.
 * Deposits/withdrawals/balance adjustments: not present in trade dataset.
 */
export function normalizePerformanceTrades(
  facts: RawJournalTradeFact[],
): NormalizeResult {
  const included: PerformanceTradeInput[] = [];
  const excluded: Array<{ tradeClientId: string; reason: string }> = [];
  const exclusionReasons: Record<string, number> = {};
  const seenIds = new Set<string>();

  for (const f of facts) {
    const cid = String(f.tradeClientId ?? "").trim();
    if (!f.journalTradeId || !cid) {
      excluded.push({ tradeClientId: cid || "unknown", reason: "missing_identity" });
      bump(exclusionReasons, "missing_identity");
      continue;
    }
    if (f.deletedAt) {
      excluded.push({ tradeClientId: cid, reason: "deleted_or_hidden" });
      bump(exclusionReasons, "deleted_or_hidden");
      continue;
    }
    if (f.open) {
      excluded.push({ tradeClientId: cid, reason: "open_trade" });
      bump(exclusionReasons, "open_trade");
      continue;
    }
    if (f.voided) {
      excluded.push({ tradeClientId: cid, reason: "voided_or_cancelled" });
      bump(exclusionReasons, "voided_or_cancelled");
      continue;
    }
    if (f.pnlMajor == null || Number.isNaN(f.pnlMajor)) {
      excluded.push({ tradeClientId: cid, reason: "missing_pnl" });
      bump(exclusionReasons, "missing_pnl");
      continue;
    }
    const occurred =
      normalizeOccurredAtUtc(f.occurredAtUtc) ??
      normalizeOccurredAtUtc(f.exitTime) ??
      normalizeOccurredAtUtc(f.entryTime);
    if (!f.occurredAtUtc && !f.exitTime && !f.entryTime) {
      excluded.push({ tradeClientId: cid, reason: "missing_timestamp" });
      bump(exclusionReasons, "missing_timestamp");
      continue;
    }
    if (!occurred) {
      excluded.push({ tradeClientId: cid, reason: "malformed_timestamp" });
      bump(exclusionReasons, "malformed_timestamp");
      continue;
    }
    if (seenIds.has(f.journalTradeId)) {
      excluded.push({ tradeClientId: cid, reason: "duplicate_journal_id" });
      bump(exclusionReasons, "duplicate_journal_id");
      continue;
    }
    seenIds.add(f.journalTradeId);

    const realized = toMinor(f.pnlMajor);
    const fees = toMinor(f.feesMajor ?? 0);
    const risk =
      f.riskAmountMajor == null || Number.isNaN(f.riskAmountMajor)
        ? undefined
        : toMinor(f.riskAmountMajor);

    included.push({
      journalTradeId: f.journalTradeId,
      tradeClientId: cid,
      occurredAtUtc: occurred,
      closedAtUtc: occurred,
      instrument: String(f.symbol ?? "UNK").trim() || "UNK",
      direction: mapDirection(f.direction),
      realizedPnlMinor: realized,
      feesMinor: fees,
      netPnlMinor: realized - fees,
      size: f.contracts == null || Number.isNaN(f.contracts) ? undefined : Number(f.contracts),
      riskAmountMinor: risk,
      rMultiple:
        f.rMultiple == null || Number.isNaN(f.rMultiple) ? undefined : f.rMultiple,
      assignmentRevision: f.assignmentRevision,
      voided: false,
      open: false,
    });
  }

  return { included, excluded, exclusionReasons };
}

/** Chronological order for sequences: occurredAtUtc ASC, journalTradeId ASC. */
export function orderPerformanceTrades(
  trades: PerformanceTradeInput[],
): PerformanceTradeInput[] {
  return [...trades].sort((a, b) => {
    if (a.occurredAtUtc < b.occurredAtUtc) return -1;
    if (a.occurredAtUtc > b.occurredAtUtc) return 1;
    if (a.journalTradeId < b.journalTradeId) return -1;
    if (a.journalTradeId > b.journalTradeId) return 1;
    return 0;
  });
}

/** Recent-N: newest first by closedAtUtc/occurredAtUtc, then reverse to chrono. */
export function takeRecentTrades(
  trades: PerformanceTradeInput[],
  count: number,
): PerformanceTradeInput[] {
  const newestFirst = [...trades].sort((a, b) => {
    const at = a.closedAtUtc ?? a.occurredAtUtc;
    const bt = b.closedAtUtc ?? b.occurredAtUtc;
    if (at > bt) return -1;
    if (at < bt) return 1;
    if (a.journalTradeId > b.journalTradeId) return -1;
    if (a.journalTradeId < b.journalTradeId) return 1;
    return 0;
  });
  return orderPerformanceTrades(newestFirst.slice(0, count));
}
