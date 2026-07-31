/**
 * Memory publication with failure-injection stages (mirrors SQL transaction).
 *
 * Stages:
 *   queue_claim → snapshot_insert → finding_insert
 *   → current_projection → queue_completion → receipt_completion
 */

import { getCurrentSnapshot, type MemoryIntelligenceStore } from "./memoryStore";
import { scopeKey } from "./scope";
import type {
  DeterministicFinding,
  IntelligenceScope,
  PerformanceIntelligenceSnapshot,
} from "./types";

export type PublicationStage =
  | "queue_claim"
  | "snapshot_insert"
  | "finding_insert"
  | "current_projection"
  | "queue_completion"
  | "receipt_completion";

export type PublicationReceipt = {
  clientRequestId: string;
  commandType: "complete_performance_intelligence";
  resultStatus: "success" | "failed";
  snapshotId?: string;
  reasonCode?: string;
};

export type MemoryPublicationStore = MemoryIntelligenceStore & {
  findingsBySnapshot: Map<string, DeterministicFinding[]>;
  receipts: PublicationReceipt[];
  failAfter: PublicationStage | null;
  logicalIdentity: Map<string, string>;
};

export function attachPublicationState(
  store: MemoryIntelligenceStore,
): MemoryPublicationStore {
  const s = store as MemoryPublicationStore;
  s.findingsBySnapshot ??= new Map();
  s.receipts ??= [];
  s.failAfter ??= null;
  s.logicalIdentity ??= new Map();
  return s;
}

function logicalKey(snap: PerformanceIntelligenceSnapshot): string {
  return [
    snap.userId,
    scopeKey(snap.scope),
    String(snap.assignmentRevision),
    snap.inputRevision,
    snap.metricSpecVersion,
    snap.engineVersion,
  ].join("|");
}

function maybeFail(store: MemoryPublicationStore, stage: PublicationStage) {
  if (store.failAfter === stage) {
    throw new Error(`pi_injected_failure:${stage}`);
  }
}

/**
 * Atomic-style publication. On throw mid-way, no current pointer / completed /
 * success receipt is committed (caller rolls back by not keeping mutated store;
 * for tests, clone store or reset failAfter and clear partial via rollback helper).
 */
export function publishIntelligenceSnapshot(
  store: MemoryPublicationStore,
  scope: IntelligenceScope,
  snap: PerformanceIntelligenceSnapshot,
  clientRequestId: string,
):
  | { kind: "success"; snapshot: PerformanceIntelligenceSnapshot; idempotent?: boolean }
  | { kind: "conflict"; reasonCode: string }
  | { kind: "failed"; reasonCode: string } {
  const sk = scopeKey(scope);
  if (snap.assignmentRevision !== store.assignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_assignment_revision" };
  }

  const lk = logicalKey(snap);
  const existingId = store.logicalIdentity.get(lk);
  if (existingId) {
    const existing = store.snapshots.find((s) => s.id === existingId)!;
    store.currentByScope.set(sk, existing.id);
    store.calc.set(sk, {
      kind: "completed",
      assignmentRevision: snap.assignmentRevision,
      scopeKey: sk,
      snapshotId: existing.id,
    });
    store.receipts.push({
      clientRequestId,
      commandType: "complete_performance_intelligence",
      resultStatus: "success",
      snapshotId: existing.id,
    });
    return { kind: "success", snapshot: existing, idempotent: true };
  }

  const cur = getCurrentSnapshot(store, scope);
  if (
    cur &&
    cur.inputRevision === snap.inputRevision &&
    cur.assignmentRevision === snap.assignmentRevision &&
    cur.metricSpecVersion === snap.metricSpecVersion &&
    cur.engineVersion === snap.engineVersion
  ) {
    store.calc.set(sk, {
      kind: "completed",
      assignmentRevision: snap.assignmentRevision,
      scopeKey: sk,
      snapshotId: cur.id,
    });
    store.receipts.push({
      clientRequestId,
      commandType: "complete_performance_intelligence",
      resultStatus: "success",
      snapshotId: cur.id,
    });
    return { kind: "success", snapshot: cur, idempotent: true };
  }

  try {
    // 1
    store.calc.set(sk, {
      kind: "running",
      assignmentRevision: snap.assignmentRevision,
      scopeKey: sk,
    });
    maybeFail(store, "queue_claim");

    // 2
    store.snapshots.push(snap);
    store.logicalIdentity.set(lk, snap.id);
    maybeFail(store, "snapshot_insert");

    // 3
    store.findingsBySnapshot.set(snap.id, [...snap.findings]);
    maybeFail(store, "finding_insert");

    // 4
    store.currentByScope.set(sk, snap.id);
    maybeFail(store, "current_projection");

    // 5
    store.calc.set(sk, {
      kind: "completed",
      assignmentRevision: snap.assignmentRevision,
      scopeKey: sk,
      snapshotId: snap.id,
    });
    maybeFail(store, "queue_completion");

    // 6
    store.receipts.push({
      clientRequestId,
      commandType: "complete_performance_intelligence",
      resultStatus: "success",
      snapshotId: snap.id,
    });
    maybeFail(store, "receipt_completion");

    return { kind: "success", snapshot: snap };
  } catch (e) {
    const reason =
      e instanceof Error && e.message.startsWith("pi_injected_failure:")
        ? e.message.slice("pi_injected_failure:".length)
        : "publication_failed";
    // Roll back partial current / completed / success receipt for this attempt.
    rollbackPartialPublication(store, sk, snap.id, clientRequestId);
    return { kind: "failed", reasonCode: reason };
  }
}

function rollbackPartialPublication(
  store: MemoryPublicationStore,
  sk: string,
  snapId: string,
  clientRequestId: string,
): void {
  // Remove current if pointing at incomplete snap
  if (store.currentByScope.get(sk) === snapId) {
    store.currentByScope.delete(sk);
  }
  // Incomplete snapshots stay in history but must NEVER be current
  // Remove success receipt for this request
  store.receipts = store.receipts.filter((r) => r.clientRequestId !== clientRequestId);
  // Queue not completed
  const calc = store.calc.get(sk);
  if (calc?.kind === "completed" && calc.snapshotId === snapId) {
    store.calc.set(sk, {
      kind: "failed",
      assignmentRevision: calc.assignmentRevision,
      scopeKey: sk,
      reasonCode: "publication_incomplete",
    });
  } else if (calc?.kind === "running") {
    store.calc.set(sk, {
      kind: "failed",
      assignmentRevision: calc.assignmentRevision,
      scopeKey: sk,
      reasonCode: "publication_incomplete",
    });
  }
  // Keep immutable snap row for diagnostics but clear logical identity so retry can
  // re-bind after successful full publish — remove identity if current never set.
  for (const [k, id] of [...store.logicalIdentity.entries()]) {
    if (id === snapId && store.currentByScope.get(sk) !== snapId) {
      store.logicalIdentity.delete(k);
    }
  }
}
