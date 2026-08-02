import type { DailyTradingPlanSnapshot } from "./dailyPlan";
import type { MoneyMinor, TradingRiskMode } from "./contracts";

export type InterventionSeverity = "info" | "warning" | "pause" | "block";
export type SmartIntervention = {
  id: string;
  severity: InterventionSeverity;
  title: string;
  reason: string;
  mathematicalConsequence: string;
  recommendedAction: string;
  blocking: boolean;
  ruleId: string | null;
  relatedTradeIds: string[];
  overrideEligible: boolean;
};
export type InterventionTradeFact = { id: string; occurredAt: string; realizedPnlMinor: MoneyMinor; riskMinor: MoneyMinor; contracts: number; sessionId?: string | null };
export type SmartInterventionInput = {
  plan: DailyTradingPlanSnapshot | null;
  completedTrades: InterventionTradeFact[];
  proposed: InterventionTradeFact | null;
  selectedMode: TradingRiskMode;
  safeBufferMinor: MoneyMinor | null;
  currentMinuteLocal: number | null;
  allowedSessionMinutes?: Array<{ id: string; start: number; end: number }>;
  profitLockReached: boolean;
  killSwitchActive: boolean;
  recoveryModeActive: boolean;
  weeklyLossRemainingMinor?: MoneyMinor | null;
};

/** Deterministic behavioural guardrails; never asserts motive or intent. */
export function assessSmartInterventions(input: SmartInterventionInput): SmartIntervention[] {
  if (!input.plan || !input.proposed) return [];
  const interventions: SmartIntervention[] = [];
  const prior = input.completedTrades;
  const losses = consecutiveLosses(prior);
  const proposedNumber = prior.length + 1;
  const rule = (id: string | null) => id;
  const block = (id: string, title: string, reason: string, math: string, action: string, related: string[] = []): void => { interventions.push({ id, severity: "block", title, reason, mathematicalConsequence: math, recommendedAction: action, blocking: true, ruleId: rule(id), relatedTradeIds: related, overrideEligible: false }); };
  const warn = (id: string, title: string, reason: string, math: string, action: string, related: string[] = []): void => { interventions.push({ id, severity: "warning", title, reason, mathematicalConsequence: math, recommendedAction: action, blocking: false, ruleId: rule(id), relatedTradeIds: related, overrideEligible: true }); };

  if (input.killSwitchActive) block("kill_switch", "Stop Trading", "Your Personal Kill Switch is active.", "Recommended size is 0 until you deliberately reset it.", "Stop for today.");
  if (input.profitLockReached) block("profit_lock", "Profit lock reached", "Today’s configured profit lock has been reached.", "Another trade can reduce protected profit.", "Stop trading for today.");
  if (input.plan.stopAfterLosses != null && losses >= input.plan.stopAfterLosses) block("consecutive_losses", "Loss stop reached", `The plan stops after ${input.plan.stopAfterLosses} consecutive losses.`, `This would be trade #${proposedNumber} after ${losses} losses.`, "Stop for today.", prior.slice(-losses).map((trade) => trade.id));
  if (proposedNumber > input.plan.maximumTrades) block("trade_count", "Trade count exceeds plan", `You planned a maximum of ${input.plan.maximumTrades} trades.`, `This would be trade #${proposedNumber}.`, "Stop or create a new plan tomorrow.", prior.map((trade) => trade.id));
  if (input.weeklyLossRemainingMinor != null && input.proposed.riskMinor >= input.weeklyLossRemainingMinor) block("weekly_loss", "Weekly loss limit", "The proposed risk can consume the remaining weekly Live buffer.", `Weekly room after a loss: $${Math.max(0, input.weeklyLossRemainingMinor - input.proposed.riskMinor) / 100}.`, "Do not take this trade.");
  if (input.recoveryModeActive && input.proposed.riskMinor > input.plan.riskPerTradeMinor) block("recovery_mode", "Recovery Mode risk increase", "Recovery Mode does not permit increasing risk above the frozen plan.", `Proposed risk exceeds plan by $${(input.proposed.riskMinor - input.plan.riskPerTradeMinor) / 100}.`, "Use the plan size or wait.");
  if (input.safeBufferMinor != null && input.proposed.riskMinor > input.safeBufferMinor) block("hard_risk_room", "Hard risk limit", "The proposed risk exceeds the remaining safe buffer.", `Projected buffer after loss: $${(input.safeBufferMinor - input.proposed.riskMinor) / 100}.`, "Do not take this trade.");
  if (!isAllowedTime(input.currentMinuteLocal, input.allowedSessionMinutes)) block("allowed_session", "Outside allowed session", "The planned entry is outside the configured session.", "Session compliance would fail.", "Wait for an allowed session.");
  if (input.selectedMode === "gambler" && (input.safeBufferMinor == null || input.safeBufferMinor < input.plan.riskPerTradeMinor * 2)) block("gambler_buffer", "High Risk buffer insufficient", "Gambler mode requires two planned-risk units of safe buffer.", `Safe buffer: $${(input.safeBufferMinor ?? 0) / 100}.`, "Select Balanced or wait for more buffer.");
  const last = prior.at(-1);
  if (last && last.realizedPnlMinor < 0 && input.proposed.contracts > last.contracts) warn("size_after_loss", "Size increased after a loss", "The proposed position is larger than the last losing trade.", `Contracts: ${last.contracts} → ${input.proposed.contracts}.`, "Return to the frozen plan size.", [last.id]);
  if (losses >= 2 && last && last.realizedPnlMinor < 0 && input.proposed.contracts > last.contracts) warn("possible_revenge_pattern", "Possible revenge-trading pattern", "Two losses were followed by a rapid, larger proposed trade.", `This would be trade #${proposedNumber} after ${losses} consecutive losses.`, "Pause and use the planned size only.", prior.slice(-2).map((trade) => trade.id));
  if (input.proposed.riskMinor > input.plan.riskPerTradeMinor) warn("buffer_consumption", "Risk exceeds today’s plan", "The proposed risk is above the frozen per-trade plan.", `Proposed risk is $${(input.proposed.riskMinor - input.plan.riskPerTradeMinor) / 100} above plan.`, "Use the recommended size.");
  return interventions;
}
function consecutiveLosses(trades: InterventionTradeFact[]): number { let n = 0; for (const trade of [...trades].reverse()) { if (trade.realizedPnlMinor >= 0) break; n += 1; } return n; }
function isAllowedTime(minute: number | null, sessions: SmartInterventionInput["allowedSessionMinutes"]): boolean { if (!sessions?.length) return true; if (minute == null) return false; return sessions.some((s) => s.start <= s.end ? minute >= s.start && minute <= s.end : minute >= s.start || minute <= s.end); }
