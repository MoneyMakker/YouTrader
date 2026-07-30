import type {
  AccountingEvent,
  ChallengeLifecycleStatus,
  PropAccountFixture,
  PropChallengeFixture,
  PropRuleSetSnapshot,
} from "../types";
import type {
  AccountEventRow,
  AccountRow,
  ChallengeRow,
  ExecutionRow,
  RuleSnapshotRow,
} from "./types";

export class MappingError extends Error {
  readonly failure = "invalid_input" as const;
  constructor(message: string) {
    super(message);
    this.name = "MappingError";
  }
}

export function mapAccountRow(row: AccountRow): PropAccountFixture {
  if (!row.id || !row.user_id) throw new MappingError("account missing id/user_id");
  const status = row.status as PropAccountFixture["status"];
  if (status !== "active" && status !== "archived" && status !== "closed") {
    throw new MappingError(`unsupported account status: ${row.status}`);
  }
  return {
    id: row.id,
    userId: row.user_id,
    firmKey: row.firm_key ?? "unknown",
    label: row.label,
    accountSizeMinor: row.account_size_minor,
    currency: row.currency,
    timezone: row.firm_timezone,
    status,
  };
}

export function mapRuleSnapshotRow(row: RuleSnapshotRow): PropRuleSetSnapshot {
  const snap = row.snapshot as Partial<PropRuleSetSnapshot>;
  if (!snap || typeof snap !== "object") throw new MappingError("rule snapshot missing");
  if (!snap.version || !snap.drawdown || !snap.firmTimezone || snap.profitTargetMinor == null) {
    throw new MappingError("rule snapshot incomplete");
  }
  if (
    snap.drawdown.kind !== "static" &&
    snap.drawdown.kind !== "trailingEndOfDay" &&
    snap.drawdown.kind !== "trailingIntraday"
  ) {
    throw new MappingError(`unsupported drawdown kind: ${String(snap.drawdown.kind)}`);
  }
  return {
    version: snap.version,
    firmKey: snap.firmKey ?? "unknown",
    currency: snap.currency ?? "USD",
    firmTimezone: snap.firmTimezone,
    tradingDayRolloverHour: snap.tradingDayRolloverHour ?? 0,
    profitTargetMinor: snap.profitTargetMinor,
    dailyLossLimitMinor: snap.dailyLossLimitMinor,
    dailyLossBasis: snap.dailyLossBasis ?? "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: {
      kind: snap.drawdown.kind,
      amountMinor: snap.drawdown.amountMinor,
      stopTrailingAfterTarget: snap.drawdown.stopTrailingAfterTarget,
    },
    minimumTradingDays: snap.minimumTradingDays,
    maxContracts: snap.maxContracts,
    intradayRequiresEquityStream: snap.intradayRequiresEquityStream,
  };
}

export function mapChallengeRow(
  row: ChallengeRow,
  ruleSnapshot: PropRuleSetSnapshot,
): PropChallengeFixture {
  if (!row.id || !row.account_id) throw new MappingError("challenge missing id/account_id");
  const phase = row.phase as PropChallengeFixture["phase"];
  if (phase !== "evaluation" && phase !== "funded") {
    throw new MappingError(`unsupported challenge phase: ${row.phase}`);
  }
  const status = row.status as ChallengeLifecycleStatus;
  const allowed: ChallengeLifecycleStatus[] = [
    "active",
    "at_risk",
    "breached",
    "passed",
    "funded",
    "reset",
    "abandoned",
  ];
  if (!allowed.includes(status)) throw new MappingError(`unsupported challenge status: ${row.status}`);

  return {
    id: row.id,
    accountId: row.account_id,
    phase,
    status,
    ruleSetVersion: row.rule_set_version,
    ruleSetSnapshot: ruleSnapshot,
    startingBalanceMinor: row.starting_balance_minor,
    startedAtUtc: row.started_at,
    endedAtUtc: row.ended_at ?? undefined,
    resetOfChallengeId: row.reset_of_challenge_id ?? undefined,
    breachLocked: row.breach_locked,
  };
}

export function mapExecutionRow(row: ExecutionRow): AccountingEvent {
  return {
    kind: "fill_close",
    id: row.id,
    challengeId: row.challenge_id,
    accountId: row.account_id,
    occurredAtUtc: row.occurred_at,
    brokerSequence: row.broker_sequence ?? undefined,
    realizedPnlMinor: row.realized_pnl_minor ?? undefined,
    feesMinor: row.fees_minor,
    contracts: row.contracts ?? undefined,
    voided: row.voided,
    correctsEventId: row.corrects_event_id ?? undefined,
  };
}

