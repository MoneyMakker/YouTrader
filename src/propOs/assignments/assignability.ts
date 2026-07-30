/**
 * Assignability rules — no guessing missing P&L or timestamps.
 */

import type {
  AssignabilityRejectReason,
  AssignableTradeFact,
  PropTradeAssignmentEvent,
} from "./types";
import { isStableTradeIdentity } from "./identity";

export type ChallengeAssignContext = {
  accountId: string;
  challengeId: string;
  accountStatus: string;
  challengeStatus: string;
  startedAt: string;
  endedAt: string | null;
};

const ACCEPTING = new Set(["active", "at_risk"]);

export function evaluateAssignability(input: {
  userId: string;
  trade: AssignableTradeFact;
  current: PropTradeAssignmentEvent | null;
  challenge: ChallengeAssignContext;
  allowReassignment?: boolean;
}): { ok: boolean; reason: AssignabilityRejectReason | null } {
  const { userId, trade, current, challenge, allowReassignment } = input;

  if (trade.identity.userId !== userId) {
    return { ok: false, reason: "not_owner" };
  }
  if (!isStableTradeIdentity(trade.identity)) {
    return { ok: false, reason: "missing_identity" };
  }
  if (trade.identity.deletedAt) {
    return { ok: false, reason: "deleted_or_hidden" };
  }
  if (challenge.accountStatus === "archived" || challenge.accountStatus === "closed") {
    return { ok: false, reason: "account_archived" };
  }
  if (!ACCEPTING.has(challenge.challengeStatus)) {
    return { ok: false, reason: "challenge_not_accepting" };
  }
  if (trade.open) {
    return { ok: false, reason: "open_trade_unsupported" };
  }
  if (trade.pnlMajor == null || Number.isNaN(trade.pnlMajor)) {
    return { ok: false, reason: "missing_pnl" };
  }
  if (!trade.occurredAtUtc) {
    return { ok: false, reason: "missing_timestamp" };
  }
  const ts = Date.parse(trade.occurredAtUtc);
  if (Number.isNaN(ts)) {
    return { ok: false, reason: "malformed_timestamp" };
  }
  const start = Date.parse(challenge.startedAt);
  if (!Number.isNaN(start) && ts < start) {
    return { ok: false, reason: "outside_challenge_window" };
  }
  if (challenge.endedAt) {
    const end = Date.parse(challenge.endedAt);
    if (!Number.isNaN(end) && ts > end) {
      return { ok: false, reason: "outside_challenge_window" };
    }
  }

  if (
    current?.state === "assigned" &&
    current.challengeId &&
    current.challengeId !== challenge.challengeId
  ) {
    if (!allowReassignment) {
      return { ok: false, reason: "already_assigned_other_challenge" };
    }
  }

  // Same challenge already assigned → idempotent success path (ok)
  return { ok: true, reason: null };
}

export function resolveOccurredAtUtc(input: {
  exitTime?: string | null;
  entryTime?: string | null;
  tradeDate?: string | null;
}): string | null {
  const candidates = [input.exitTime, input.entryTime, input.tradeDate];
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}
