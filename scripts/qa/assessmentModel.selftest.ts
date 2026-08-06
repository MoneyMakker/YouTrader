import { calculateAssessmentResult, ASSESSMENT_MODEL_VERSION, type AssessmentAnswers } from "../../src/acquisition/assessmentModel";
import { resolveAcquisitionPhase } from "../../src/app/startup/acquisitionState";

let failures = 0;
function check(name: string, condition: boolean) {
  if (condition) console.log(`PASS  ${name}`);
  else { failures += 1; console.error(`FAIL  ${name}`); }
}

const disciplined: AssessmentAnswers = {
  propFirm: "ftmo", accountSize: "medium", challengeStage: "midway", previousAttempts: "none",
  failurePattern: "unknown", riskPerTrade: "lowRisk", tradesPerDay: "oneToTwo", stopLossBehavior: "never",
};
const risky: AssessmentAnswers = {
  ...disciplined, failurePattern: "overtrading", riskPerTrade: "highRisk", tradesPerDay: "moreThanTen", stopLossBehavior: "remove", previousAttempts: "fourPlus",
};

const first = calculateAssessmentResult(disciplined);
const second = calculateAssessmentResult(disciplined);
const risk = calculateAssessmentResult(risky);

check("model version is explicit", first.modelVersion === ASSESSMENT_MODEL_VERSION);
check("same answers are deterministic", JSON.stringify(first) === JSON.stringify(second));
check("scores stay within 0–100", [first, risk].every((r) => [r.overallReadiness, r.riskControl, r.discipline, r.challengeBuffer].every((v) => v >= 0 && v <= 100)));
check("risk answer changes readiness", first.overallReadiness !== risk.overallReadiness);
check("risk answer changes primary insight", first.insightKey !== risk.insightKey);
check("risk answer changes Prop Pass benefits", first.propPassBenefitKeys.join() !== risk.propPassBenefitKeys.join());
check("anonymous funnel reaches assessment intro without login", resolveAcquisitionPhase({
  hydrated: true, onboardingCompleted: false, paywallCompleted: false, authRequired: false,
  hasSession: false, isPremium: false, revenueCatReady: true, funnelPhase: "assessment_intro",
}) === "assessment_intro");
check("anonymous funnel reaches purchase paywall without login", resolveAcquisitionPhase({
  hydrated: true, onboardingCompleted: true, paywallCompleted: false, authRequired: false,
  hasSession: false, isPremium: false, revenueCatReady: true, funnelPhase: "purchase_paywall",
}) === "purchase_paywall");
check("existing authenticated user bypasses assessment", resolveAcquisitionPhase({
  hydrated: true, onboardingCompleted: false, paywallCompleted: false, authRequired: false,
  hasSession: true, isPremium: true, revenueCatReady: true, funnelPhase: "assessment_intro",
}) === "main");

if (failures) process.exit(1);
console.log("assessment-model: all checks passed");
