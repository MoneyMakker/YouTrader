/**
 * Performance Intelligence calculation engine (pi-engine-v0).
 * Pure domain: no React / Supabase / AI.
 */

import { canonicalSnapshotBytes } from "./canonical";
import {
  buildDatasetIdentityHash,
  buildInputRevisionV1,
} from "./datasetIdentity";
import { evaluateFindings } from "./findings";
import {
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  calculateSequenceMetrics,
} from "./metrics";
import {
  normalizePerformanceTrades,
  orderPerformanceTrades,
  takeRecentTrades,
} from "./normalize";
import { scopeAccountId, scopeKey } from "./scope";
import { calculateSegments } from "./segments";
import type {
  IntelligenceDataQuality,
  IntelligenceScope,
  PerformanceIntelligenceSnapshot,
  RawJournalTradeFact,
} from "./types";
import {
  PI_ENGINE_VERSION,
  PI_MAX_TRADES_PER_SCOPE,
  PI_METRIC_SPEC_VERSION,
  PI_MIN_SEGMENT_SAMPLE,
  PI_SCHEMA_VERSION,
} from "./types";
import { createHash } from "./hash";

function newId(): string {
  return `pi_${Date.now().toString(16)}_${createHash(String(Math.random())).slice(0, 10)}`;
}

export function filterFactsForScope(
  facts: RawJournalTradeFact[],
  scope: IntelligenceScope,
): RawJournalTradeFact[] {
  switch (scope.kind) {
    case "challenge":
      return facts.filter(
        (f) =>
          f.challengeId === scope.challengeId &&
          (f.accountId == null || f.accountId === scope.accountId),
      );
    case "account":
      return facts.filter((f) => {
        if (f.accountId !== scope.accountId) return false;
        if (!scope.includeArchivedChallenges && f.challengeArchived) {
          return false;
        }
        return true;
      });
    case "recent_trades":
      return facts.filter((f) => f.accountId === scope.accountId);
    case "date_range":
      return facts.filter((f) => {
        if (f.accountId !== scope.accountId) return false;
        const at = f.occurredAtUtc ?? f.exitTime ?? f.entryTime;
        if (!at) return false;
        return at >= scope.startUtc && at < scope.endUtc;
      });
    default:
      return [];
  }
}

