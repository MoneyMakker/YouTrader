/**
 * Capital Preservation evidence from persisted account facts only.
 *
 * Never invents component scores. Never treats profitability as compliance.
 * Planned risk / size facts must be explicit — P&L is never a substitute.
 */
import type { ChallengeBreachFact } from "./challenge";
import type { DailyTradingPlanSnapshot } from "./dailyPlan";
import type { KillSwitchInput } from "./killSwitch";
import type { MoneyMinor, RiskRooms } from "./contracts";
import type { RecoveryModeValues } from "./recovery";
import type { PersistedTimelineFact } from "./timeline";
import {
  CAPITAL_PRESERVATION_WEIGHTS,
  calculateCapitalPreservationScore,
  type CapitalPreservationValues,
  type PreservationComponentId,
} from "./preservation";

export const PRESERVATION_CALCULATION_VERSION = "build117.preservation.v1" as const;

/** All weighted components remain required before a numeric score is published. */
export const PRESERVATION_REQUIRED_COMPONENTS = Object.freeze(
  Object.keys(CAPITAL_PRESERVATION_WEIGHTS) as PreservationComponentId[],
);

/**
 * Optional only in the sense that context may mark them N/A with an explicit
 * evidence ref (challenge has no weekly Live limit / recovery). They still must
 * resolve to a score before overall status becomes `ready`.
 */
export const PRESERVATION_CONTEXT_OPTIONAL_COMPONENTS = Object.freeze([
  "weekly_risk_adherence",
  "recovery_mode_adherence",
] as const satisfies readonly PreservationComponentId[]);

export type PreservationEvidenceKind =
  | "execution"
  | "timeline"
  | "daily_plan"
  | "risk_room"
  | "breach"
  | "kill_switch"
  | "recovery"
  | "rule_limit"
  | "trade_risk_fact"
  | "account_equity";

export type PreservationEvidenceRef = Readonly<{
  componentId: PreservationComponentId;
  kind: PreservationEvidenceKind;
  id: string;
}>;

export type PreservationComponentEvidenceState = "ready" | "missing" | "insufficient";

export type PreservationComponentEvidence = Readonly<{
  componentId: PreservationComponentId;
  status: PreservationComponentEvidenceState;
  score: number | null;
  confidence: "high" | "low" | "none";
  evidenceRefs: PreservationEvidenceRef[];
  missingInputs: string[];
}>;

export type CapitalPreservationEvaluationStatus = "ready" | "needs_input" | "insufficient_evidence";

export type CapitalPreservationEvaluation = Readonly<{
  status: CapitalPreservationEvaluationStatus;
  score: number | null;
  level: CapitalPreservationValues["level"];
  components: Partial<Record<PreservationComponentId, number>>;
  componentEvidence: Record<PreservationComponentId, PreservationComponentEvidence>;
  missingInputs: string[];
  evidenceRefs: PreservationEvidenceRef[];
  calculationVersion: typeof PRESERVATION_CALCULATION_VERSION;
  weights: typeof CAPITAL_PRESERVATION_WEIGHTS;
  strongestFactor: PreservationComponentId | null;
  primaryImprovementAction: string | null;
}>;

/** Explicit per-trade risk/size facts — never derived from realized P&L. */
export type PersistedTradeRiskFact = Readonly<{
  tradeClientId: string;
  tradeRevision: number;
  executionId: string | null;
  occurredAt: string;
  plannedRiskMinor: MoneyMinor | null;
  actualRiskMinor: MoneyMinor | null;
  contracts: number | null;
  sessionId: string | null;
  voided: boolean;
  accountId: string;
  userId: string;
}>;

/** Non-voided execution identity + size from prop_executions (never uses P&L as risk). */
export type PersistedExecutionEvidence = Readonly<{
  id: string;
  userId: string;
  accountId: string;
  tradeClientId: string | null;
  contracts: number | null;
  occurredAt: string;
}>;

