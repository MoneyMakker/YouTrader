import type { MoneyMinor, RiskHealth, TradingOsResult } from "./contracts";
export type LiveEngineInput = { currentEquityMinor: MoneyMinor | null; equityHighMinor: MoneyMinor | null; dailyRiskRemainingMinor: MoneyMinor | null; weeklyLossRemainingMinor: MoneyMinor | null; normalRiskPerTradeMinor: MoneyMinor | null; recoveryThresholdBps: number | null; recoveryRiskBps: number | null; killSwitchActive: boolean; };
export type LiveEngineValues = { drawdownBps: number | null; recoveryModeActive: boolean; allowedRiskPerTradeMinor: MoneyMinor; health: RiskHealth | null; weeklyRoomMinor: MoneyMinor | null; };
export function calculateLiveEngine(input: LiveEngineInput): TradingOsResult<LiveEngineValues> {
 const blank: LiveEngineValues = { drawdownBps: null, recoveryModeActive: false, allowedRiskPerTradeMinor: 0, health: null, weeklyRoomMinor: input.weeklyLossRemainingMinor };
 if ([input.currentEquityMinor,input.equityHighMinor,input.dailyRiskRemainingMinor,input.weeklyLossRemainingMinor,input.normalRiskPerTradeMinor,input.recoveryThresholdBps,input.recoveryRiskBps].some(v=>v==null)) return out("needs_input",blank,["live_risk_setup_missing"],["live_risk_rules"]);
 const dd = Math.max(0, Math.floor(((input.equityHighMinor!-input.currentEquityMinor!)*10000)/Math.max(1,input.equityHighMinor!))); const recovery=dd>=input.recoveryThresholdBps!;
 const stopped=input.killSwitchActive||input.dailyRiskRemainingMinor!<=0||input.weeklyLossRemainingMinor!<=0; const allowed=stopped?0:Math.min(input.dailyRiskRemainingMinor!,input.weeklyLossRemainingMinor!, recovery?Math.floor(input.normalRiskPerTradeMinor!*input.recoveryRiskBps!/10000):input.normalRiskPerTradeMinor!);
 const health:RiskHealth=stopped?"stop_trading":Math.min(input.dailyRiskRemainingMinor!,input.weeklyLossRemainingMinor!)<allowed*2?"danger":recovery?"watch":"healthy";
 return out(stopped?"stop_trading":"safe_to_take",{drawdownBps:dd,recoveryModeActive:recovery,allowedRiskPerTradeMinor:allowed,health,weeklyRoomMinor:input.weeklyLossRemainingMinor},stopped?["live_hard_limit_reached"]:recovery?["recovery_mode_active"]:[],[]);
}
function out(status:TradingOsResult<LiveEngineValues>["status"],values:LiveEngineValues,reasons:string[],missingInputs:string[]):TradingOsResult<LiveEngineValues>{return{values,status,reasons,missingInputs,appliedHardLimits:[],relatedRuleIds:[]}}
