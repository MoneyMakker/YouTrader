import { sortAccountingEvents } from "../eventOrder";
import type { AccountingEvent, PropAccountFixture, PropChallengeFixture, PropRuleSetSnapshot } from "../types";
import { fingerprint, stableStringify } from "./stable";

/**
 * Shadow pipeline input revision.
 * Depends on ordered events + rule snapshot + challenge config + engine-relevant account fields.
 * Independent of wall clock, JSON key order, DB retrieval order, UI, AI.
 */
export function buildShadowInputRevision(input: {
  challenge: Pick<
    PropChallengeFixture,
    | "id"
    | "accountId"
    | "phase"
    | "status"
    | "ruleSetVersion"
    | "startingBalanceMinor"
    | "startedAtUtc"
    | "endedAtUtc"
    | "resetOfChallengeId"
    | "breachLocked"
    | "breachReasons"
  >;
  ruleSnapshot: PropRuleSetSnapshot;
  account: Pick<
    PropAccountFixture,
    "id" | "userId" | "firmKey" | "accountSizeMinor" | "currency" | "timezone" | "status"
  >;
  events: AccountingEvent[];
}): string {
  const ordered = sortAccountingEvents(input.events).map((e) => canonicalizeEvent(e));
  const payload = {
    account: {
      id: input.account.id,
      userId: input.account.userId,
      firmKey: input.account.firmKey,
      accountSizeMinor: input.account.accountSizeMinor,
      currency: input.account.currency,
      timezone: input.account.timezone,
      status: input.account.status,
    },
    challenge: {
      id: input.challenge.id,
      accountId: input.challenge.accountId,
      phase: input.challenge.phase,
      status: input.challenge.status,
      ruleSetVersion: input.challenge.ruleSetVersion,
      startingBalanceMinor: input.challenge.startingBalanceMinor,
      startedAtUtc: input.challenge.startedAtUtc,
      endedAtUtc: input.challenge.endedAtUtc ?? null,
      resetOfChallengeId: input.challenge.resetOfChallengeId ?? null,
      breachLocked: input.challenge.breachLocked ?? false,
      breachReasons: input.challenge.breachReasons ?? [],
    },
    ruleSnapshot: input.ruleSnapshot,
    events: ordered,
  };
  return `shadow-rev:${fingerprint(stableStringify(payload))}`;
}

function canonicalizeEvent(e: AccountingEvent): Record<string, unknown> {
  switch (e.kind) {
    case "fill_close":
      return {
        kind: e.kind,
        id: e.id,
        challengeId: e.challengeId,
        accountId: e.accountId,
        occurredAtUtc: e.occurredAtUtc,
        brokerSequence: e.brokerSequence ?? null,
        realizedPnlMinor: e.realizedPnlMinor ?? null,
        feesMinor: e.feesMinor ?? null,
        contracts: e.contracts ?? null,
        voided: e.voided ?? false,
        correctsEventId: e.correctsEventId ?? null,
      };
    case "equity_mark":
      return {
        kind: e.kind,
        id: e.id,
        challengeId: e.challengeId,
        occurredAtUtc: e.occurredAtUtc,
        brokerSequence: e.brokerSequence ?? null,
        equityMinor: e.equityMinor,
      };
    case "day_boundary":
      return {
        kind: e.kind,
        id: e.id,
        challengeId: e.challengeId,
        occurredAtUtc: e.occurredAtUtc,
        tradingDayId: e.tradingDayId,
      };
    case "challenge_reset":
      return {
        kind: e.kind,
        id: e.id,
        challengeId: e.challengeId,
        occurredAtUtc: e.occurredAtUtc,
        reason: e.reason,
      };
    case "official_correction":
      return {
        kind: e.kind,
        id: e.id,
        challengeId: e.challengeId,
        occurredAtUtc: e.occurredAtUtc,
        clearsBreach: e.clearsBreach,
        reason: e.reason,
      };
  }
}
