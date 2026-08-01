/**
 * Staging-only QA apply-trade-edit request contract.
 * Pure helpers — Node-testable. Production gates return null / no-op.
 *
 * The React state owner in YouTraderApp MUST keep the exact identifier
 * `qaApplyEditRequest` (see stagingQaApplyEditRequest.selftest.ts).
 */

import {
  isStagingQaJournalSeedAllowed,
  parseStagingQaApplyTradeEditUrl,
  parseStagingQaTradeOverrides,
} from "./stagingQaJournalSeed";

export const QA_APPLY_EDIT_REQUEST_STATE_KEY = "qaApplyEditRequest" as const;

export type StagingQaApplyEditRequest = {
  url: string;
  nonce: number;
};

/** Shape required on the App state owner (YouTraderApp). */
export type YouTraderAppQaApplyEditState = {
  [QA_APPLY_EDIT_REQUEST_STATE_KEY]: StagingQaApplyEditRequest | null;
};

export function createStagingQaApplyEditRequest(
  url: string,
  nonce = Date.now(),
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): StagingQaApplyEditRequest | null {
  if (!isStagingQaJournalSeedAllowed(env)) return null;
  if (!parseStagingQaApplyTradeEditUrl(url)) return null;
  return { url, nonce };
}

/** Consume / clear — always returns null (request is single-shot). */
export function consumeStagingQaApplyEditRequest(
  _request: StagingQaApplyEditRequest | null,
): null {
  return null;
}

export function clearStagingQaApplyEditRequest(): null {
  return null;
}

export type ApplyEditTradeLike = {
  id: string;
  notes?: string | null;
  pnl: number;
  entry?: number | null;
  exit?: number | null;
  contracts?: number | null;
};

/** Resolve which in-memory trade an apply-edit URL targets. */
export function resolveTradeForApplyEditRequest(
  url: string,
  trades: ApplyEditTradeLike[],
): ApplyEditTradeLike | null {
  if (!parseStagingQaApplyTradeEditUrl(url)) return null;
  const overrides = parseStagingQaTradeOverrides(url);
  const marker = overrides.marker || "";
  const notesHint = overrides.notes || "";
  return (
    trades.find((tr) => marker && (tr.notes || "").includes(marker)) ||
    trades.find(
      (tr) =>
        notesHint && (tr.notes || "").includes(notesHint.replace(/-EDITED$/, "")),
    ) ||
    trades.find((tr) => notesHint && (tr.notes || "") === notesHint) ||
    trades.find((tr) => String(tr.id || "").startsWith("qa-seed-")) ||
    null
  );
}

export function stagingQaApplyEditAllowedInEnv(
  env: Record<string, string | undefined>,
): boolean {
  return isStagingQaJournalSeedAllowed(env);
}
