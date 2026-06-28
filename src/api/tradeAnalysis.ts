export type TradePerformanceBreakdown = { key: string; trades: number; wins: number; losses: number; winRate: number; netPnl: number; avgPnl: number; profitFactor: number; expectancy: number; avgWin: number; avgLoss: number; maxWin: number; maxLoss: number };
export type DetectiveAgentFinding = { finding: string; evidence: string; action: string };
export type AgentFindingKey = 'riskAgent' | 'disciplineAgent' | 'propFirmAgent' | 'sessionAgent' | 'psychologyAgent' | 'instrumentAgent' | 'streakAgent' | 'executionAgent' | 'consistencyAgent';
export type TradeAnalysisPayload = {
  period: 'day' | 'week' | 'month' | 'year'; totalTrades: number; totalPnl: number; winRate: number; profitFactor: number; expectancy: number; avgWin: number; avgLoss: number; maxWin: number; maxLoss: number; maxDrawdown: number; recoveryFactor: number; riskControl: number; consistency: number; tradingScore: number; propFirmSurvivalScore?: number; bestSymbol: string | null; worstSymbol: string | null; bestSession: string | null; worstSession: string | null; biggestMistakePatterns: string[]; tradesByDayOfWeek: TradePerformanceBreakdown[]; tradesBySession: TradePerformanceBreakdown[]; tradesByHour: TradePerformanceBreakdown[]; tradesByInstrument: TradePerformanceBreakdown[]; tradesByDirection: TradePerformanceBreakdown[]; tradesByMood: TradePerformanceBreakdown[]; streakBehavior: Record<string, unknown>; propFirmRuleData?: Record<string, unknown>; recentTrades: unknown[];
};
type AnalysisItem = { title: string; explanation: string; evidence?: string; fix?: string; howToUse?: string };
type Recommendation = { title: string; action: string; why?: string };
type HiddenPattern = { title: string; evidence: string; action: string; impact: 'low' | 'medium' | 'high'; confidence: 'low' | 'medium' | 'high' };
export type TradeAnalysisResult = { summary: string; disclaimer: string; mistakes: AnalysisItem[]; strengths: AnalysisItem[]; recommendations: Recommendation[]; detectiveScore: number; mainBlindSpot: { title: string; evidence: string; whyItMatters: string; action: string }; hiddenPatterns: HiddenPattern[]; agentFindings: Record<AgentFindingKey, DetectiveAgentFinding>; nextTradingRule: string };
function localResult(payload: TradeAnalysisPayload): TradeAnalysisResult {
  const weak = payload.worstSession || payload.worstSymbol || 'lowest-performing context';
  const strong = payload.bestSession || payload.bestSymbol || 'best-performing context';
  const score = Math.max(20, Math.min(92, Math.round(45 + payload.winRate * 0.18 + Math.min(payload.profitFactor, 3) * 9 + (payload.expectancy > 0 ? 8 : -8))));
  const agent = (finding: string, evidence: string, action: string): DetectiveAgentFinding => ({ finding, evidence, action });
  return {
    summary: `Analysis of ${payload.totalTrades} ${payload.period} trades: P&L ${payload.totalPnl.toFixed(0)}, win rate ${payload.winRate.toFixed(0)}%, profit factor ${payload.profitFactor.toFixed(2)}.`,
    disclaimer: 'Educational analysis only. Not financial advice.',
    mistakes: [
      { title: payload.profitFactor < 1 ? 'Profit factor below 1' : 'Protect weak contexts', explanation: payload.profitFactor < 1 ? 'Losses are currently larger than wins.' : `The weakest area is ${weak}.`, evidence: `PF ${payload.profitFactor.toFixed(2)}, expectancy ${payload.expectancy.toFixed(2)}.`, fix: 'Reduce size and only take checklist-perfect trades.' },
      { title: 'Drawdown pressure', explanation: 'Drawdown should be controlled before increasing size.', evidence: `Max drawdown ${payload.maxDrawdown.toFixed(0)}.`, fix: 'Set a daily stop and respect it.' },
    ],
    strengths: [
      { title: `Best edge: ${strong}`, explanation: 'This context currently contributes the strongest result.', evidence: `Best symbol/session: ${strong}.` },
      { title: 'Process data is building', explanation: `${payload.totalTrades} trades give the app enough journal data to surface patterns.` },
    ],
    recommendations: [
      { title: 'Trade smaller in weak contexts', action: `Cut risk in ${weak} until stats improve.`, why: 'Reducing exposure where edge is weakest protects the account curve.' },
      { title: 'Repeat the best setup', action: `Prioritize ${strong} and document screenshots/notes.`, why: 'The fastest improvement comes from repeating what already works.' },
    ],
    detectiveScore: score,
    mainBlindSpot: { title: payload.expectancy < 0 ? 'Negative expectancy' : `Weak context: ${weak}`, evidence: `Expectancy ${payload.expectancy.toFixed(2)}, worst area ${weak}.`, whyItMatters: 'Small leaks compound across a prop evaluation and reduce pass probability.', action: 'Create one written rule for this leak before the next trading session.' },
    hiddenPatterns: [
      { title: `Performance leak in ${weak}`, evidence: `Worst area detected from journal breakdown.`, action: 'Reduce size or skip this context for the next 10 trades.', impact: payload.expectancy < 0 ? 'high' : 'medium', confidence: payload.totalTrades >= 20 ? 'medium' : 'low' },
      { title: 'Risk buffer sensitivity', evidence: `Risk control score ${payload.riskControl.toFixed(0)}.`, action: 'Stop trading once daily loss threshold is hit.', impact: 'medium', confidence: 'medium' },
    ],
    agentFindings: {
      riskAgent: agent('Risk buffer is the key constraint', `Drawdown ${payload.maxDrawdown.toFixed(0)}.`, 'Keep fixed size and stop after rule breaks.'),
      disciplineAgent: agent('Checklist quality matters most', `${payload.totalTrades} trades reviewed.`, 'Write the reason before entry.'),
      propFirmAgent: agent('Survival before progress', `Pass score ${payload.propFirmSurvivalScore ?? 0}.`, 'Protect daily and account buffers.'),
      sessionAgent: agent(`Watch ${weak}`, `Worst session/symbol: ${weak}.`, 'Trade smaller in the weak context.'),
      psychologyAgent: agent('Mood data can expose tilt', 'Mood labels are included in the journal payload.', 'Log mood before and after every trade.'),
      instrumentAgent: agent(`Best instrument/context: ${strong}`, `Best area: ${strong}.`, 'Prioritize the instrument/context with positive expectancy.'),
      streakAgent: agent('Streak behavior reviewed', 'Recent trades and streak summaries are included.', 'Avoid increasing size after wins or losses.'),
      executionAgent: agent('Entry hour and direction reviewed', 'Hourly and direction breakdowns are included.', 'Only trade the windows with positive expectancy.'),
      consistencyAgent: agent('Consistency drives score', `Consistency ${payload.consistency.toFixed(0)}.`, 'Keep daily loss and trade count stable.'),
    },
    nextTradingRule: payload.expectancy < 0 ? 'No size increases until expectancy is positive over the next 10 trades.' : `Only trade ${strong} unless the checklist is fully satisfied.`,
  };
}
export async function analyzeTrades(payload: TradeAnalysisPayload): Promise<TradeAnalysisResult> {
  return localResult(payload);
}