export type CapitalPreservationEvidenceInput = Readonly<{
  userId: string;
  accountId: string;
  context: "challenge" | "live";
  tradingDayId: string | null;
  currentEquityMinor: MoneyMinor | null;
  equityHighMinor: MoneyMinor | null;
  maximumDrawdownMinor: MoneyMinor | null;
  dailyRiskBudgetMinor: MoneyMinor | null;
  dailyRiskUsedMinor: MoneyMinor | null;
  weeklyLossLimitMinor: MoneyMinor | null;
  weeklyLossUsedMinor: MoneyMinor | null;
  riskRooms: RiskRooms | null;
  dailyPlan: DailyTradingPlanSnapshot | null;
  killSwitch: KillSwitchInput | null;
  recovery: RecoveryModeValues | null;
  breach: ChallengeBreachFact | null;
  activeExecutions: readonly PersistedExecutionEvidence[];
  tradeRiskFacts: readonly PersistedTradeRiskFact[];
  timelineFacts: readonly PersistedTimelineFact[];
  maximumContracts: number | null;
  consecutiveLossLimit: number | null;
}>;

export function evaluateCapitalPreservationEvidence(
  input: CapitalPreservationEvidenceInput,
): CapitalPreservationEvaluation {
  const setupMissing: string[] = [];
  if (!input.userId) setupMissing.push("user_id");
  if (!input.accountId) setupMissing.push("account_id");
  if (!input.tradingDayId) setupMissing.push("trading_day");
  if (input.currentEquityMinor == null || input.equityHighMinor == null) setupMissing.push("account_equity");
  if (!input.riskRooms) setupMissing.push("risk_rooms");

  const ownedExecutions = input.activeExecutions.filter(
    (row) => row.userId === input.userId && row.accountId === input.accountId,
  );
  const ownedTrades = input.tradeRiskFacts.filter(
    (fact) => !fact.voided && fact.userId === input.userId && fact.accountId === input.accountId,
  );
  const ownedTimeline = input.timelineFacts.filter((fact) => fact.accountId === input.accountId);
  const tradeRiskFromTimeline = ownedTimeline
    .filter((fact) => fact.plannedRiskMinor != null && fact.actualRiskMinor != null && fact.tradeId)
    .map((fact) => ({
      tradeClientId: fact.tradeId!,
      tradeRevision: 1,
      executionId: null,
      occurredAt: fact.occurredAt,
      plannedRiskMinor: fact.plannedRiskMinor ?? null,
      actualRiskMinor: fact.actualRiskMinor ?? null,
      contracts: null,
      sessionId: null,
      voided: false,
      accountId: fact.accountId,
      userId: input.userId,
    } satisfies PersistedTradeRiskFact));

  const riskFacts = dedupeTradeRisk([...ownedTrades, ...tradeRiskFromTimeline]);
  const componentEvidence = {
    current_drawdown: scoreCurrentDrawdown(input),
    daily_risk_adherence: scoreDailyRisk(input, riskFacts),
    weekly_risk_adherence: scoreWeeklyRisk(input),
    consecutive_loss_control: scoreConsecutiveLoss(input, ownedExecutions),
    position_size_stability: scorePositionSize(input, ownedExecutions, riskFacts),
    hard_rule_compliance: scoreHardRules(input, ownedExecutions, riskFacts),
    kill_switch_events: scoreKillSwitch(input),
    recovery_mode_adherence: scoreRecovery(input, riskFacts),
  } as Record<PreservationComponentId, PreservationComponentEvidence>;

  const components: Partial<Record<PreservationComponentId, number>> = {};
  const missingInputs = [...setupMissing];
  const evidenceRefs: PreservationEvidenceRef[] = [];
  for (const id of PRESERVATION_REQUIRED_COMPONENTS) {
    const evidence = componentEvidence[id];
    evidenceRefs.push(...evidence.evidenceRefs);
    missingInputs.push(...evidence.missingInputs);
    if (evidence.status === "ready" && evidence.score != null) components[id] = evidence.score;
  }

  if (setupMissing.length > 0) {
    return withheld("needs_input", componentEvidence, components, unique(missingInputs), evidenceRefs);
  }

  const incomplete = PRESERVATION_REQUIRED_COMPONENTS.filter((id) => componentEvidence[id].status !== "ready");
  if (incomplete.length > 0) {
    return withheld("insufficient_evidence", componentEvidence, components, unique([
      ...missingInputs,
      ...incomplete.map((id) => `preservation_${id}`),
    ]), evidenceRefs);
  }

  const scored = calculateCapitalPreservationScore({ components: components as Record<PreservationComponentId, number> });
  if (scored.status !== "safe_to_take" || scored.values.score == null) {
    return withheld("insufficient_evidence", componentEvidence, components, unique([
      ...missingInputs,
      ...scored.missingInputs,
    ]), evidenceRefs);
  }

  return Object.freeze({
    status: "ready" as const,
    score: scored.values.score,
    level: scored.values.level,
    components,
    componentEvidence,
    missingInputs: [],
    evidenceRefs: uniqueRefs(evidenceRefs),
    calculationVersion: PRESERVATION_CALCULATION_VERSION,
    weights: CAPITAL_PRESERVATION_WEIGHTS,
    strongestFactor: scored.values.strongestFactor,
    primaryImprovementAction: scored.values.primaryImprovementAction,
  });
}

