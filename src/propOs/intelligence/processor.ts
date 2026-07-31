/**
 * Trusted PI processor — App must not write snapshots or mark current.
 */

import { calculatePerformanceIntelligence } from "./engine";
import {
  getCurrentSnapshot,
  type MemoryIntelligenceStore,
} from "./memoryStore";
import { scopeAccountId, scopeKey } from "./scope";
import type { IntelligenceScope, PerformanceIntelligenceSnapshot } from "./types";

export const TRUSTED_PI_PROCESSOR_ROLES = [
  "postgres",
  "service_role",
  "prop_os_recalc_processor",
] as const;

export function queueIntelligenceCalculation(
  store: MemoryIntelligenceStore,
  scope: IntelligenceScope,
  assignmentRevision: number,
): { kind: "queued" | "running" | "completed"; scopeKey: string } {
  const sk = scopeKey(scope);
  const existing = store.calc.get(sk);
  if (
    existing?.kind === "completed" &&
    existing.assignmentRevision === assignmentRevision
  ) {
    return { kind: "completed", scopeKey: sk };
  }
  if (existing?.kind === "running" && existing.assignmentRevision === assignmentRevision) {
    return { kind: "running", scopeKey: sk };
  }
  store.calc.set(sk, {
    kind: "queued",
    assignmentRevision,
    scopeKey: sk,
  });
  return { kind: "queued", scopeKey: sk };
}

/**
 * Process queued calculation. Rejects stale assignment revisions.
 */
export function processIntelligenceCalculation(
  store: MemoryIntelligenceStore,
  scope: IntelligenceScope,
  claimedAssignmentRevision: number,
  opts?: { asOfUtc?: string },
):
  | { kind: "success"; snapshot: PerformanceIntelligenceSnapshot }
  | { kind: "conflict"; reasonCode: string }
  | { kind: "failed"; reasonCode: string } {
  const sk = scopeKey(scope);
  if (claimedAssignmentRevision !== store.assignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_assignment_revision" };
  }
  const job = store.calc.get(sk);
  if (!job || (job.kind !== "queued" && job.kind !== "running" && job.kind !== "failed")) {
    // allow direct process if queued missing but revision matches
  }
  if (job && job.kind !== "not_required" && job.assignmentRevision > claimedAssignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_assignment_revision" };
  }

  store.calc.set(sk, {
    kind: "running",
    assignmentRevision: claimedAssignmentRevision,
    scopeKey: sk,
  });

  try {
    const accountId = scopeAccountId(scope);
    const account = store.accounts.get(accountId);
    if (account?.archived) {
      store.calc.set(sk, {
        kind: "failed",
        assignmentRevision: claimedAssignmentRevision,
        scopeKey: sk,
        reasonCode: "account_archived",
      });
      return { kind: "failed", reasonCode: "account_archived" };
    }

    const snap = calculatePerformanceIntelligence({
      userId: account?.userId ?? "unknown",
      scope,
      assignmentRevision: claimedAssignmentRevision,
      facts: store.facts,
      asOfUtc: opts?.asOfUtc,
    });

    // Stale check after compute
    if (claimedAssignmentRevision !== store.assignmentRevision) {
      return { kind: "conflict", reasonCode: "stale_assignment_revision" };
    }

    // Idempotent: same inputRevision already current
    const cur = getCurrentSnapshot(store, scope);
    if (cur && cur.inputRevision === snap.inputRevision && cur.assignmentRevision === snap.assignmentRevision) {
      store.calc.set(sk, {
        kind: "completed",
        assignmentRevision: claimedAssignmentRevision,
        scopeKey: sk,
        snapshotId: cur.id,
      });
      return { kind: "success", snapshot: cur };
    }

    if (snap.status === "current" || snap.status === "insufficient_data" || snap.status === "incomplete_data") {
      // keep status from engine; mark current pointer
    }
    store.snapshots.push(snap);
    store.currentByScope.set(sk, snap.id);
    store.calc.set(sk, {
      kind: "completed",
      assignmentRevision: claimedAssignmentRevision,
      scopeKey: sk,
      snapshotId: snap.id,
    });
    return { kind: "success", snapshot: snap };
  } catch {
    store.calc.set(sk, {
      kind: "failed",
      assignmentRevision: claimedAssignmentRevision,
      scopeKey: sk,
      reasonCode: "engine_failure",
    });
    return { kind: "failed", reasonCode: "engine_failure" };
  }
}

export function failIntelligenceCalculation(
  store: MemoryIntelligenceStore,
  scope: IntelligenceScope,
  claimedAssignmentRevision: number,
  reasonCode: string,
): { kind: "success" } | { kind: "conflict"; reasonCode: string } {
  if (claimedAssignmentRevision !== store.assignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_assignment_revision" };
  }
  const sk = scopeKey(scope);
  // Do not promote any snapshot
  store.calc.set(sk, {
    kind: "failed",
    assignmentRevision: claimedAssignmentRevision,
    scopeKey: sk,
    reasonCode,
  });
  return { kind: "success" };
}
