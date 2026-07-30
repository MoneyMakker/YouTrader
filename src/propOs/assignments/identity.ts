/**
 * Stable trade identity for Prop OS assignment.
 * Never rely on display triples (symbol + date + pnl) alone.
 */

import type { AssignableTradeFact, PropOsTradeIdentity } from "./types";

export function buildTradeIdentity(input: {
  userId: string;
  tradeClientId: string;
  providerSource?: string | null;
  externalTradeId?: string | null;
  deletedAt?: string | null;
}): PropOsTradeIdentity {
  return {
    tradeClientId: String(input.tradeClientId ?? "").trim(),
    userId: input.userId,
    providerSource: input.providerSource ?? null,
    externalTradeId: input.externalTradeId ?? null,
    deletedAt: input.deletedAt ?? null,
  };
}

export function isStableTradeIdentity(id: PropOsTradeIdentity): boolean {
  return Boolean(id.userId && id.tradeClientId && id.tradeClientId.length >= 1);
}

/** Duplicate key within an owner scope (identity collision). */
export function tradeIdentityKey(id: PropOsTradeIdentity): string {
  const ext = id.externalTradeId ? `:ext:${id.externalTradeId}` : "";
  const src = id.providerSource ? `:src:${id.providerSource}` : "";
  return `${id.userId}:${id.tradeClientId}${src}${ext}`;
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