/** Maps evaluation into the Live pipeline preservation input (empty when withheld). */
export function preservationInputFromEvaluation(
  evaluation: CapitalPreservationEvaluation,
): { components: Partial<Record<PreservationComponentId, number>> } {
  if (evaluation.status !== "ready") return { components: {} };
  return { components: evaluation.components };
}

function scoreCurrentDrawdown(input: CapitalPreservationEvidenceInput): PreservationComponentEvidence {
  const id: PreservationComponentId = "current_drawdown";
  if (input.currentEquityMinor == null || input.equityHighMinor == null || input.maximumDrawdownMinor == null) {
    return missing(id, ["preservation_drawdown_limit", "account_equity"]);
  }
  if (input.maximumDrawdownMinor <= 0) return missing(id, ["preservation_drawdown_limit"]);
  const used = Math.max(0, input.equityHighMinor - input.currentEquityMinor);
  const remaining = Math.max(0, input.maximumDrawdownMinor - used);
  const ratio = remaining / input.maximumDrawdownMinor;
  const score = clampScore(Math.floor(ratio * 100));
  return ready(id, score, "high", [
    ref(id, "account_equity", `equity:${input.accountId}:${input.equityHighMinor}:${input.currentEquityMinor}`),
    ref(id, "rule_limit", `max_drawdown:${input.maximumDrawdownMinor}`),
    ref(id, "risk_room", `drawdown_remaining:${input.riskRooms?.drawdownRemainingMinor ?? remaining}`),
  ]);
}

function scoreDailyRisk(
  input: CapitalPreservationEvidenceInput,
  riskFacts: PersistedTradeRiskFact[],
): PreservationComponentEvidence {
  const id: PreservationComponentId = "daily_risk_adherence";
  const budget = input.dailyRiskBudgetMinor ?? input.dailyPlan?.maximumRiskTodayMinor ?? input.riskRooms?.configuredDailyRiskBudgetMinor ?? null;
  const used = input.dailyRiskUsedMinor;
  if (budget == null || used == null || budget < 0 || used < 0) {
    return missing(id, ["preservation_daily_budget", "preservation_daily_risk_used"]);
  }
  let score: number;
  if (budget === 0) score = used > 0 ? 0 : 100;
  else score = used > budget ? 0 : clampScore(Math.floor(Math.max(0, 1 - used / budget) * 100));

  const refs: PreservationEvidenceRef[] = [
    ref(id, "rule_limit", `daily_budget:${budget}`),
    ref(id, "risk_room", `daily_used:${used}`),
  ];
  if (input.dailyPlan) refs.push(ref(id, "daily_plan", input.dailyPlan.id));

  // When explicit per-trade risk facts exist, floor the budget score by plan-cap adherence.
  // Missing per-trade facts do not invent risk from P&L and do not block budget evidence.
  const planRisk = input.dailyPlan?.riskPerTradeMinor ?? input.riskRooms?.configuredPerTradeRiskCapMinor ?? null;
  const measurable = riskFacts.filter((fact) => fact.actualRiskMinor != null);
  if (planRisk != null && measurable.length > 0) {
    const violations = measurable.filter((fact) => (fact.actualRiskMinor ?? 0) > planRisk);
    const perTradeScore = violations.length === 0
      ? 100
      : clampScore(Math.floor((1 - violations.length / measurable.length) * 100));
    score = Math.min(score, perTradeScore);
    refs.push(ref(id, "rule_limit", `per_trade_cap:${planRisk}`));
    for (const fact of measurable) refs.push(ref(id, "trade_risk_fact", tradeFactId(fact)));
  }

  return ready(id, score, "high", refs);
}

