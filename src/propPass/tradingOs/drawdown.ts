import type { MoneyMinor, TradingOsResult } from "./contracts";
import { moneyMax, moneySubtract } from "./financialMath";

export type DrawdownVariant =
  | "static"
  | "balance_based_trailing"
  | "equity_based_trailing"
  | "intraday_trailing"
  | "end_of_day_trailing"
  | "trailing_until_threshold"
  | "trailing_until_starting_balance"
  | "static_after_milestone";
export type DrawdownBasis = "balance" | "equity";
export type DrawdownTiming = "intraday" | "end_of_day";

export type DrawdownRuleVersion = Readonly<{
  id: string;
  version: string;
  effectiveAt: string;
  variant: DrawdownVariant;
  calculationBasis: DrawdownBasis;
  timing: DrawdownTiming;
  amountMinor: MoneyMinor;
  startingBalanceMinor: MoneyMinor;
  initialFloorMinor: MoneyMinor;
  lockThresholdMinor: MoneyMinor | null;
  milestoneMinor: MoneyMinor | null;
  staticAfterMilestoneFloorMinor: MoneyMinor | null;
  unrealizedPnlAffectsFloor: boolean;
  floorCanMoveDown: boolean;
}>;

export type DrawdownState = Readonly<{
  ruleVersion: string;
  highWaterMarkMinor: MoneyMinor;
  floorMinor: MoneyMinor;
  floorStatic: boolean;
  lastEffectiveAt: string;
}>;

export type DrawdownEvent = Readonly<{
  id: string;
  kind: "balance_update" | "equity_update" | "end_of_day" | "milestone";
  occurredAt: string;
  balanceMinor: MoneyMinor | null;
  equityMinor: MoneyMinor | null;
  equityIncludesUnrealized: boolean | null;
}>;

export type DrawdownTrace = Readonly<{
  previousHighWaterMarkMinor: MoneyMinor;
  newHighWaterMarkMinor: MoneyMinor;
  previousFloorMinor: MoneyMinor;
  newFloorMinor: MoneyMinor;
  triggerEventId: string;
  triggerEventKind: DrawdownEvent["kind"];
  basisValueMinor: MoneyMinor;
  remainingRoomMinor: MoneyMinor;
  floorStatic: boolean;
  explanation: string;
}>;

export type DrawdownValues = Readonly<{
  state: DrawdownState | null;
  trace: DrawdownTrace | null;
}>;

/** Applies exactly one persisted event to a versioned drawdown state. */
export function applyDrawdownEvent(
  rule: DrawdownRuleVersion | null,
  previous: DrawdownState | null,
  event: DrawdownEvent | null,
): TradingOsResult<DrawdownValues> {
  const validation = validate(rule, previous, event);
  if (validation.missingInputs.length || validation.reasons.length || !rule || !event) {
    return result("needs_input", { state: previous, trace: null }, validation.reasons, validation.missingInputs, rule?.id);
  }
  const basisValue = basisValueFor(rule, event);
  if (basisValue == null) return result("needs_input", { state: previous, trace: null }, ["drawdown_basis_value_missing"], [`${rule.calculationBasis}_value`], rule.id);
  const prior = previous ?? initialState(rule);
  if (new Date(event.occurredAt).getTime() < new Date(rule.effectiveAt).getTime()) {
    return result("needs_input", { state: prior, trace: null }, ["drawdown_event_precedes_rule_version"], ["effective_drawdown_event"], rule.id);
  }

  const previousHigh = prior.highWaterMarkMinor;
  const previousFloor = prior.floorMinor;
  const shouldTrail = !prior.floorStatic && timingMatches(rule, event);
  const newHigh = shouldTrail ? moneyMax(previousHigh, basisValue) : previousHigh;
  let nextFloor = previousFloor;
  let floorStatic = prior.floorStatic || rule.variant === "static";
  let explanation = floorStatic ? "The configured static drawdown floor remains unchanged." : "This event does not update the configured drawdown timing.";

  if (shouldTrail) {
    const candidate = moneySubtract(newHigh, rule.amountMinor);
    nextFloor = rule.floorCanMoveDown ? candidate : moneyMax(previousFloor, candidate);
    explanation = `The ${rule.calculationBasis} high-water mark less the configured drawdown amount produced the next floor.`;
    const lock = lockFor(rule, basisValue, nextFloor);
    if (lock) {
      nextFloor = lock.floorMinor;
      floorStatic = true;
      explanation = lock.explanation;
    }
  }

  if (!rule.floorCanMoveDown && nextFloor < previousFloor) {
    return result("needs_input", { state: prior, trace: null }, ["drawdown_floor_forbidden_direction"], ["drawdown_floor_policy"], rule.id);
  }
  const state: DrawdownState = Object.freeze({ ruleVersion: rule.version, highWaterMarkMinor: newHigh, floorMinor: nextFloor, floorStatic, lastEffectiveAt: event.occurredAt });
  const trace: DrawdownTrace = Object.freeze({
    previousHighWaterMarkMinor: previousHigh,
    newHighWaterMarkMinor: newHigh,
    previousFloorMinor: previousFloor,
    newFloorMinor: nextFloor,
    triggerEventId: event.id,
    triggerEventKind: event.kind,
    basisValueMinor: basisValue,
    remainingRoomMinor: moneySubtract(basisValue, nextFloor),
    floorStatic,
    explanation,
  });
  return result(trace.remainingRoomMinor <= 0 ? "stop_trading" : "safe_to_take", { state, trace }, trace.remainingRoomMinor <= 0 ? ["drawdown_floor_reached"] : [], [], rule.id);
}

