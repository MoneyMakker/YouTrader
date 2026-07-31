/**
 * Performance Intelligence read contracts — UI / Prop Pass consume only this.
 * No React component imports DB adapters, processor APIs, or metric formulas.
 */

import {
  getCurrentSnapshot,
  type MemoryIntelligenceStore,
} from "./memoryStore";
import {
  processIntelligenceCalculation,
  queueIntelligenceCalculation,
} from "./processor";
import { scopeKey } from "./scope";
import type {
  IntelligenceCalcState,
  IntelligenceScope,
  PerformanceIntelligenceSnapshot,
} from "./types";

export type IntelligenceScopeAvailability = {
  scope: IntelligenceScope;
  scopeKey: string;
  hasCurrent: boolean;
  calc: IntelligenceCalcState;
};

export interface PerformanceIntelligenceReadStore {
  getCurrentSnapshot(
    scope: IntelligenceScope,
  ): Promise<PerformanceIntelligenceSnapshot | null>;
  getSnapshotHistory(
    scope: IntelligenceScope,
  ): Promise<PerformanceIntelligenceSnapshot[]>;
  getAvailableScopes(accountId: string): Promise<IntelligenceScopeAvailability[]>;
  getCalculationState(scope: IntelligenceScope): Promise<IntelligenceCalcState>;
}

export interface PerformanceIntelligenceRequestStore {
  /** Owner-scoped, idempotent calculation request. App cannot write snapshots. */
  requestCalculation(
    scope: IntelligenceScope,
    assignmentRevision: number,
  ): Promise<{ kind: "queued" | "running" | "completed"; scopeKey: string }>;
}

export function createMemoryIntelligenceReadStore(
  store: MemoryIntelligenceStore,
): PerformanceIntelligenceReadStore & PerformanceIntelligenceRequestStore {
  return {
    async getCurrentSnapshot(scope) {
      return getCurrentSnapshot(store, scope);
    },
    async getSnapshotHistory(scope) {
      const sk = scopeKey(scope);
      return store.snapshots
        .filter((s) => scopeKey(s.scope) === sk)
        .slice()
        .sort((a, b) =>
          a.calculatedAt < b.calculatedAt
            ? 1
            : a.calculatedAt > b.calculatedAt
              ? -1
              : a.id < b.id
                ? 1
                : -1,
        );
    },
    async getAvailableScopes(accountId) {
      const scopes: IntelligenceScope[] = [
        { kind: "account", accountId, includeArchivedChallenges: false },
        { kind: "recent_trades", accountId, count: 20 },
        { kind: "recent_trades", accountId, count: 50 },
        { kind: "recent_trades", accountId, count: 100 },
      ];
      const challengeIds = new Set<string>();
      for (const f of store.facts) {
        if (f.accountId === accountId && f.challengeId) {
          challengeIds.add(f.challengeId);
        }
      }
      for (const challengeId of [...challengeIds].sort()) {
        scopes.push({ kind: "challenge", challengeId, accountId });
      }
      return scopes.map((scope) => {
        const sk = scopeKey(scope);
        return {
          scope,
          scopeKey: sk,
          hasCurrent: store.currentByScope.has(sk),
          calc: store.calc.get(sk) ?? { kind: "not_required" },
        };
      });
    },
    async getCalculationState(scope) {
      return store.calc.get(scopeKey(scope)) ?? { kind: "not_required" };
    },
    async requestCalculation(scope, assignmentRevision) {
      return queueIntelligenceCalculation(store, scope, assignmentRevision);
    },
  };
}

/** Trusted-side helper for memory QA — not for App JWT. */
export function runTrustedMemoryCalculation(
  store: MemoryIntelligenceStore,
  scope: IntelligenceScope,
  assignmentRevision: number,
  opts?: { asOfUtc?: string },
) {
  queueIntelligenceCalculation(store, scope, assignmentRevision);
  return processIntelligenceCalculation(store, scope, assignmentRevision, opts);
}