function scoreWeeklyRisk(input: CapitalPreservationEvidenceInput): PreservationComponentEvidence {
  const id: PreservationComponentId = "weekly_risk_adherence";
  if (input.context === "challenge" && input.weeklyLossLimitMinor == null) {
    return ready(id, 100, "high", [ref(id, "rule_limit", "weekly_limit_not_configured:challenge")]);
  }
  const limit = input.weeklyLossLimitMinor;
  const used = input.weeklyLossUsedMinor;
  if (limit == null || used == null || limit < 0 || used < 0) {
    return missing(id, ["preservation_weekly_limit", "preservation_weekly_loss_used"]);
  }
  if (limit === 0) {
    return ready(id, used > 0 ? 0 : 100, "high", [
      ref(id, "rule_limit", "weekly_limit:0"),
      ref(id, "risk_room", `weekly_used:${used}`),
    ]);
  }
  const score = used > limit ? 0 : clampScore(Math.floor(Math.max(0, 1 - used / limit) * 100));
  return ready(id, score, "high", [
    ref(id, "rule_limit", `weekly_limit:${limit}`),
    ref(id, "risk_room", `weekly_used:${used}`),
  ]);
}

function scoreConsecutiveLoss(
  input: CapitalPreservationEvidenceInput,
  executions: PersistedExecutionEvidence[],
): PreservationComponentEvidence {
  const id: PreservationComponentId = "consecutive_loss_control";
  const limit = input.consecutiveLossLimit ?? input.dailyPlan?.stopAfterLosses ?? null;
  if (limit == null) return missing(id, ["preservation_consecutive_loss_limit"]);
  const streak = input.killSwitch?.consecutiveLosses;
  if (streak == null) {
    return insufficient(id, ["preservation_loss_streak_fact"], [
      ref(id, "rule_limit", `consecutive_loss_limit:${limit}`),
      ...executions.map((row) => ref(id, "execution", row.id)),
    ]);
  }
  const violated = streak > limit;
  const score = violated ? 0 : streak === 0 ? 100 : clampScore(Math.floor((1 - streak / Math.max(limit, 1)) * 100));
  return ready(id, score, "high", [
    ref(id, "rule_limit", `consecutive_loss_limit:${limit}`),
    ref(id, "kill_switch", `consecutive_losses:${streak}`),
    ...executions.slice(-5).map((row) => ref(id, "execution", row.id)),
  ]);
}

function scorePositionSize(
  input: CapitalPreservationEvidenceInput,
  executions: PersistedExecutionEvidence[],
  riskFacts: PersistedTradeRiskFact[],
): PreservationComponentEvidence {
  const id: PreservationComponentId = "position_size_stability";
  const contractCap = input.maximumContracts;
  if (contractCap == null) return missing(id, ["preservation_maximum_contracts"]);

  const fromFacts = riskFacts.filter((fact) => fact.contracts != null);
  const fromExecutions = executions.filter((row) => row.contracts != null);
  // Prefer explicit trade-risk contract facts when present; otherwise use execution contracts.
  const measured = fromFacts.length > 0
    ? fromFacts.map((fact) => ({ id: tradeFactId(fact), contracts: fact.contracts!, kind: "trade_risk_fact" as const }))
    : fromExecutions.map((row) => ({ id: row.id, contracts: row.contracts!, kind: "execution" as const }));

  if (executions.length > 0 && measured.length === 0) {
    return insufficient(id, ["preservation_trade_contract_facts"], executions.map((row) => ref(id, "execution", row.id)));
  }
  if (measured.length === 0) {
    return ready(id, 100, "low", [ref(id, "rule_limit", `maximum_contracts:${contractCap}`), ref(id, "execution", "none")]);
  }
  const oversize = measured.filter((item) => item.contracts > contractCap);
  const score = oversize.length === 0 ? 100 : clampScore(Math.floor((1 - oversize.length / measured.length) * 100));
  return ready(id, score, "high", [
    ref(id, "rule_limit", `maximum_contracts:${contractCap}`),
    ...measured.map((item) => ref(id, item.kind, item.id)),
    ...(input.dailyPlan ? [ref(id, "daily_plan", input.dailyPlan.id)] : []),
  ]);
}

