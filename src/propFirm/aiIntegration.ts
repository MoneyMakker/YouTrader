import type { PropContext } from "../ai/aiInsightEngine";
import type { PropRiskEngineResult } from "./types";
import { mapPhaseToLegacyMode } from "./userSettings";

export function buildAiPropContextFromEngine(
  result: PropRiskEngineResult,
  passProbability?: number,
): PropContext {
  const mode = mapPhaseToLegacyMode(result.phase);
  const topWarning = result.emergencyAlerts[0] || result.ruleWarnings[0];
  return {
    mode,
    status: result.status,
    statusColor: result.statusColor,
    templateLabel: result.template.label,
    company: result.template.company,
    dailyRemaining: result.dailyRemaining,
    accountRemaining: result.accountRemaining,
    remainingToPass: result.remainingToPass,
    dailyLossLimit: result.template.dailyLossLimit,
    maxLossLimit: result.remainingDrawdown.limit,
    passProbability: passProbability ?? result.riskForecast.survivalProbability,
    bufferPct: result.bufferPct,
    accountHealthScore: result.accountHealthScore,
    primaryAction: result.primaryAction,
    coachMessage: result.coachMessage,
    contractRecommendation: result.contractRecommendation,
    payoutReady: result.payoutReadiness.ready,
    trailingDrawdownTightening: result.remainingDrawdown.tightening,
    topWarningTitle: topWarning?.title,
    topWarningBody: topWarning?.body,
    engineWarningIds: [...result.emergencyAlerts, ...result.ruleWarnings].map((w) => w.id),
  };
}

export function dedupePropAdvice(
  baseText: string,
  engine: PropRiskEngineResult | null | undefined,
): string {
  if (!engine) return baseText;
  const normalized = baseText.toLowerCase();
  if (engine.coachMessage && normalized.includes(engine.coachMessage.slice(0, 24).toLowerCase())) {
    return baseText;
  }
  if (engine.status === "STOP" && /stop trading today/i.test(baseText)) {
    return engine.coachMessage;
  }
  return baseText;
}
