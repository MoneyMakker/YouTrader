import { t } from "./index";

type DetectiveAgentFinding = {
  finding: string;
  evidence: string;
  action: string;
};

type LocalCoachStats = {
  count: number;
  wr: number;
  pf: number;
  exp: number;
  pnl: number;
  maxDd: number;
  avgLossStreak: number;
  session: { label: string }[];
  weekday: { label: string }[];
  bySetup: { label: string }[];
};

type LocalCoachResult = {
  mistakes: Array<{ title: string; explanation: string; evidence: string; fix: string }>;
  strengths: Array<{ title: string; explanation: string; evidence: string; howToUse: string }>;
  recommendations: Array<{ title: string; action: string; why: string }>;
  summary: string;
  detectiveScore: number;
  mainBlindSpot: { title: string; evidence: string; whyItMatters: string; action: string };
  hiddenPatterns: Array<{ title: string; evidence: string; confidence: string; impact: string; action: string }>;
  agentFindings: Record<string, DetectiveAgentFinding>;
  nextTradingRule: string;
  disclaimer: string;
};

function agent(finding: string, evidence: string, action: string): DetectiveAgentFinding {
  return { finding, evidence, action };
}

export function buildLocalizedLocalCoachAnalysis(
  stats: LocalCoachStats,
  patterns: string[],
  moneyCompact: (value: number) => string,
  lowToHighPerformance: (groups: { label: string }[]) => { label: string }[],
): LocalCoachResult {
  const weakestSession = lowToHighPerformance(stats.session)[0]?.label || t("localCoachWeakestSession");
  const bestSession = stats.session[0]?.label || t("localCoachBestSession");
  const weakestDay = lowToHighPerformance(stats.weekday)[0]?.label || t("localCoachWeakestDay");
  const sampleConfidence = stats.count >= 20 ? "medium" : "low";
  const detectiveScore = Math.max(20, Math.min(88, Math.round(50 + stats.wr * 0.18 + Math.min(stats.pf, 4) * 7 + (stats.exp > 0 ? 8 : -8))));
  const bestSymbol = stats.bySetup[0]?.label || t("localCoachNotClearYet");

  return {
    mistakes: [
      {
        title: stats.pf < 1 ? t("localCoachMistake1TitleLowPf") : t("localCoachMistake1TitleProtect"),
        explanation: stats.pf < 1 ? t("localCoachMistake1ExplainLowPf") : t("localCoachMistake1ExplainFilter"),
        evidence: t("localCoachMistake1Evidence", { pf: stats.pf.toFixed(2), count: stats.count }),
        fix: t("localCoachMistake1Fix"),
      },
      {
        title: stats.exp < 0 ? t("localCoachMistake2TitleNegExp") : t("localCoachMistake2TitleReview", { session: weakestSession }),
        explanation:
          stats.exp < 0 ? t("localCoachMistake2ExplainNegExp") : t("localCoachMistake2ExplainWeak", { session: weakestSession }),
        evidence: t("localCoachMistake2Evidence", { exp: moneyCompact(stats.exp), session: weakestSession }),
        fix: t("localCoachMistake2Fix", { session: weakestSession }),
      },
      {
        title: patterns.includes("multi_loss_streaks")
          ? t("localCoachMistake3TitleStreak")
          : t("localCoachMistake3TitleWeakDay", { day: weakestDay }),
        explanation: patterns.includes("multi_loss_streaks")
          ? t("localCoachMistake3ExplainStreak")
          : t("localCoachMistake3ExplainWeakDay", { day: weakestDay }),
        evidence: t("localCoachMistake3Evidence", { streak: stats.avgLossStreak.toFixed(1), day: weakestDay }),
        fix: t("localCoachMistake3Fix"),
      },
    ],
    strengths: [
      {
        title: stats.wr >= 50 ? t("localCoachStrength1TitleWr") : t("localCoachStrength1TitleBuilding"),
        explanation:
          stats.wr >= 50
            ? t("localCoachStrength1ExplainWr", { wr: stats.wr.toFixed(0) })
            : t("localCoachStrength1ExplainBuilding"),
        evidence: t("localCoachStrength1Evidence", { wr: stats.wr.toFixed(0), count: stats.count }),
        howToUse: t("localCoachStrength1HowTo"),
      },
      {
        title: stats.exp > 0 ? t("localCoachStrength2TitlePosExp") : t("localCoachStrength2TitleRisk"),
        explanation:
          stats.exp > 0
            ? t("localCoachStrength2ExplainPosExp", { exp: moneyCompact(stats.exp) })
            : t("localCoachStrength2ExplainRisk"),
        evidence: t("localCoachStrength2EvidenceExp", { exp: moneyCompact(stats.exp) }),
        howToUse: t("localCoachStrength2HowTo"),
      },
      {
        title: t("localCoachStrength3Title", { session: bestSession }),
        explanation: t("localCoachStrength3Explain", { session: bestSession }),
        evidence: t("localCoachStrength3Evidence", { session: bestSession }),
        howToUse: t("localCoachStrength3HowTo", { session: bestSession }),
      },
    ],
    recommendations: [
      {
        title: t("localCoachRec1Title"),
        action: t("localCoachRec1Action"),
        why: t("localCoachRec1Why"),
      },
      {
        title: t("localCoachRec2Title"),
        action: t("localCoachRec2Action", { session: bestSession }),
        why: t("localCoachRec2Why", { session: bestSession }),
      },
      {
        title: t("localCoachRec3Title"),
        action: t("localCoachRec3Action"),
        why: t("localCoachRec3Why"),
      },
    ],
    summary: t("localCoachSummary"),
    detectiveScore,
    mainBlindSpot: {
      title:
        stats.exp < 0
          ? t("localCoachBlindSpotTitleNegExp")
          : t("localCoachBlindSpotTitleFilter", { session: weakestSession }),
      evidence: t("localCoachBlindSpotEvidence", {
        exp: moneyCompact(stats.exp),
        pf: stats.pf.toFixed(2),
        count: stats.count,
      }),
      whyItMatters: t("localCoachBlindSpotWhy"),
      action:
        stats.exp < 0
          ? t("localCoachBlindSpotActionNegExp")
          : t("localCoachBlindSpotActionFilter", { session: weakestSession }),
    },
    hiddenPatterns: [
      {
        title: t("localCoachPatternWeakSession", { session: weakestSession }),
        evidence: t("localCoachPatternWeakSessionEvidence", { session: weakestSession }),
        confidence: sampleConfidence,
        impact: "medium",
        action: t("localCoachPatternWeakSessionAction", { session: weakestSession }),
      },
      {
        title: t("localCoachPatternWeakDay", { day: weakestDay }),
        evidence: t("localCoachPatternWeakDayEvidence", { day: weakestDay }),
        confidence: sampleConfidence,
        impact: "medium",
        action: t("localCoachPatternWeakDayAction", { day: weakestDay }),
      },
      {
        title: stats.exp > 0 ? t("localCoachPatternExpPosTitle") : t("localCoachPatternExpNegTitle"),
        evidence: t("localCoachPatternExpEvidence", { exp: moneyCompact(stats.exp) }),
        confidence: sampleConfidence,
        impact: stats.exp > 0 ? "medium" : "high",
        action: stats.exp > 0 ? t("localCoachPatternExpActionPos") : t("localCoachPatternExpActionNeg"),
      },
    ],
    agentFindings: {
      riskAgent: agent(
        t("localCoachAgentRiskFinding"),
        t("localCoachAgentRiskEvidence", { dd: moneyCompact(stats.maxDd) }),
        t("localCoachAgentRiskAction"),
      ),
      disciplineAgent: agent(
        t("localCoachAgentDiscFinding"),
        t("localCoachAgentDiscEvidence", { streak: stats.avgLossStreak.toFixed(1) }),
        t("localCoachAgentDiscAction"),
      ),
      propFirmAgent: agent(
        t("localCoachAgentPropFinding"),
        t("localCoachAgentPropEvidence", { pnl: moneyCompact(stats.pnl) }),
        t("localCoachAgentPropAction"),
      ),
      sessionAgent: agent(
        t("localCoachAgentSessionFinding", { session: bestSession }),
        t("localCoachAgentSessionEvidence", { session: bestSession }),
        t("localCoachAgentSessionAction", { session: bestSession }),
      ),
      psychologyAgent: agent(
        t("localCoachAgentPsychFinding"),
        t("localCoachAgentPsychEvidence"),
        t("localCoachAgentPsychAction"),
      ),
      instrumentAgent: agent(
        t("localCoachAgentInstrFinding"),
        t("localCoachAgentInstrEvidence", { symbol: bestSymbol }),
        t("localCoachAgentInstrAction"),
      ),
      streakAgent: agent(
        t("localCoachAgentStreakFinding"),
        t("localCoachAgentDiscEvidence", { streak: stats.avgLossStreak.toFixed(1) }),
        t("localCoachAgentStreakAction"),
      ),
      executionAgent: agent(
        t("localCoachAgentExecFinding"),
        t("localCoachAgentExecEvidence"),
        t("localCoachAgentExecAction"),
      ),
      consistencyAgent: agent(
        t("localCoachAgentConsFinding"),
        t("localCoachAgentConsEvidence", { wr: stats.wr.toFixed(0), pf: stats.pf.toFixed(2) }),
        t("localCoachAgentConsAction"),
      ),
    },
    nextTradingRule: t("localCoachNextRule"),
    disclaimer: t("localCoachDisclaimer"),
  };
}
