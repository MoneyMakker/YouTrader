/**
 * Rebuild current projection from immutable snapshots (memory parity).
 */

import type { MemoryIntelligenceStore } from "./memoryStore";
import { scopeKey } from "./scope";
import type { PerformanceIntelligenceSnapshot } from "./types";

const ELIGIBLE = new Set([
  "current",
  "outdated",
  "insufficient_data",
  "incomplete_data",
  "unsupported",
]);

export function rebuildCurrentProjection(
  store: MemoryIntelligenceStore,
): { rebuiltScopes: number } {
  const byScope = new Map<string, PerformanceIntelligenceSnapshot>();
  for (const snap of store.snapshots) {
    if (!ELIGIBLE.has(snap.status)) continue;
    const sk = scopeKey(snap.scope);
    const prev = byScope.get(sk);
    if (!prev) {
      byScope.set(sk, snap);
      continue;
    }
    if (snap.assignmentRevision > prev.assignmentRevision) {
      byScope.set(sk, snap);
      continue;
    }
    if (snap.assignmentRevision < prev.assignmentRevision) continue;
    if (snap.calculatedAt > prev.calculatedAt) {
      byScope.set(sk, snap);
      continue;
    }
    if (snap.calculatedAt === prev.calculatedAt && snap.id > prev.id) {
      byScope.set(sk, snap);
    }
  }
  store.currentByScope.clear();
  for (const [sk, snap] of byScope) {
    store.currentByScope.set(sk, snap.id);
  }
  return { rebuiltScopes: byScope.size };
}

export function projectionParity(
  store: MemoryIntelligenceStore,
): { kind: "parity" | "drift"; liveCount: number; expectedCount: number; mismatches: number } {
  const expected = new Map<string, string>();
  const byScope = new Map<string, PerformanceIntelligenceSnapshot>();
  for (const snap of store.snapshots) {
    if (!ELIGIBLE.has(snap.status)) continue;
    const sk = scopeKey(snap.scope);
    const prev = byScope.get(sk);
    if (
      !prev ||
      snap.assignmentRevision > prev.assignmentRevision ||
      (snap.assignmentRevision === prev.assignmentRevision &&
        snap.calculatedAt > prev.calculatedAt) ||
      (snap.assignmentRevision === prev.assignmentRevision &&
        snap.calculatedAt === prev.calculatedAt &&
        snap.id > prev.id)
    ) {
      byScope.set(sk, snap);
    }
  }
  for (const [sk, snap] of byScope) expected.set(sk, snap.id);

  let mismatches = 0;
  for (const [sk, id] of store.currentByScope) {
    if (expected.get(sk) !== id) mismatches += 1;
  }
  for (const sk of expected.keys()) {
    if (!store.currentByScope.has(sk)) mismatches += 1;
  }
  return {
    kind:
      mismatches === 0 && store.currentByScope.size === expected.size
        ? "parity"
        : "drift",
    liveCount: store.currentByScope.size,
    expectedCount: expected.size,
    mismatches,
  };
}
