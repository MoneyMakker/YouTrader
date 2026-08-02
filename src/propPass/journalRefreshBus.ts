export type PropPassJournalMutation = Readonly<{
  tradeClientId: string;
  kind: "created" | "updated" | "deleted";
  occurredAt: string;
}>;

type Listener = (mutation: PropPassJournalMutation) => void;
const listeners = new Set<Listener>();

/** App-local invalidation only; durable exactly-once processing lives in Postgres. */
export function publishPropPassJournalMutation(mutation: PropPassJournalMutation): void {
  if (!mutation.tradeClientId || Number.isNaN(Date.parse(mutation.occurredAt))) return;
  for (const listener of [...listeners]) listener(mutation);
}

export function subscribeToPropPassJournalMutations(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
