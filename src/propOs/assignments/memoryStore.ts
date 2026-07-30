/**
 * In-memory assignment event store for Phase 2C QA.
 */

import type {
  AssignableTradeFact,
  PropOsRecalculationState,
  PropTradeAssignmentEvent,
} from "./types";

export type MemoryAssignmentStore = {
  events: PropTradeAssignmentEvent[];
  trades: AssignableTradeFact[];
  revisions: Map<string, number>;
  recalc: Map<string, PropOsRecalculationState>;
  /** challengeId → snapshotRevision completed for assignmentRevision */
  completedSnapshots: Map<string, { assignmentRevision: number; snapshotRevision: number }>;
  accounts: Map<string, { userId: string; status: string }>;
  challenges: Map<
    string,
    {
      userId: string;
      accountId: string;
      status: string;
      startedAt: string;
      endedAt: string | null;
    }
  >;
};

export function createMemoryAssignmentStore(): MemoryAssignmentStore {
  return {
    events: [],
    trades: [],
    revisions: new Map(),
    recalc: new Map(),
    completedSnapshots: new Map(),
    accounts: new Map(),
    challenges: new Map(),
  };
}

export function currentAssignmentForTrade(
  store: MemoryAssignmentStore,
  userId: string,
  tradeClientId: string,
): PropTradeAssignmentEvent | null {
  const rows = store.events
    .filter((e) => e.userId === userId && e.tradeClientId === tradeClientId)
    .sort((a, b) => a.assignmentRevision - b.assignmentRevision || a.createdAt.localeCompare(b.createdAt));
  for (let i = rows.length - 1; i >= 0; i--) {
    const e = rows[i]!;
    if (e.state === "assigned") return e;
    if (e.state === "removed") return null;
  }
  return null;
}

export function bumpRevision(store: MemoryAssignmentStore, userId: string): number {
  const next = (store.revisions.get(userId) ?? 0) + 1;
  store.revisions.set(userId, next);
  return next;
}