export function calculatePerformanceIntelligence(input: {
  userId: string;
  scope: IntelligenceScope;
  assignmentRevision: number;
  facts: RawJournalTradeFact[];
  asOfUtc?: string;
}): PerformanceIntelligenceSnapshot {
  const calculatedAt = input.asOfUtc ?? new Date().toISOString();
  const scoped = filterFactsForScope(input.facts, input.scope);
  const normalized = normalizePerformanceTrades(scoped);

  if (normalized.included.length > PI_MAX_TRADES_PER_SCOPE) {
    return {
      id: newId(),
      userId: input.userId,
      accountId: scopeAccountId(input.scope),
      challengeId:
        input.scope.kind === "challenge" ? input.scope.challengeId : undefined,
      assignmentRevision: input.assignmentRevision,
      inputRevision: `pi-unsupported:${scopeKey(input.scope)}`,
      metricSpecVersion: PI_METRIC_SPEC_VERSION,
      engineVersion: PI_ENGINE_VERSION,
      scope: input.scope,
      status: "unsupported",
      datasetSummary: {
        tradeCount: normalized.included.length,
        closedCount: normalized.included.length,
        excludedCount: normalized.excluded.length,
        exclusionReasons: {
          ...normalized.exclusionReasons,
          scope_limit_exceeded: 1,
        },
        dataQuality: {
          kind: "unsupported",
          reasonCode: "max_trades_exceeded",
        },
        identityHash: createHash("unsupported"),
        findingsGenerated: 0,
        findingsSuppressed: 0,
        segmentsSuppressed: 0,
      },
      performance: emptyPerformance(),
      risk: emptyRisk(),
      sequences: emptySequences(),
      segments: [],
      findings: [],
      calculatedAt,
      sourceRange: { earliestTradeAt: null, latestTradeAt: null },
      schemaVersion: PI_SCHEMA_VERSION,
    };
  }

  let trades = orderPerformanceTrades(normalized.included);
  if (input.scope.kind === "recent_trades") {
    trades = takeRecentTrades(trades, input.scope.count);
  }

  const identityHash = buildDatasetIdentityHash({
    scope: input.scope,
    assignmentRevision: input.assignmentRevision,
    trades,
    metricSpecVersion: PI_METRIC_SPEC_VERSION,
    engineVersion: PI_ENGINE_VERSION,
  });
  const inputRevision = buildInputRevisionV1({
    assignmentRevision: input.assignmentRevision,
    scope: input.scope,
    datasetIdentityHash: identityHash,
    metricSpecVersion: PI_METRIC_SPEC_VERSION,
    engineVersion: PI_ENGINE_VERSION,
  });

  const performance = calculatePerformanceMetrics(trades);
  const risk = calculateRiskMetrics(trades);
  const sequences = calculateSequenceMetrics(trades);
  const segmentResult = calculateSegments(trades);
  const findingsResult = evaluateFindings({
    trades,
    performance,
    risk,
    sequences,
    segments: segmentResult.segments,
  });

  let status: PerformanceIntelligenceSnapshot["status"] = "current";
  let dq: IntelligenceDataQuality = normalized.excluded.length
    ? {
        kind: "partial",
        missingFields: Object.keys(normalized.exclusionReasons),
      }
    : { kind: "complete" };

  if (trades.length === 0) {
    status = "insufficient_data";
    dq = {
      kind: "insufficient_sample",
      required: PI_MIN_SEGMENT_SAMPLE,
      actual: 0,
    };
  } else if (trades.length < PI_MIN_SEGMENT_SAMPLE) {
    status = "insufficient_data";
    dq = {
      kind: "insufficient_sample",
      required: PI_MIN_SEGMENT_SAMPLE,
      actual: trades.length,
    };
  } else if (risk.dataQuality.kind === "partial") {
    status = "incomplete_data";
  }

  const times = trades.map((t) => t.occurredAtUtc).sort();
  return {
    id: newId(),
    userId: input.userId,
    accountId: scopeAccountId(input.scope),
    challengeId:
      input.scope.kind === "challenge" ? input.scope.challengeId : undefined,
    assignmentRevision: input.assignmentRevision,
    inputRevision,
    metricSpecVersion: PI_METRIC_SPEC_VERSION,
    engineVersion: PI_ENGINE_VERSION,
    scope: input.scope,
    status,
    datasetSummary: {
      tradeCount: trades.length,
      closedCount: trades.length,
      excludedCount: normalized.excluded.length,
      exclusionReasons: normalized.exclusionReasons,
      dataQuality: dq,
      identityHash,
      findingsGenerated: findingsResult.generated,
      findingsSuppressed: findingsResult.suppressed,
      segmentsSuppressed: segmentResult.suppressed,
    },
    performance,
    risk,
    sequences,
    segments: segmentResult.segments,
    findings: findingsResult.surfaced,
    calculatedAt,
    sourceRange: {
      earliestTradeAt: times[0] ?? null,
      latestTradeAt: times[times.length - 1] ?? null,
    },
    schemaVersion: PI_SCHEMA_VERSION,
  };
}

/** Byte-stable core for deterministic equality (excludes id/calculatedAt). */
export function intelligenceSnapshotCoreBytes(
  snap: PerformanceIntelligenceSnapshot,
): string {
  return canonicalSnapshotBytes(snap);
}

function emptyPerformance() {
  return calculatePerformanceMetrics([]);
}
function emptyRisk() {
  return calculateRiskMetrics([]);
}
function emptySequences() {
  return calculateSequenceMetrics([]);
}
