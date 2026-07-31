/**
 * Stable trade identity for Prop OS assignment.
 * Never rely on display triples (symbol + date + pnl) alone.
 * Canonical PK = journalTradeId; tradeClientId is provenance alias only.
 */

import type { AssignableTradeFact, PropOsTradeIdentity } from "./types";
export { PROP_OS_JOURNAL_TRADE_IDENTITY } from "./identityContract";

export function buildTradeIdentity(input: {
  userId: string;
  tradeClientId: string;
  journalTradeId?: string | null;
  providerSource?: string | null;
  externalTradeId?: string | null;
  deletedAt?: string | null;
}): PropOsTradeIdentity {
  return {
    journalTradeId: input.journalTradeId ?? null,
    tradeClientId: String(input.tradeClientId ?? "").trim(),
    userId: input.userId,
    providerSource: input.providerSource ?? null,
    externalTradeId: input.externalTradeId ?? null,
    deletedAt: input.deletedAt ?? null,
  };
}

export function isStableTradeIdentity(id: PropOsTradeIdentity): boolean {
  return Boolean(
    id.userId &&
      id.tradeClientId &&
      id.tradeClientId.length >= 1 &&
      !id.deletedAt,
  );
}

/** Has resolved canonical journal PK (required before durable assignment). */
export function hasCanonicalJournalIdentity(id: PropOsTradeIdentity): boolean {
  return isStableTradeIdentity(id) && Boolean(id.journalTradeId);
}

/** Duplicate key within an owner scope (identity collision). */
export function tradeIdentityKey(id: PropOsTradeIdentity): string {
  if (id.journalTradeId) {
    return `${id.userId}:jid:${id.journalTradeId}`;
  }
  const ext = id.externalTradeId ? `:ext:${id.externalTradeId}` : "";
  const src = id.providerSource ? `:src:${id.providerSource}` : "";
  return `${id.userId}:cid:${id.tradeClientId}${src}${ext}`;
}

export function detectDuplicateIdentities(
  trades: AssignableTradeFact[],
): string[] {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const t of trades) {
    const key = tradeIdentityKey(t.identity);
    const prev = seen.get(key);
    if (prev && prev !== t.identity.tradeClientId) {
      dupes.push(t.identity.tradeClientId);
    }
    seen.set(key, t.identity.tradeClientId);
  }
  return dupes;
}
