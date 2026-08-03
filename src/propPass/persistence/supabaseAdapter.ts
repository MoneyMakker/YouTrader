import { hashPropOsCommandPayload } from "../../propOs/commands/hash";
import { PROP_PASS_CALCULATION_VERSION, type ChallengeTimelineEvent, type InstrumentSpecificationVersion } from "../tradingOs/index";
import {
  PropPassPersistenceError,
  type CompleteJournalEvent,
  type JournalEventClaim,
  type JournalPersistenceEvent,
  type PersistedDailyPlan,
  type PersistedDecisionReplay,
  type PersistedInterventionEvent,
  type PersistedInterventionOverride,
  type PersistedPreTradeAssessment,
  type PersistedRuntimeState,
  type PersistedTimelineEvent,
  type PersistenceVersions,
  type PropPassPersistenceAdapter,
} from "./contracts";

type DbResult = { data: unknown; error: { message: string; code?: string } | null };
type Query = PromiseLike<DbResult> & {
  eq(column: string, value: string): Query;
  order(column: string, options?: { ascending?: boolean }): Query;
};
type Table = {
  select(columns: string): Query;
  insert(row: Record<string, unknown>): PromiseLike<DbResult>;
  upsert(row: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<DbResult>;
};
export type PropPassPersistenceSupabaseClient = {
  from(table: string): Table;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult>;
};

/** Client construction is read-only unless a trusted server processor opts in. */
export function createSupabasePropPassPersistenceAdapter(input: {
  client: PropPassPersistenceSupabaseClient;
  authenticatedUserId: string;
  trustedProcessorMutations?: boolean;
}): PropPassPersistenceAdapter {
  const { client, authenticatedUserId: userId } = input;
  requireText(userId, "authenticated user");

  async function select(table: string, filters: Record<string, string>, orderBy?: string): Promise<Record<string, unknown>[]> {
    let query = client.from(table).select("*");
    for (const [column, value] of Object.entries({ user_id: userId, ...filters })) query = query.eq(column, value);
    if (orderBy) query = query.order(orderBy, { ascending: false });
    const result = await query;
    if (result.error) throw repositoryError(result.error);
    if (!Array.isArray(result.data)) throw new PropPassPersistenceError("invalid_row", `${table}: rows expected`);
    return result.data.map((row) => ownedRow(row, userId, table));
  }

  async function insert(table: string, row: Record<string, unknown>): Promise<void> {
    requireTrustedMutation(input.trustedProcessorMutations);
    const result = await client.from(table).insert({ ...row, user_id: userId });
    if (result.error) throw repositoryError(result.error);
  }

  async function upsert(table: string, row: Record<string, unknown>): Promise<void> {
    requireTrustedMutation(input.trustedProcessorMutations);
    const result = await client.from(table).upsert({ ...row, user_id: userId }, { onConflict: "user_id,account_id" });
    if (result.error) throw repositoryError(result.error);
  }

  async function rpc(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    requireTrustedMutation(input.trustedProcessorMutations);
    const result = await client.rpc(fn, args);
    if (result.error) throw repositoryError(result.error);
    return record(result.data, `${fn} response`);
  }

  return {
    async listDailyPlans(accountId) {
      requireText(accountId, "account id");
      return (await select("prop_daily_plan_snapshots", { account_id: accountId }, "generated_at")).map(parseDailyPlan);
    },

    async listTimeline(accountId) {
      requireText(accountId, "account id");
      return (await select("prop_timeline_events", { account_id: accountId }, "occurred_at")).map(parseTimeline);
    },

    async listInstrumentVersions(accountId, symbol) {
      requireText(accountId, "account id");
      requireText(symbol, "instrument symbol");
      return (await select("prop_instrument_spec_versions", { account_id: accountId, symbol: symbol.trim().toUpperCase() }, "effective_from")).map(parseInstrument);
    },

    async listRuntimeStates() {
      return (await select("prop_account_runtime_states", {}, "calculated_at")).map(parsePersistedRuntimeState);
    },

    async getRuntimeState(accountId) {
      requireText(accountId, "account id");
      const rows = await select("prop_account_runtime_states", { account_id: accountId });
      if (rows.length > 1) throw new PropPassPersistenceError("invalid_row", "multiple runtime states for account");
      return rows[0] ? parsePersistedRuntimeState(rows[0]) : null;
    },

    async appendDailyPlan(plan) {
      validateDailyPlanForWrite(plan);
      await insert("prop_daily_plan_snapshots", {
        id: plan.id, account_id: plan.accountId, challenge_id: plan.challengeId,
        trading_day: plan.tradingDay, plan_key: plan.payload.id,
        generated_at: plan.payload.generatedAt, payload: plan.payload,
        calculation_version: plan.versions.calculationVersion,
        rule_version: plan.versions.ruleVersion,
        instrument_version: plan.versions.instrumentVersion,
        payload_digest: plan.payloadDigest,
      });
    },

    async appendDecisionReplay(replay) {
      validateReplayForWrite(replay);
      await insert("prop_decision_replays", {
        id: replay.id, account_id: replay.accountId, challenge_id: replay.challengeId,
        replay_key: replay.replayKey, trade_client_id: replay.tradeClientId,
        trade_revision: replay.tradeRevision, plan_snapshot_id: replay.planSnapshotId,
        calculation_version: replay.versions.calculationVersion,
        rule_version: replay.versions.ruleVersion,
        instrument_version: replay.versions.instrumentVersion,
        payload: replay.payload, payload_digest: replay.payloadDigest,
      });
    },

    async appendPreTradeAssessment(assessment) {
      validatePreTradeForWrite(assessment);
      await insert("prop_pre_trade_assessments", {
        id: assessment.id, account_id: assessment.accountId, challenge_id: assessment.challengeId,
        assessment_key: assessment.assessmentKey, plan_snapshot_id: assessment.planSnapshotId,
        calculation_version: assessment.versions.calculationVersion,
        rule_version: assessment.versions.ruleVersion,
        instrument_version: assessment.versions.instrumentVersion,
        payload: assessment.payload, payload_digest: assessment.payloadDigest,
      });
    },

    async appendIntervention(event) {
      validateInterventionForWrite(event);
      await insert("prop_intervention_events", {
        id: event.id, account_id: event.accountId, challenge_id: event.challengeId,
        event_key: event.eventKey, trade_client_id: event.tradeClientId,
        rule_id: event.ruleId, severity: mapInterventionSeverity(event.payload.severity),
        plan_snapshot_id: event.planSnapshotId,
        calculation_version: event.versions.calculationVersion,
        rule_version: event.versions.ruleVersion,
        instrument_version: event.versions.instrumentVersion,
        payload: event.payload,
      });
    },

    async appendInterventionOverride(override) {
      validateOverrideForWrite(override);
      await insert("prop_intervention_overrides", {
        id: override.id, account_id: override.accountId, challenge_id: override.challengeId,
        intervention_event_id: override.interventionEventId, override_key: override.overrideKey,
        confirmation_text: override.confirmationText, confirmed_at: override.confirmedAt,
      });
    },

    async appendTimeline(event) {
      validateTimelineForWrite(event);
      await insert("prop_timeline_events", {
        id: event.id, account_id: event.accountId, challenge_id: event.challengeId,
        event_key: event.eventKey, event_type: event.payload.type,
        occurred_at: event.payload.occurredAt, trade_client_id: event.payload.tradeId ?? null,
        rule_id: event.payload.ruleId ?? null, account_snapshot: event.payload.snapshot,
        plan_snapshot_id: event.planSnapshotId,
        calculation_version: event.versions.calculationVersion,
        rule_version: event.versions.ruleVersion,
        instrument_version: event.versions.instrumentVersion,
        payload: event.payload,
      });
    },

    async appendInstrumentVersion(accountId, version) {
      requireText(accountId, "account id");
      validateInstrument(version);
      await insert("prop_instrument_spec_versions", {
        account_id: accountId, symbol: version.symbol,
        specification_version: version.specificationVersion,
        effective_from: version.effectiveFrom, effective_to: version.effectiveTo,
        payload: version, source_note: version.sourceNote,
        payload_digest: hashPropOsCommandPayload("instrument_version", version),
      });
    },

    async saveLiveRiskSettings(accountId, settings) {
      requireText(accountId, "account id"); iso(settings.configuredAt, "live settings configuredAt"); record(settings.rules, "live risk rules");
      await upsert("prop_live_risk_settings", { account_id: accountId, payload: settings, updated_at: settings.configuredAt });
    },

    async savePayoutWithdrawalSettings(accountId, settings) {
      requireText(accountId, "account id"); iso(settings.configuredAt, "payout settings configuredAt");
      if (!settings.payout && !settings.withdrawal) throw new PropPassPersistenceError("invalid_input", "payout or withdrawal settings required");
      await upsert("prop_payout_withdrawal_settings", { account_id: accountId, payload: settings, updated_at: settings.configuredAt });
    },

    async saveKillSwitchSettings(accountId, settings) {
      requireText(accountId, "account id"); iso(settings.configuredAt, "kill switch configuredAt"); record(settings.configuration, "kill switch configuration");
      await upsert("prop_kill_switch_settings", { account_id: accountId, payload: settings, updated_at: settings.configuredAt });
    },

    async saveRecoveryModeState(accountId, recovery) {
      requireText(accountId, "account id"); iso(recovery.updatedAt, "recovery updatedAt");
      if (typeof recovery.state.active !== "boolean") throw new PropPassPersistenceError("invalid_input", "recovery active state required");
      await upsert("prop_recovery_mode_states", { account_id: accountId, payload: recovery.state, updated_at: recovery.updatedAt });
    },

    async appendPositionProgression(progression) {
      requireText(progression.id, "progression id"); requireText(progression.accountId, "account id"); requireText(progression.eventKey, "progression event key"); iso(progression.occurredAt, "progression occurredAt");
      requireText(progression.payload.stage, "progression stage");
      await insert("prop_position_size_progressions", {
        id: progression.id, account_id: progression.accountId, event_key: progression.eventKey,
        previous_stage: progression.payload.transition?.previousStage ?? null,
        new_stage: progression.payload.stage,
        payload: progression.payload, occurred_at: progression.occurredAt,
      });
    },

    async claimJournalEvent(event) {
      validateJournalEvent(event, userId);
      const response = await rpc("prop_os_processor_claim_journal_event", {
        p_user_id: userId, p_account_id: event.accountId, p_challenge_id: event.challengeId,
        p_event_key: event.eventKey, p_event_type: event.eventType,
        p_journal_trade_id: event.journalTradeId, p_trade_client_id: event.tradeClientId,
        p_trade_revision: event.tradeRevision, p_calculation_version: event.calculationVersion,
        p_prior_event_key: event.priorEventKey, p_input_digest: event.inputDigest,
      });
      const kind = requireText(response.kind, "claim kind");
      if (kind === "conflict") throw new PropPassPersistenceError("conflict", requireText(response.reasonCode, "conflict reason"));
      if (kind !== "claimed" && kind !== "already_applied") throw new PropPassPersistenceError("forbidden", `claim rejected: ${kind}`);
      return {
        kind, eventId: requireText(response.eventId, "event id"),
        processingState: enumValue(response.processingState, ["pending", "applied", "superseded", "failed"], "processing state"),
        resultDigest: optionalText(response.resultDigest),
      } satisfies JournalEventClaim;
    },

    async completeJournalEvent(event) {
      validateCompletion(event);
      const response = await rpc("prop_os_processor_complete_journal_event", {
        p_user_id: userId, p_event_key: event.eventKey, p_result_digest: event.resultDigest,
        p_state_revision: event.stateRevision,
        p_calculation_version: event.versions.calculationVersion,
        p_rule_version: event.versions.ruleVersion,
        p_instrument_version: event.versions.instrumentVersion,
        p_lifecycle_status: event.lifecycleStatus, p_state_payload: event.state,
        p_state_digest: event.stateDigest, p_calculated_at: event.calculatedAt,
      });
      const kind = requireText(response.kind, "complete kind");
      if (kind === "conflict") throw new PropPassPersistenceError("conflict", requireText(response.reasonCode, "conflict reason"));
      if (kind !== "applied" && kind !== "already_applied") throw new PropPassPersistenceError("repository_unavailable", `completion rejected: ${kind}`);
      return kind;
    },

    async failJournalEvent(eventKey, resultDigest) {
      requireText(eventKey, "event key"); requireText(resultDigest, "result digest");
      const response = await rpc("prop_os_processor_fail_journal_event", { p_user_id: userId, p_event_key: eventKey, p_result_digest: resultDigest });
      if (response.kind !== "failed") throw new PropPassPersistenceError("conflict", `failure update rejected: ${String(response.kind)}`);
    },
  };
}

function parseDailyPlan(row: Record<string, unknown>): PersistedDailyPlan {
  const payload = record(row.payload, "daily plan payload");
  requireText(payload.id, "plan payload id"); requireText(payload.generatedAt, "plan generatedAt");
  return { id: requireText(row.id, "plan id"), accountId: requireText(row.account_id, "account id"), challengeId: optionalText(row.challenge_id), tradingDay: requireText(row.trading_day, "trading day"), versions: versions(row), payloadDigest: requireText(row.payload_digest, "payload digest"), payload: payload as PersistedDailyPlan["payload"] };
}

function parseTimeline(row: Record<string, unknown>): ChallengeTimelineEvent {
  const payload = record(row.payload, "timeline payload");
  requireText(payload.accountId, "timeline account id"); requireText(payload.occurredAt, "timeline timestamp"); requireText(payload.type, "timeline type");
  return payload as ChallengeTimelineEvent;
}

function parseInstrument(row: Record<string, unknown>): InstrumentSpecificationVersion {
  const payload = record(row.payload, "instrument payload");
  validateInstrument(payload as InstrumentSpecificationVersion);
  if (payload.specificationVersion !== row.specification_version || payload.symbol !== row.symbol) throw new PropPassPersistenceError("invalid_row", "instrument metadata mismatch");
  return payload as InstrumentSpecificationVersion;
}

export function parsePersistedRuntimeState(row: Record<string, unknown>): PersistedRuntimeState {
  const payload = record(row.payload, "runtime payload");
  validateRuntimePayload(payload);
  const persistedVersions = versions(row);
  if (persistedVersions.calculationVersion !== payload.calculationVersion) throw new PropPassPersistenceError("invalid_row", "runtime calculation version metadata mismatch");
  return { accountId: requireText(row.account_id, "account id"), challengeId: optionalText(row.challenge_id), stateRevision: positiveInteger(row.state_revision, "state revision", true), lifecycleStatus: requireText(row.lifecycle_status, "lifecycle status"), lastProcessedEventKey: optionalText(row.last_processed_event_key), calculatedAt: iso(row.calculated_at, "calculated at"), versions: persistedVersions, payloadDigest: requireText(row.payload_digest, "payload digest"), payload: payload as PersistedRuntimeState["payload"] };
}

function versions(row: Record<string, unknown>): PersistenceVersions { return { calculationVersion: requireText(row.calculation_version, "calculation version"), ruleVersion: requireText(row.rule_version, "rule version"), instrumentVersion: optionalText(row.instrument_version) }; }
function validateDailyPlanForWrite(value: PersistedDailyPlan): void { requireText(value.id, "plan id"); requireText(value.accountId, "account id"); requireText(value.tradingDay, "trading day"); requireText(value.payloadDigest, "payload digest"); requireText(value.payload.id, "payload plan id"); requireText(value.payload.generatedAt, "payload generatedAt"); validateVersions(value.versions); }
function validateReplayForWrite(value: PersistedDecisionReplay): void { requireText(value.id, "replay id"); requireText(value.accountId, "account id"); requireText(value.replayKey, "replay key"); requireText(value.tradeClientId, "trade client id"); positiveInteger(value.tradeRevision, "trade revision"); requireText(value.planSnapshotId, "plan snapshot id"); requireText(value.payload.verdict, "replay verdict"); requireText(value.payloadDigest, "payload digest"); validateVersions(value.versions); }
function validatePreTradeForWrite(value: PersistedPreTradeAssessment): void { requireText(value.id, "assessment id"); requireText(value.accountId, "account id"); requireText(value.assessmentKey, "assessment key"); requireText(value.planSnapshotId, "plan snapshot id"); requireText(value.payload.status, "assessment status"); requireText(value.payloadDigest, "assessment digest"); validateVersions(value.versions); }
function validateInterventionForWrite(value: PersistedInterventionEvent): void { requireText(value.id, "intervention id"); requireText(value.accountId, "account id"); requireText(value.eventKey, "intervention event key"); requireText(value.payload.severity, "intervention severity"); requireText(value.payload.title, "intervention title"); validateVersions(value.versions); }
function validateOverrideForWrite(value: PersistedInterventionOverride): void { requireText(value.id, "override id"); requireText(value.accountId, "account id"); requireText(value.interventionEventId, "intervention event id"); requireText(value.overrideKey, "override key"); requireText(value.confirmationText, "confirmation text"); iso(value.confirmedAt, "override confirmedAt"); }
function validateTimelineForWrite(value: PersistedTimelineEvent): void { requireText(value.id, "timeline id"); requireText(value.accountId, "account id"); requireText(value.eventKey, "timeline event key"); requireText(value.payload.type, "timeline event type"); iso(value.payload.occurredAt, "timeline occurredAt"); if (value.payload.accountId !== value.accountId) throw new PropPassPersistenceError("invalid_input", "timeline account mismatch"); validateVersions(value.versions); }
function validateInstrument(value: InstrumentSpecificationVersion): void { requireText(value.symbol, "instrument symbol"); requireText(value.specificationVersion, "instrument version"); requireText(value.exchange, "instrument exchange"); requireText(value.currency, "instrument currency"); iso(value.effectiveFrom, "instrument effectiveFrom"); if (value.effectiveTo) iso(value.effectiveTo, "instrument effectiveTo"); if (!(value.tickSize > 0) || !Number.isSafeInteger(value.tickValueMinor) || value.tickValueMinor <= 0) throw new PropPassPersistenceError("invalid_input", "invalid instrument values"); }
function validateJournalEvent(value: JournalPersistenceEvent, userId: string): void { if (value.userId !== userId) throw new PropPassPersistenceError("forbidden", "journal event user mismatch"); requireText(value.accountId, "account id"); requireText(value.eventKey, "event key"); requireText(value.tradeClientId, "trade client id"); positiveInteger(value.tradeRevision, "trade revision"); requireText(value.calculationVersion, "calculation version"); requireText(value.inputDigest, "input digest"); }
function validateCompletion(value: CompleteJournalEvent): void { requireText(value.eventKey, "event key"); requireText(value.resultDigest, "result digest"); positiveInteger(value.stateRevision, "state revision", true); requireText(value.lifecycleStatus, "lifecycle status"); iso(value.calculatedAt, "calculated at"); requireText(value.stateDigest, "state digest"); validateVersions(value.versions); validateRuntimePayload(record(value.state, "runtime completion payload")); if (value.state.calculationVersion !== value.versions.calculationVersion) throw new PropPassPersistenceError("invalid_input", "runtime calculation version mismatch"); }
function validateVersions(value: PersistenceVersions): void { requireText(value.calculationVersion, "calculation version"); requireText(value.ruleVersion, "rule version"); }
function mapInterventionSeverity(value: string): "info" | "warning" | "danger" | "stop" { if (value === "info" || value === "warning") return value; if (value === "pause") return "danger"; if (value === "block") return "stop"; throw new PropPassPersistenceError("invalid_input", "invalid intervention severity"); }
function requireTrustedMutation(allowed?: boolean): void { if (!allowed) throw new PropPassPersistenceError("forbidden", "Prop Pass mutations require a trusted server processor"); }
function ownedRow(value: unknown, userId: string, label: string): Record<string, unknown> { const row = record(value, label); if (row.user_id !== userId) throw new PropPassPersistenceError("forbidden", `${label}: owner mismatch`); return row; }
function record(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new PropPassPersistenceError("invalid_row", `${label}: object expected`); return value as Record<string, unknown>; }
function requireText(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new PropPassPersistenceError("invalid_input", `${label} is required`); return value; }
function optionalText(value: unknown): string | null { if (value == null) return null; return requireText(value, "optional text"); }
function positiveInteger(value: unknown, label: string, zeroAllowed = false): number { if (!Number.isSafeInteger(value) || (zeroAllowed ? Number(value) < 0 : Number(value) <= 0)) throw new PropPassPersistenceError("invalid_input", `${label} must be ${zeroAllowed ? "non-negative" : "positive"}`); return Number(value); }
function iso(value: unknown, label: string): string { const text = requireText(value, label); if (Number.isNaN(Date.parse(text))) throw new PropPassPersistenceError("invalid_input", `${label} must be an ISO timestamp`); return text; }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T { if (typeof value !== "string" || !allowed.includes(value as T)) throw new PropPassPersistenceError("invalid_row", `${label} is invalid`); return value as T; }
function repositoryError(error: { message: string; code?: string }): PropPassPersistenceError { if (error.code === "42501" || /permission|row-level security/i.test(error.message)) return new PropPassPersistenceError("forbidden", "Prop Pass persistence request denied"); if (error.code === "23505") return new PropPassPersistenceError("conflict", "Prop Pass persistence identity conflict"); return new PropPassPersistenceError("repository_unavailable", "Prop Pass persistence unavailable"); }

function validateRuntimePayload(payload: Record<string, unknown>): void {
  if (requireText(payload.calculationVersion, "runtime calculation version") !== PROP_PASS_CALCULATION_VERSION) throw new PropPassPersistenceError("invalid_row", "unsupported runtime calculation version");
  enumValue(payload.status, ["safe_to_take", "risky", "rule_violation", "stop_trading", "needs_input"], "runtime status");
  const allowed = resultRecord(payload.allowedRisk, "runtime allowed risk");
  const allowedValues = record(allowed.values, "runtime allowed risk values");
  positiveInteger(allowedValues.allowedRiskMinor, "runtime allowed risk", true);
  resultRecord(payload.dailyPlan, "runtime daily plan");
  const risk = resultRecord(payload.riskMeter, "runtime risk meter");
  record(risk.values, "runtime risk meter values");
  const journal = record(payload.journalApplication, "runtime Journal application");
  stringArray(journal.appliedTradeIds, "runtime applied trade ids");
  stringArray(journal.duplicateTradeIds, "runtime duplicate trade ids");
  if (typeof journal.persistenceRequired !== "boolean") throw new PropPassPersistenceError("invalid_row", "runtime persistence flag required");
  const replay = record(payload.decisionReplay, "runtime decision replay");
  requireText(replay.verdict, "runtime replay verdict");
  requireText(replay.reason, "runtime replay reason");
  array(payload.interventions, "runtime interventions");
  array(payload.timeline, "runtime timeline");
  stringArray(payload.missingInputs, "runtime missing inputs");
  for (const entry of array(payload.calculationTrace, "runtime calculation trace")) {
    const step = record(entry, "runtime trace step");
    positiveInteger(step.order, "runtime trace order");
    requireText(step.stage, "runtime trace stage");
    enumValue(step.status, ["safe_to_take", "risky", "rule_violation", "stop_trading", "needs_input"], "runtime trace status");
    record(step.inputs, "runtime trace inputs");
    record(step.outputs, "runtime trace outputs");
    stringArray(step.arithmetic, "runtime trace arithmetic");
    stringArray(step.rounding, "runtime trace rounding");
  }
  resultRecord(payload.survival, "runtime survival");
  resultRecord(payload.breachReplay, "runtime breach replay");
  resultRecord(payload.payoutPlanner, "runtime payout planner");
}
function resultRecord(value: unknown, label: string): Record<string, unknown> { const row = record(value, label); enumValue(row.status, ["safe_to_take", "risky", "rule_violation", "stop_trading", "needs_input"], `${label} status`); if (!("values" in row)) throw new PropPassPersistenceError("invalid_row", `${label} values required`); stringArray(row.reasons, `${label} reasons`); stringArray(row.missingInputs, `${label} missing inputs`); array(row.appliedHardLimits, `${label} hard limits`); stringArray(row.relatedRuleIds, `${label} related rules`); return row; }
function array(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new PropPassPersistenceError("invalid_row", `${label}: array expected`); return value; }
function stringArray(value: unknown, label: string): string[] { const values = array(value, label); if (!values.every((item) => typeof item === "string")) throw new PropPassPersistenceError("invalid_row", `${label}: string array expected`); return values as string[]; }
