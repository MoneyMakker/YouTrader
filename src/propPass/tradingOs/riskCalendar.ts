import type { MoneyMinor, RiskHealth } from "./contracts";
import type { ChallengeTimelineEvent } from "./timeline";
import type { DecisionReplay } from "./replay";
import type { DailyTradingPlanSnapshot } from "./dailyPlan";
import type { SmartIntervention } from "./interventions";
export type DailyRiskCalendarFact = Readonly<{ tradingDayId: string; plan: DailyTradingPlanSnapshot | null; tradeIds: string[]; riskUsedMinor: MoneyMinor | null; riskRemainingMinor: MoneyMinor | null; health: RiskHealth | null; interventions: SmartIntervention[]; timeline: ChallengeTimelineEvent[]; replays: DecisionReplay[]; killSwitchActive: boolean; markers: Array<"payout" | "recovery" | "passed" | "failed"> }>;
export type DailyRiskCalendarDay = DailyRiskCalendarFact & Readonly<{ semanticState: "within_plan" | "warning" | "violation" | "hard_stop" | "no_trade" }>;
/** Maps persisted day facts only; it never invents or backfills missing history. */
export function buildDailyRiskCalendar(facts: DailyRiskCalendarFact[]): DailyRiskCalendarDay[] { const byDay = new Map<string, DailyRiskCalendarFact>(); for (const fact of facts) { if (!/^\d{4}-\d{2}-\d{2}$/.test(fact.tradingDayId) || byDay.has(fact.tradingDayId)) continue; byDay.set(fact.tradingDayId, fact); } return [...byDay.values()].sort((a, b) => b.tradingDayId.localeCompare(a.tradingDayId)).map((fact) => ({ ...fact, tradeIds: [...new Set(fact.tradeIds)], semanticState: fact.killSwitchActive || fact.health === "stop_trading" ? "hard_stop" : fact.interventions.some((item) => item.blocking) || fact.markers.includes("failed") ? "violation" : fact.health === "watch" || fact.health === "danger" || fact.interventions.length > 0 ? "warning" : fact.tradeIds.length === 0 ? "no_trade" : "within_plan" })); }
