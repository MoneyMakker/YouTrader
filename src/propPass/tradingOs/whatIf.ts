import type { AccountContext, MoneyMinor, RiskHealth, RiskRooms, TradingOsResult } from "./contracts";

export type WhatIfScenario =
  | { kind: "next_trade_loss"; riskMinor: MoneyMinor }
  | { kind: "two_consecutive_losses"; riskMinor: MoneyMinor }
  | { kind: "next_trade_win"; pnlMinor: MoneyMinor }
  | { kind: "extra_trade"; riskMinor: MoneyMinor }
  | { kind: "next_trading_day" }
  | { kind: "hypothetical_payout"; amountMinor: MoneyMinor }
  | { kind: "hypothetical_withdrawal"; amountMinor: MoneyMinor };

export type WhatIfInput = {
  account: AccountContext | null;
  riskRooms: RiskRooms;
  remainingTargetMinor: MoneyMinor | null;
  scenario: WhatIfScenario;
  dailyLossLimitMinor?: MoneyMinor | null;
  drawdownLimitMinor?: MoneyMinor | null;
  maximumLossLimitMinor?: MoneyMinor | null;
  weeklyLossLimitMinor?: MoneyMinor | null;
};

export type WhatIfValues = {
  projectedEquityMinor: MoneyMinor | null;
  projectedBalanceMinor: MoneyMinor | null;
  projectedDailyRoomMinor: MoneyMinor | null;
  projectedDrawdownRoomMinor: MoneyMinor | null;
  projectedMaximumLossRoomMinor: MoneyMinor | null;
  projectedWeeklyRoomMinor: MoneyMinor | null;
  remainingTargetMinor: MoneyMinor | null;
  health: RiskHealth | null;
  anotherTradePermitted: boolean | null;
};

/** Pure projection only: neither AccountContext nor RiskRooms is mutated. */
export function simulateWhatIf(input: WhatIfInput): TradingOsResult<WhatIfValues> {
  const blank: WhatIfValues = { projectedEquityMinor: null, projectedBalanceMinor: null, projectedDailyRoomMinor: null, projectedDrawdownRoomMinor: null, projectedMaximumLossRoomMinor: null, projectedWeeklyRoomMinor: null, remainingTargetMinor: input.remainingTargetMinor, health: null, anotherTradePermitted: null };
  if (!input.account) return response("needs_input", blank, [], ["account_context"]);
  const rooms = input.riskRooms;
  if ([rooms.dailyLossRemainingMinor, rooms.drawdownRemainingMinor, rooms.maximumLossRemainingMinor].some((value) => !isMinor(value))) {
    return response("needs_input", blank, ["hard_risk_limit_missing"], ["risk_rooms"]);
  }
  const delta = scenarioDelta(input.scenario);
  if (delta == null) return response("needs_input", blank, ["invalid_scenario_amount"], []);
  const dailyDelta = input.scenario.kind === "next_trading_day" ? 0 : Math.min(delta, 0);
  const daily = input.scenario.kind === "next_trading_day" ? rooms.dailyLossRemainingMinor : rooms.dailyLossRemainingMinor + dailyDelta;
  const drawdown = rooms.drawdownRemainingMinor + delta;
  const maximum = rooms.maximumLossRemainingMinor + delta;
  const weekly = rooms.weeklyLossRemainingMinor == null ? null : rooms.weeklyLossRemainingMinor + Math.min(delta, 0);
  const projectedEquityMinor = input.account.currentEquityMinor + delta;
  const projectedBalanceMinor = input.account.currentBalanceMinor + delta;
  const remainingTargetMinor = input.remainingTargetMinor == null ? null : Math.max(0, input.remainingTargetMinor - Math.max(delta, 0));
  const health = healthFor({ daily, drawdown, maximum, weekly }, input);
  const anotherTradePermitted = [daily, drawdown, maximum, weekly].every((room) => room == null || room > 0);
  return response(
    anotherTradePermitted ? (health === "danger" ? "risky" : "safe_to_take") : "stop_trading",
    { projectedEquityMinor, projectedBalanceMinor, projectedDailyRoomMinor: daily, projectedDrawdownRoomMinor: drawdown, projectedMaximumLossRoomMinor: maximum, projectedWeeklyRoomMinor: weekly, remainingTargetMinor, health, anotherTradePermitted },
    anotherTradePermitted ? [] : ["scenario_exhausts_hard_risk_room"], [],
  );
}

function scenarioDelta(scenario: WhatIfScenario): MoneyMinor | null {
  switch (scenario.kind) {
    case "next_trade_loss": return validAmount(scenario.riskMinor) ? -scenario.riskMinor : null;
    case "two_consecutive_losses": return validAmount(scenario.riskMinor) ? -2 * scenario.riskMinor : null;
    case "extra_trade": return validAmount(scenario.riskMinor) ? -scenario.riskMinor : null;
    case "next_trade_win": return validAmount(scenario.pnlMinor) ? scenario.pnlMinor : null;
    case "hypothetical_payout": return validAmount(scenario.amountMinor) ? -scenario.amountMinor : null;
    case "hypothetical_withdrawal": return validAmount(scenario.amountMinor) ? -scenario.amountMinor : null;
    case "next_trading_day": return 0;
  }
}
function validAmount(value: number): value is MoneyMinor { return Number.isSafeInteger(value) && value >= 0; }
function isMinor(value: unknown): value is MoneyMinor { return typeof value === "number" && Number.isSafeInteger(value); }
function healthFor(rooms: { daily: MoneyMinor; drawdown: MoneyMinor; maximum: MoneyMinor; weekly: MoneyMinor | null }, input: WhatIfInput): RiskHealth {
  if ([rooms.daily, rooms.drawdown, rooms.maximum, rooms.weekly].some((value) => value != null && value <= 0)) return "stop_trading";
  const ratios = [ratio(rooms.daily, input.dailyLossLimitMinor), ratio(rooms.drawdown, input.drawdownLimitMinor), ratio(rooms.maximum, input.maximumLossLimitMinor), ratio(rooms.weekly, input.weeklyLossLimitMinor)].filter((value): value is number => value != null);
  const smallest = ratios.length ? Math.min(...ratios) : 1;
  return smallest < .25 ? "danger" : smallest < .5 ? "watch" : "healthy";
}
function ratio(room: MoneyMinor | null, limit: MoneyMinor | null | undefined): number | null { return room != null && isMinor(limit) && limit > 0 ? Math.max(0, room / limit) : null; }
function response(status: TradingOsResult<WhatIfValues>["status"], values: WhatIfValues, reasons: string[], missingInputs: string[]): TradingOsResult<WhatIfValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
