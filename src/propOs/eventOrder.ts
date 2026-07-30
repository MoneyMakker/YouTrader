import type { AccountingEvent } from "./types.ts";

/**
 * Canonical event order (Phase 0B condition #1):
 * occurredAt → brokerSequence → stable internal id
 */
export function compareAccountingEvents(a: AccountingEvent, b: AccountingEvent): number {
  const ta = "occurredAtUtc" in a ? a.occurredAtUtc : "";
  const tb = "occurredAtUtc" in b ? b.occurredAtUtc : "";
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  const sa = "brokerSequence" in a && a.brokerSequence != null ? a.brokerSequence : Number.MAX_SAFE_INTEGER;
  const sb = "brokerSequence" in b && b.brokerSequence != null ? b.brokerSequence : Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortAccountingEvents(events: AccountingEvent[]): AccountingEvent[] {
  return [...events].sort(compareAccountingEvents);
}

export function inputRevision(events: AccountingEvent[]): string {
  const sorted = sortAccountingEvents(events);
  return `rev:${sorted.map((e) => e.id).join(",")}`;
}