export function mapAccountEventRow(row: AccountEventRow): AccountingEvent {
  const p = row.payload ?? {};
  switch (row.kind) {
    case "equity_mark": {
      if (typeof p.equityMinor !== "number") throw new MappingError(`equity_mark ${row.id} missing equityMinor`);
      return {
        kind: "equity_mark",
        id: row.id,
        challengeId: row.challenge_id,
        occurredAtUtc: row.occurred_at,
        brokerSequence: typeof p.brokerSequence === "number" ? p.brokerSequence : undefined,
        equityMinor: p.equityMinor,
      };
    }
    case "day_boundary": {
      if (typeof p.tradingDayId !== "string") {
        throw new MappingError(`day_boundary ${row.id} missing tradingDayId`);
      }
      return {
        kind: "day_boundary",
        id: row.id,
        challengeId: row.challenge_id,
        occurredAtUtc: row.occurred_at,
        tradingDayId: p.tradingDayId,
      };
    }
    case "challenge_reset":
      return {
        kind: "challenge_reset",
        id: row.id,
        challengeId: row.challenge_id,
        occurredAtUtc: row.occurred_at,
        reason: typeof p.reason === "string" ? p.reason : "reset",
      };
    case "official_correction":
      return {
        kind: "official_correction",
        id: row.id,
        challengeId: row.challenge_id,
        occurredAtUtc: row.occurred_at,
        clearsBreach: Boolean(p.clearsBreach),
        reason: typeof p.reason === "string" ? p.reason : "correction",
      };
    default:
      throw new MappingError(`unsupported account event kind: ${row.kind}`);
  }
}

export function mapDomainEvents(
  executions: ExecutionRow[],
  accountEvents: AccountEventRow[],
): AccountingEvent[] {
  return [
    ...executions.map(mapExecutionRow),
    ...accountEvents.map(mapAccountEventRow),
  ];
}

/** Domain → DB-shaped rows for seeding / round-trip tests. */
export function accountToRow(account: PropAccountFixture, source = "import"): AccountRow {
  return {
    id: account.id,
    user_id: account.userId,
    firm_key: account.firmKey,
    label: account.label,
    account_size_minor: account.accountSizeMinor,
    currency: account.currency,
    firm_timezone: account.timezone,
    status: account.status,
    source,
    schema_version: "prop-os-schema-v0",
  };
}

export function challengeToRow(
  challenge: PropChallengeFixture,
  userId: string,
): ChallengeRow {
  return {
    id: challenge.id,
    user_id: userId,
    account_id: challenge.accountId,
    phase: challenge.phase,
    status: challenge.status,
    rule_set_version: challenge.ruleSetVersion,
    starting_balance_minor: challenge.startingBalanceMinor,
    started_at: challenge.startedAtUtc,
    ended_at: challenge.endedAtUtc ?? null,
    reset_of_challenge_id: challenge.resetOfChallengeId ?? null,
    breach_locked: challenge.breachLocked ?? false,
    schema_version: "prop-os-schema-v0",
  };
}

export function ruleSnapshotToRow(
  challenge: PropChallengeFixture,
  userId: string,
  capturedAt: string,
): RuleSnapshotRow {
  return {
    id: `rule_${challenge.id}`,
    user_id: userId,
    challenge_id: challenge.id,
    rule_set_version: challenge.ruleSetVersion,
    snapshot: challenge.ruleSetSnapshot,
    template_key: null,
    template_version_at_capture: null,
    captured_at: capturedAt,
    schema_version: "prop-os-schema-v0",
  };
}

export function eventToRows(
  event: AccountingEvent,
  userId: string,
): { execution?: ExecutionRow; accountEvent?: AccountEventRow } {
  if (event.kind === "fill_close") {
    return {
      execution: {
        id: event.id,
        user_id: userId,
        challenge_id: event.challengeId,
        account_id: event.accountId,
        trade_client_id: null,
        occurred_at: event.occurredAtUtc,
        broker_sequence: event.brokerSequence ?? null,
        realized_pnl_minor: event.realizedPnlMinor ?? null,
        fees_minor: event.feesMinor ?? null,
        contracts: event.contracts ?? null,
        voided: event.voided ?? false,
        corrects_event_id: event.correctsEventId ?? null,
        source: "shadow_fixture",
        schema_version: "prop-os-schema-v0",
      },
    };
  }
  const payload: Record<string, unknown> = {};
  if (event.kind === "equity_mark") {
    payload.equityMinor = event.equityMinor;
    if (event.brokerSequence != null) payload.brokerSequence = event.brokerSequence;
  } else if (event.kind === "day_boundary") {
    payload.tradingDayId = event.tradingDayId;
  } else if (event.kind === "challenge_reset") {
    payload.reason = event.reason;
  } else if (event.kind === "official_correction") {
    payload.clearsBreach = event.clearsBreach;
    payload.reason = event.reason;
  }
  return {
    accountEvent: {
      id: event.id,
      user_id: userId,
      challenge_id: event.challengeId,
      kind: event.kind,
      occurred_at: event.occurredAtUtc,
      payload,
      schema_version: "prop-os-schema-v0",
    },
  };
}