/** Replays sorted persisted events; missing/invalid input stops without inventing state. */
export function replayDrawdownHistory(rule: DrawdownRuleVersion | null, events: DrawdownEvent[]): TradingOsResult<DrawdownValues> {
  if (!events.length) return result("needs_input", { state: null, trace: null }, ["drawdown_history_missing"], ["drawdown_events"], rule?.id);
  let state: DrawdownState | null = null;
  let latest: TradingOsResult<DrawdownValues> | null = null;
  const seen = new Set<string>();
  for (const event of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))) {
    if (seen.has(event.id)) return result("needs_input", { state, trace: latest?.values.trace ?? null }, ["duplicate_drawdown_event"], ["unique_drawdown_event_id"], rule?.id);
    seen.add(event.id);
    latest = applyDrawdownEvent(rule, state, event);
    if (latest.status === "needs_input") return latest;
    state = latest.values.state;
  }
  return latest!;
}

function initialState(rule: DrawdownRuleVersion): DrawdownState {
  return Object.freeze({
    ruleVersion: rule.version,
    highWaterMarkMinor: rule.startingBalanceMinor,
    floorMinor: rule.initialFloorMinor,
    floorStatic: rule.variant === "static",
    lastEffectiveAt: rule.effectiveAt,
  });
}

function basisValueFor(rule: DrawdownRuleVersion, event: DrawdownEvent): MoneyMinor | null {
  if (rule.calculationBasis === "balance") return event.balanceMinor;
  if (event.equityIncludesUnrealized !== rule.unrealizedPnlAffectsFloor) return null;
  return event.equityMinor;
}

function timingMatches(rule: DrawdownRuleVersion, event: DrawdownEvent): boolean {
  if (rule.variant === "static") return false;
  if (rule.timing === "end_of_day" || rule.variant === "end_of_day_trailing") return event.kind === "end_of_day";
  return event.kind !== "end_of_day" || rule.variant === "intraday_trailing";
}

function lockFor(rule: DrawdownRuleVersion, basisValue: MoneyMinor, candidateFloor: MoneyMinor): { floorMinor: MoneyMinor; explanation: string } | null {
  if (rule.variant === "trailing_until_threshold" && rule.lockThresholdMinor != null && candidateFloor >= rule.lockThresholdMinor) {
    return { floorMinor: rule.lockThresholdMinor, explanation: "The floor reached the configured lock threshold and is now static." };
  }
  if (rule.variant === "trailing_until_starting_balance" && candidateFloor >= rule.startingBalanceMinor) {
    return { floorMinor: rule.startingBalanceMinor, explanation: "The floor reached starting balance and is now static." };
  }
  if (rule.variant === "static_after_milestone" && rule.milestoneMinor != null && basisValue >= rule.milestoneMinor) {
    return { floorMinor: rule.staticAfterMilestoneFloorMinor ?? candidateFloor, explanation: "The configured milestone was reached; the resulting floor is now static." };
  }
  return null;
}

function validate(rule: DrawdownRuleVersion | null, previous: DrawdownState | null, event: DrawdownEvent | null): { missingInputs: string[]; reasons: string[] } {
  const missingInputs: string[] = [];
  const reasons: string[] = [];
  if (!rule) return { missingInputs: ["drawdown_rule_version"], reasons };
  if (!event) missingInputs.push("drawdown_event");
  if (!rule.id || !rule.version || !rule.effectiveAt) missingInputs.push("drawdown_rule_identity");
  if (Number.isNaN(new Date(rule.effectiveAt).getTime()) || (event && Number.isNaN(new Date(event.occurredAt).getTime()))) reasons.push("invalid_drawdown_timestamp");
  for (const [key, value] of Object.entries({ amount: rule.amountMinor, starting_balance: rule.startingBalanceMinor, initial_floor: rule.initialFloorMinor })) {
    if (!Number.isSafeInteger(value) || value < 0) reasons.push(`invalid_drawdown_${key}`);
  }
  if (rule.variant !== "static" && rule.amountMinor <= 0) reasons.push("invalid_drawdown_amount");
  if (rule.variant === "balance_based_trailing" && rule.calculationBasis !== "balance") reasons.push("drawdown_variant_basis_mismatch");
  if (rule.variant === "equity_based_trailing" && rule.calculationBasis !== "equity") reasons.push("drawdown_variant_basis_mismatch");
  if (rule.variant === "intraday_trailing" && rule.timing !== "intraday") reasons.push("drawdown_variant_timing_mismatch");
  if (rule.variant === "end_of_day_trailing" && rule.timing !== "end_of_day") reasons.push("drawdown_variant_timing_mismatch");
  if (rule.variant === "trailing_until_threshold" && rule.lockThresholdMinor == null) missingInputs.push("drawdown_lock_threshold");
  if (rule.variant === "static_after_milestone" && rule.milestoneMinor == null) missingInputs.push("drawdown_milestone");
  if (previous && previous.ruleVersion !== rule.version) reasons.push("drawdown_state_rule_version_mismatch");
  return { missingInputs, reasons };
}

function result(status: TradingOsResult<DrawdownValues>["status"], values: DrawdownValues, reasons: string[], missingInputs: string[], ruleId?: string): TradingOsResult<DrawdownValues> {
  return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: ruleId ? [ruleId] : [] };
}