function scoreHardRules(
  input: CapitalPreservationEvidenceInput,
  executions: PersistedExecutionEvidence[],
  riskFacts: PersistedTradeRiskFact[],
): PreservationComponentEvidence {
  const id: PreservationComponentId = "hard_rule_compliance";
  const refs: PreservationEvidenceRef[] = executions.map((row) => ref(id, "execution", row.id));
  if (input.breach) {
    refs.push(ref(id, "breach", `${input.breach.ruleId}:${input.breach.tradeId ?? "none"}:${input.breach.occurredAt}`));
    return ready(id, 0, "high", refs);
  }
  const planRisk = input.dailyPlan?.riskPerTradeMinor ?? input.riskRooms?.configuredPerTradeRiskCapMinor ?? null;
  const measurable = riskFacts.filter((fact) => fact.actualRiskMinor != null);
  if (planRisk != null && measurable.length > 0) {
    const violations = measurable.filter((fact) => (fact.actualRiskMinor ?? 0) > planRisk);
    for (const fact of measurable) refs.push(ref(id, "trade_risk_fact", tradeFactId(fact)));
    if (violations.length > 0) {
      // A profitable over-risk trade is still a hard-rule miss.
      return ready(id, 0, "high", [...refs, ref(id, "rule_limit", `per_trade_cap_breach:${planRisk}`)]);
    }
  }
  if (input.riskRooms) {
    const rooms = [
      input.riskRooms.dailyLossRemainingMinor,
      input.riskRooms.maximumLossRemainingMinor,
      input.riskRooms.drawdownRemainingMinor,
    ];
    if (rooms.some((value) => value != null && value < 0)) {
      return ready(id, 0, "high", [...refs, ref(id, "risk_room", "negative_room")]);
    }
  }
  return ready(id, 100, "high", refs.length ? refs : [ref(id, "breach", "none")]);
}

function scoreKillSwitch(input: CapitalPreservationEvidenceInput): PreservationComponentEvidence {
  const id: PreservationComponentId = "kill_switch_events";
  if (!input.killSwitch) return missing(id, ["preservation_kill_switch_state"]);
  const ks = input.killSwitch;
  const refs = [
    ref(id, "kill_switch", `manual_lock:${ks.manualSessionLockConfirmed ? "confirmed" : "clear"}`),
  ];
  if (ks.manualSessionLockConfirmed) {
    return ready(id, 100, "high", refs);
  }
  const dailyCap = ks.configuration.maximumDailyLossMinor;
  if (dailyCap != null && ks.currentDailyLossMinor != null && ks.currentDailyLossMinor > dailyCap) {
    return ready(id, 0, "high", [...refs, ref(id, "kill_switch", `daily_loss_breach:${ks.currentDailyLossMinor}>${dailyCap}`)]);
  }
  const tradeCap = ks.configuration.maximumTradeCount;
  if (tradeCap != null && ks.currentTradeCount != null && ks.currentTradeCount > tradeCap) {
    return ready(id, 0, "high", [...refs, ref(id, "kill_switch", `trade_count_breach:${ks.currentTradeCount}>${tradeCap}`)]);
  }
  const lossCap = ks.configuration.consecutiveLossLimit;
  if (lossCap != null && ks.consecutiveLosses != null && ks.consecutiveLosses > lossCap) {
    return ready(id, 0, "high", [...refs, ref(id, "kill_switch", `loss_streak_breach:${ks.consecutiveLosses}>${lossCap}`)]);
  }
  return ready(id, 100, "high", refs);
}

