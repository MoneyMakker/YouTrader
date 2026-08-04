import type { PropPassCalculationPipelineOutput } from "./pipelineContracts";
import { resolveKillSwitchValues } from "./killSwitch";
import type { DailyRiskCalendarFact } from "./riskCalendar";

/**
 * Map the current pipeline snapshot into a single persisted-day fact.
 * Historical days must be supplied separately — this never invents missing days.
 */
export function calendarFactFromPipelineOutput(
  output: PropPassCalculationPipelineOutput,
): DailyRiskCalendarFact | null {
  const tradingDayId = output.dailyPlan.values?.tradingDay;
  if (!tradingDayId || !/^\d{4}-\d{2}-\d{2}$/.test(tradingDayId)) return null;
  const markers: DailyRiskCalendarFact["markers"] = [];
  if (output.challengeLifecycle?.values.state === "passed") markers.push("passed");
  if (output.challengeLifecycle?.values.state === "breached") markers.push("failed");
  if (output.liveLifecycle?.values.recovery?.active) markers.push("recovery");
  if (
    (output.payoutReadiness?.status === "safe_to_take" &&
      (output.payoutReadiness.values.recommendedMaximumPayoutMinor ?? 0) > 0) ||
    (output.withdrawalReadiness?.status === "safe_to_take" &&
      (output.withdrawalReadiness.values.recommendedMaximumWithdrawalMinor ?? 0) > 0)
  ) {
    markers.push("payout");
  }
  return {
    tradingDayId,
    plan: output.dailyPlan.values,
    tradeIds: [...output.journalApplication.appliedTradeIds],
    riskUsedMinor: output.riskMeter.values.usedMinor,
    riskRemainingMinor: output.riskMeter.values.remainingMinor,
    health: output.riskMeter.values.status,
    interventions: [...output.interventions],
    timeline: output.timeline.filter((event) => event.occurredAt.startsWith(tradingDayId)),
    replays: output.decisionReplay.relatedTradeId
      ? [output.decisionReplay]
      : [],
    killSwitchActive: Boolean(resolveKillSwitchValues(output)?.active),
    markers,
  };
}
