import type { MoneyMinor } from "./contracts";
import { formatMoneyMinor } from "./financialMath";
export type TimelineEventType = "challenge_started" | "first_green_day" | "target_25" | "target_50" | "target_75" | "drawdown_warning" | "recovered" | "rule_override" | "passed" | "breached" | "funded" | "first_payout" | "additional_payout" | "archived";
export type TimelineAccountSnapshot = { equityMinor: MoneyMinor; balanceMinor: MoneyMinor; dailyRoomMinor?: MoneyMinor | null; drawdownRoomMinor?: MoneyMinor | null; maximumLossRoomMinor?: MoneyMinor | null };
export type PersistedTimelineFact = { type: TimelineEventType; occurredAt: string; accountId: string; valueMinor?: MoneyMinor; tradeId?: string; ruleId?: string; snapshot: TimelineAccountSnapshot; plannedRiskMinor?: MoneyMinor; actualRiskMinor?: MoneyMinor; bufferBeforeMinor?: MoneyMinor; bufferAfterMinor?: MoneyMinor };
export type ChallengeTimelineEvent = PersistedTimelineFact & { explanation: string; actionableImprovement?: string };
/** Converts only stored facts into a concise deterministic timeline. */
export function buildChallengeTimeline(facts: PersistedTimelineFact[]): ChallengeTimelineEvent[] {
  const seen = new Set<string>();
  return [...facts].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).filter((fact) => { const key = timelineEventKey(fact); if (seen.has(key)) return false; seen.add(key); return true; }).map((fact) => ({ ...fact, explanation: explanation(fact), actionableImprovement: fact.type === "breached" ? improvement(fact) : undefined }));
}
/** Stable key lets storage adapters use an idempotency constraint for refresh-safe event writes. */
export function timelineEventKey(fact: PersistedTimelineFact): string { return [fact.accountId, fact.type, fact.occurredAt, fact.tradeId ?? "", fact.ruleId ?? ""].join(":"); }
function explanation(fact: PersistedTimelineFact): string {
  if (fact.type === "breached") return `Rule ${fact.ruleId ?? "unknown"} was breached at this recorded event.`;
  if (fact.type === "rule_override") return `A recorded rule override was applied to ${fact.ruleId ?? "the selected rule"}.`;
  if (fact.type === "first_payout" || fact.type === "additional_payout") return `Recorded payout: $${formatMoneyMinor(fact.valueMinor ?? 0)}.`;
  return fact.type.replaceAll("_", " ");
}
function improvement(fact: PersistedTimelineFact): string { return fact.actualRiskMinor != null && fact.plannedRiskMinor != null && fact.actualRiskMinor > fact.plannedRiskMinor ? "Use the frozen plan risk or lower before the next qualified setup." : "Review the recorded breached rule before the next qualified setup."; }
