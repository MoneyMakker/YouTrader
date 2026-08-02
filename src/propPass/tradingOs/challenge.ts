import type { AccountContext, ChallengeRules, MoneyMinor, RiskRooms, TradingOsResult } from "./contracts";

export type ChallengeBreachFact = { ruleId: string; tradeId: string | null; occurredAt: string; plannedRiskMinor: MoneyMinor | null; actualRiskMinor: MoneyMinor | null; bufferBeforeMinor: MoneyMinor | null; bufferAfterMinor: MoneyMinor | null; };
export type ChallengeLifecycleInput = {
  account: AccountContext | null;
  rules: ChallengeRules | null;
  riskRooms: RiskRooms | null;
  completedTradingDays: number | null;
  consistencyPassed: boolean | null;
  appliedJournalTradeIds: string[] | null;
  breach: ChallengeBreachFact | null;
  fundedAt: string | null;
  archivedAt: string | null;
};
export type ChallengeLifecycleState = "active" | "passed" | "breached" | "funded" | "archived" | "needs_input";
export type ChallengeLifecycleValues = {
  state: ChallengeLifecycleState;
  targetProgressBps: number | null;
  profitRemainingMinor: MoneyMinor | null;
  completedTradingDays: number | null;
  requiredTradingDays: number | null;
  dailyLossRoomMinor: MoneyMinor | null;
  maximumLossRoomMinor: MoneyMinor | null;
  drawdownRoomMinor: MoneyMinor | null;
  appliedJournalTradeIds: string[];
  recalculationKey: string | null;
  breach: ChallengeBreachFact | null;
};

/** Pure reducer: Journal mutation adapters may call it repeatedly without double-applying trades. */
export function evaluateChallengeLifecycle(input: ChallengeLifecycleInput): TradingOsResult<ChallengeLifecycleValues> {
  const account = input.account; const rules = input.rules; const rooms = input.riskRooms;
  const missingInputs: string[] = [];
  if (!account || account.contextType !== "challenge") missingInputs.push("challenge_account_context");
  if (!rules) missingInputs.push("challenge_rules");
  if (rules?.profitTargetMinor == null) missingInputs.push("challenge_profit_target");
  if (rules?.minimumTradingDays == null) missingInputs.push("challenge_minimum_trading_days");
  if (input.completedTradingDays == null) missingInputs.push("challenge_completed_trading_days");
  if (input.consistencyPassed == null) missingInputs.push("challenge_consistency_status");
  if (!rooms || [rooms.dailyLossRemainingMinor, rooms.maximumLossRemainingMinor, rooms.drawdownRemainingMinor].some((value) => value == null)) missingInputs.push("challenge_risk_rooms");
  if (!input.appliedJournalTradeIds) missingInputs.push("challenge_journal_trade_ids");
  if (input.appliedJournalTradeIds && new Set(input.appliedJournalTradeIds).size !== input.appliedJournalTradeIds.length) missingInputs.push("challenge_duplicate_journal_trade_id");
  if (missingInputs.length) return result("needs_input", empty(), ["challenge_state_requires_recorded_inputs"], missingInputs);

  const profit = account!.currentBalanceMinor - account!.startingBalanceMinor;
  const target = rules!.profitTargetMinor!;
  const targetProgressBps = Math.max(0, Math.floor(profit * 10_000 / Math.max(1, target)));
  const tradeIds = [...input.appliedJournalTradeIds!].sort();
  const values: ChallengeLifecycleValues = { state: "active", targetProgressBps, profitRemainingMinor: Math.max(0, target - profit), completedTradingDays: input.completedTradingDays!, requiredTradingDays: rules!.minimumTradingDays!, dailyLossRoomMinor: rooms!.dailyLossRemainingMinor!, maximumLossRoomMinor: rooms!.maximumLossRemainingMinor!, drawdownRoomMinor: rooms!.drawdownRemainingMinor!, appliedJournalTradeIds: tradeIds, recalculationKey: tradeIds.join(":"), breach: input.breach };
  if (input.archivedAt) values.state = "archived";
  else if (input.fundedAt) values.state = "funded";
  else if (input.breach) values.state = "breached";
  else if (profit >= target && input.completedTradingDays! >= rules!.minimumTradingDays! && input.consistencyPassed) values.state = "passed";
  return result("safe_to_take", values, values.state === "breached" ? ["challenge_breached"] : [], []);
}

function empty(): ChallengeLifecycleValues { return { state: "needs_input", targetProgressBps: null, profitRemainingMinor: null, completedTradingDays: null, requiredTradingDays: null, dailyLossRoomMinor: null, maximumLossRoomMinor: null, drawdownRoomMinor: null, appliedJournalTradeIds: [], recalculationKey: null, breach: null }; }
function result(status: TradingOsResult<ChallengeLifecycleValues>["status"], values: ChallengeLifecycleValues, reasons: string[], missingInputs: string[]): TradingOsResult<ChallengeLifecycleValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: values.breach?.ruleId ? [values.breach.ruleId] : [] }; }
