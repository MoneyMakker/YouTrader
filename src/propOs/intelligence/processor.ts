/**
 * Trusted PI processor — App must not write snapshots or mark current.
 */

import { calculatePerformanceIntelligence } from "./engine";
import {
  getCurrentSnapshot,
  type MemoryIntelligenceStore,
} from "./memoryStore";
import {
  attachPublicationState,
  publishIntelligenceSnapshot,
} from "./publication";
import { scopeAccountId, scopeKey } from "./scope";
import type { IntelligenceScope, PerformanceIntelligenceSnapshot } from "./types";

export const TRUSTED_PI_PROCESSOR_ROLES = [
  "postgres",
  "service_role",
  "prop_os_performance_intelligence_processor",
] as const;

/** Assignment/challenge recalc processor — must NOT appear here. */
export const ASSIGNMENT_RECALC_PROCESSOR_ROLE = "prop_os_recalc_processor" as const;

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
 * Publishes via atomic publication stages.
 */
export function processIntelligenceCalculation(
  store: MemoryIntelligenceStore,
  scope: IntelligenceScope,
  claimedAssignmentRevision: number,
  opts?: { asOfUtc?: string; clientRequestId?: string },
):
  | { kind: "success"; snapshot: PerformanceIntelligenceSnapshot }
  | { kind: "conflict"; reasonCode: string }
  | { kind: "failed"; reasonCode: string } {
  const sk = scopeKey(scope);
  if (claimedAssignmentRevision !== store.assignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_assignment_revision" };
  }
  const job = store.calc.get(sk);
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

    if (claimedAssignmentRevision !== store.assignmentRevision) {
      return { kind: "conflict", reasonCode: "stale_assignment_revision" };
    }

    const pubStore = attachPublicationState(store);
    const pub = publishIntelligenceSnapshot(
      pubStore,
      scope,
      snap,
      opts?.clientRequestId ?? `pi-mem-${snap.inputRevision.slice(0, 24)}`,
    );
    if (pub.kind === "success") return { kind: "success", snapshot: pub.snapshot };
    if (pub.kind === "conflict") return pub;
    return pub;
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
  store.calc.set(sk, {
    kind: "failed",
    assignmentRevision: claimedAssignmentRevision,
    scopeKey: sk,
    reasonCode,
  });
  return { kind: "success" };
}

export function assertTrustedPiProcessorRole(role: string): boolean {
  return (TRUSTED_PI_PROCESSOR_ROLES as readonly string[]).includes(role);
}
