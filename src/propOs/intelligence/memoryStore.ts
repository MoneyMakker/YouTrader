/**
 * In-memory PI store for domain QA (no DB).
 */

import type {
  IntelligenceCalcState,
  IntelligenceScope,
  PerformanceIntelligenceSnapshot,
  RawJournalTradeFact,
} from "./types";
import { scopeKey } from "./scope";

export type MemoryIntelligenceStore = {
  facts: RawJournalTradeFact[];
  snapshots: PerformanceIntelligenceSnapshot[];
  currentByScope: Map<string, string>;
  calc: Map<string, IntelligenceCalcState>;
  assignmentRevision: number;
  accounts: Map<string, { userId: string; archived: boolean }>;
};

export function createMemoryIntelligenceStore(): MemoryIntelligenceStore {
  return {
    facts: [],
    snapshots: [],
    currentByScope: new Map(),
    calc: new Map(),
    assignmentRevision: 0,
    accounts: new Map(),
  };
}

export function markScopesOutdatedForAssignment(
  store: MemoryIntelligenceStore,
  nextRevision: number,
): void {
  store.assignmentRevision = nextRevision;
  for (const [sk, snapId] of store.currentByScope) {
    const snap = store.snapshots.find((s) => s.id === snapId);
    if (snap && snap.assignmentRevision < nextRevision) {
      snap.status = "outdated";
      store.calc.set(sk, {
        kind: "queued",
        assignmentRevision: nextRevision,
        scopeKey: sk,
      });
    }
  }
}

export function getCurrentSnapshot(
  store: MemoryIntelligenceStore,
  scope: IntelligenceScope,
): PerformanceIntelligenceSnapshot | null {
  const sk = scopeKey(scope);
  const id = store.currentByScope.get(sk);
  if (!id) return null;
  return store.snapshots.find((s) => s.id === id) ?? null;
}
