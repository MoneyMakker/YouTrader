/**
 * Dataset / input revision identity for Performance Intelligence.
 */

import { createHash, stableStringify } from "./hash";
import type { IntelligenceScope, PerformanceTradeInput } from "./types";
import { scopeKey } from "./scope";

export type DatasetIdentityInput = {
  scope: IntelligenceScope;
  assignmentRevision: number;
  trades: PerformanceTradeInput[];
  metricSpecVersion: string;
  engineVersion: string;
};

/**
 * Metric-relevant trade fingerprint (ordered).
 * Display-only fields must not be included.
 */
export function tradeMetricFingerprint(t: PerformanceTradeInput): string {
  return [
    t.journalTradeId,
    t.tradeClientId,
    t.occurredAtUtc,
    t.closedAtUtc ?? "",
    t.instrument,
    t.direction,
    String(t.realizedPnlMinor),
    String(t.feesMinor),
    String(t.netPnlMinor),
    t.size == null ? "" : String(t.size),
    t.riskAmountMinor == null ? "" : String(t.riskAmountMinor),
    t.rMultiple == null ? "" : String(t.rMultiple),
    String(t.assignmentRevision),
  ].join("\u001f");
}

export function buildDatasetIdentityHash(input: DatasetIdentityInput): string {
  const scopeNorm = scopeKey(input.scope);
  const window =
    input.scope.kind === "date_range"
      ? `${input.scope.startUtc}|${input.scope.endUtc}`
      : input.scope.kind === "recent_trades"
        ? `recent:${input.scope.count}`
        : input.scope.kind === "challenge"
          ? `challenge:${input.scope.challengeId}`
          : `account:${input.scope.includeArchivedChallenges ? "arch" : "active"}`;

  const body = stableStringify({
    scopeKey: scopeNorm,
    scopeKind: input.scope.kind,
    accountId: input.scope.accountId,
    window,
    assignmentRevision: input.assignmentRevision,
    tradeCount: input.trades.length,
    trades: input.trades.map(tradeMetricFingerprint),
    metricSpecVersion: input.metricSpecVersion,
    engineVersion: input.engineVersion,
  });
  return createHash(body);
}

export function buildInputRevisionV1(input: {
  assignmentRevision: number;
  scope: IntelligenceScope;
  datasetIdentityHash: string;
  metricSpecVersion: string;
  engineVersion: string;
}): string {
  return [
    "pi-rev",
    String(input.assignmentRevision),
    scopeKey(input.scope),
    input.datasetIdentityHash,
    input.metricSpecVersion,
    input.engineVersion,
  ].join(":");
}