function scoreRecovery(
  input: CapitalPreservationEvidenceInput,
  riskFacts: PersistedTradeRiskFact[],
): PreservationComponentEvidence {
  const id: PreservationComponentId = "recovery_mode_adherence";
  if (input.context === "challenge") {
    return ready(id, 100, "high", [ref(id, "recovery", "not_applicable:challenge")]);
  }
  if (!input.recovery) return missing(id, ["preservation_recovery_state"]);
  const recovery = input.recovery;
  const refs = [ref(id, "recovery", `active:${recovery.active}`)];
  if (!recovery.active) return ready(id, 100, "high", refs);
  const reducedRisk = recovery.reducedRiskPerTradeMinor;
  const reducedContracts = recovery.reducedMaximumContracts;
  const withRisk = riskFacts.filter((fact) => fact.actualRiskMinor != null || fact.contracts != null);
  if (input.activeExecutions.some((row) => row.userId === input.userId && row.accountId === input.accountId) && withRisk.length === 0) {
    return insufficient(id, ["preservation_recovery_trade_risk_facts"], [
      ...refs,
      ...input.activeExecutions.map((row) => ref(id, "execution", row.id)),
    ]);
  }
  if (withRisk.length === 0) return ready(id, 100, "low", refs);
  const violations = withRisk.filter((fact) => {
    const riskOver = fact.actualRiskMinor != null && fact.actualRiskMinor > reducedRisk;
    const sizeOver = fact.contracts != null && fact.contracts > reducedContracts;
    return riskOver || sizeOver;
  });
  const score = violations.length === 0 ? 100 : 0;
  return ready(id, score, "high", [
    ...refs,
    ref(id, "rule_limit", `reduced_risk:${reducedRisk}`),
    ...withRisk.map((fact) => ref(id, "trade_risk_fact", tradeFactId(fact))),
  ]);
}

function withheld(
  status: Exclude<CapitalPreservationEvaluationStatus, "ready">,
  componentEvidence: Record<PreservationComponentId, PreservationComponentEvidence>,
  components: Partial<Record<PreservationComponentId, number>>,
  missingInputs: string[],
  evidenceRefs: PreservationEvidenceRef[],
): CapitalPreservationEvaluation {
  return Object.freeze({
    status,
    score: null,
    level: null,
    components,
    componentEvidence,
    missingInputs,
    evidenceRefs: uniqueRefs(evidenceRefs),
    calculationVersion: PRESERVATION_CALCULATION_VERSION,
    weights: CAPITAL_PRESERVATION_WEIGHTS,
    strongestFactor: null,
    primaryImprovementAction: null,
  });
}

function missing(componentId: PreservationComponentId, missingInputs: string[]): PreservationComponentEvidence {
  return Object.freeze({
    componentId,
    status: "missing",
    score: null,
    confidence: "none",
    evidenceRefs: [],
    missingInputs,
  });
}

function insufficient(
  componentId: PreservationComponentId,
  missingInputs: string[],
  evidenceRefs: PreservationEvidenceRef[],
): PreservationComponentEvidence {
  return Object.freeze({
    componentId,
    status: "insufficient",
    score: null,
    confidence: "none",
    evidenceRefs,
    missingInputs,
  });
}

function ready(
  componentId: PreservationComponentId,
  score: number,
  confidence: "high" | "low",
  evidenceRefs: PreservationEvidenceRef[],
): PreservationComponentEvidence {
  return Object.freeze({
    componentId,
    status: "ready",
    score: clampScore(score),
    confidence,
    evidenceRefs,
    missingInputs: [],
  });
}

function ref(
  componentId: PreservationComponentId,
  kind: PreservationEvidenceKind,
  id: string,
): PreservationEvidenceRef {
  return Object.freeze({ componentId, kind, id });
}

function tradeFactId(fact: PersistedTradeRiskFact): string {
  return `${fact.accountId}:${fact.tradeClientId}:r${fact.tradeRevision}:${fact.executionId ?? "noexec"}`;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function dedupeTradeRisk(facts: PersistedTradeRiskFact[]): PersistedTradeRiskFact[] {
  const map = new Map<string, PersistedTradeRiskFact>();
  for (const fact of facts) {
    if (fact.voided) continue;
    map.set(tradeFactId(fact), fact);
  }
  return [...map.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || tradeFactId(a).localeCompare(tradeFactId(b)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueRefs(values: PreservationEvidenceRef[]): PreservationEvidenceRef[] {
  const map = new Map<string, PreservationEvidenceRef>();
  for (const value of values) map.set(`${value.componentId}:${value.kind}:${value.id}`, value);
  return [...map.values()].sort((a, b) => `${a.componentId}:${a.kind}:${a.id}`.localeCompare(`${b.componentId}:${b.kind}:${b.id}`));
}
