export const ASSESSMENT_MODEL_VERSION = "assessment_model_v1" as const;

export type AssessmentQuestionId =
  | "propFirm"
  | "accountSize"
  | "challengeStage"
  | "previousAttempts"
  | "failurePattern"
  | "riskPerTrade"
  | "tradesPerDay"
  | "stopLossBehavior";

export type AssessmentAnswers = Partial<Record<AssessmentQuestionId, string>>;

export type AssessmentResult = {
  modelVersion: typeof ASSESSMENT_MODEL_VERSION;
  overallReadiness: number;
  riskControl: number;
  discipline: number;
  challengeBuffer: number;
  riskLevel: "low" | "moderate" | "high";
  primaryRisk: AssessmentAnswers["failurePattern"] | "unknown";
  insightKey: string;
  explanationKey: string;
  propPassBenefitKeys: string[];
};

export const ASSESSMENT_QUESTION_IDS: AssessmentQuestionId[] = [
  "propFirm",
  "accountSize",
  "challengeStage",
  "previousAttempts",
  "failurePattern",
  "riskPerTrade",
  "tradesPerDay",
  "stopLossBehavior",
];

const failureWeights: Record<string, number> = {
  dailyLoss: 42,
  overtrading: 48,
  revenge: 52,
  movingStops: 55,
  oversizing: 58,
  inconsistent: 36,
  targetPressure: 32,
  unknown: 30,
};

const stopLossWeights: Record<string, number> = {
  never: 92,
  occasionally: 66,
  often: 38,
  remove: 18,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function optionScore(value: string | undefined, scores: Record<string, number>, fallback: number): number {
  return value && scores[value] !== undefined ? scores[value] : fallback;
}

export function calculateAssessmentResult(answers: AssessmentAnswers): AssessmentResult {
  const stopLoss = optionScore(answers.stopLossBehavior, stopLossWeights, 55);
  const failure = optionScore(answers.failurePattern, failureWeights, 30);
  const risk = optionScore(answers.riskPerTrade, { lowRisk: 88, mediumRisk: 64, highRisk: 34 }, 55);
  const frequency = optionScore(answers.tradesPerDay, { oneToTwo: 88, threeToFive: 66, sixToTen: 42, moreThanTen: 24 }, 55);
  const attempts = optionScore(answers.previousAttempts, { none: 82, one: 68, twoToThree: 52, fourPlus: 36 }, 58);
  const stage = optionScore(answers.challengeStage, { notStarted: 76, early: 68, midway: 62, nearTarget: 74, funded: 82 }, 60);
  const account = optionScore(answers.accountSize, { small: 58, medium: 66, large: 72 }, 60);
  const firm = optionScore(answers.propFirm, { ftmo: 68, topstep: 70, fundedNext: 66, other: 58 }, 58);

  const riskControl = clamp(stopLoss * 0.45 + risk * 0.4 + (100 - failure) * 0.15);
  const discipline = clamp(frequency * 0.4 + attempts * 0.25 + (100 - failure) * 0.35);
  const challengeBuffer = clamp(account * 0.32 + stage * 0.28 + firm * 0.15 + stopLoss * 0.25);
  const overallReadiness = clamp(riskControl * 0.4 + discipline * 0.35 + challengeBuffer * 0.25);
  const riskLevel = overallReadiness < 50 ? "high" : overallReadiness < 72 ? "moderate" : "low";
  const primaryRisk = answers.failurePattern || "unknown";

  const insightKey = primaryRisk === "overtrading"
    ? "assessment.result.insight.overtrading"
    : primaryRisk === "revenge"
      ? "assessment.result.insight.revenge"
      : primaryRisk === "movingStops"
        ? "assessment.result.insight.movingStops"
        : primaryRisk === "oversizing"
          ? "assessment.result.insight.oversizing"
          : "assessment.result.insight.default";

  const explanationKey = primaryRisk === "dailyLoss"
    ? "assessment.result.explanation.dailyLoss"
    : primaryRisk === "overtrading"
      ? "assessment.result.explanation.overtrading"
      : primaryRisk === "movingStops"
        ? "assessment.result.explanation.movingStops"
        : primaryRisk === "oversizing"
          ? "assessment.result.explanation.oversizing"
          : "assessment.result.explanation.default";

  const benefitMap: Record<string, string[]> = {
    dailyLoss: ["assessment.benefit.buffer", "assessment.benefit.dailyLimit", "assessment.benefit.target"],
    overtrading: ["assessment.benefit.overtrading", "assessment.benefit.cooldown", "assessment.benefit.decisions"],
    revenge: ["assessment.benefit.cooldown", "assessment.benefit.decisions", "assessment.benefit.dailyLimit"],
    movingStops: ["assessment.benefit.invalidation", "assessment.benefit.dailyLimit", "assessment.benefit.decisions"],
    oversizing: ["assessment.benefit.risk", "assessment.benefit.buffer", "assessment.benefit.target"],
    inconsistent: ["assessment.benefit.decisions", "assessment.benefit.risk", "assessment.benefit.target"],
    targetPressure: ["assessment.benefit.target", "assessment.benefit.buffer", "assessment.benefit.cooldown"],
    unknown: ["assessment.benefit.risk", "assessment.benefit.buffer", "assessment.benefit.decisions"],
  };

  return {
    modelVersion: ASSESSMENT_MODEL_VERSION,
    overallReadiness,
    riskControl,
    discipline,
    challengeBuffer,
    riskLevel,
    primaryRisk,
    insightKey,
    explanationKey,
    propPassBenefitKeys: benefitMap[primaryRisk] || benefitMap.unknown,
  };
}
