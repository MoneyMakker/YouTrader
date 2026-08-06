import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Lock, ShieldCheck, TrendingUp } from "lucide-react-native";
import type { AcquisitionPhase } from "./acquisitionState";
import {
  ASSESSMENT_MODEL_VERSION,
  ASSESSMENT_FUNNEL_PHASE_KEY,
  ASSESSMENT_QUESTION_IDS,
  calculateAssessmentResult,
  isAssessmentComplete,
  type AssessmentAnswers,
  type AssessmentQuestionId,
  type AssessmentResult,
} from "../../acquisition/assessmentModel";
import { C } from "../../theme/colors";
import { t } from "../../i18n";
import { trackEvent } from "../../observability/analytics";

const ANSWERS_KEY = "yt-assessment-answers-v1";
const RESULT_KEY = "yt-assessment-result-v1";
const QUESTION_INDEX_KEY = "yt-assessment-question-index-v1";

const QUESTION_OPTIONS: Record<AssessmentQuestionId, string[]> = {
  propFirm: ["ftmo", "topstep", "fundedNext", "other"],
  accountSize: ["small", "medium", "large"],
  challengeStage: ["notStarted", "early", "midway", "nearTarget", "funded"],
  previousAttempts: ["none", "one", "twoToThree", "fourPlus"],
  failurePattern: ["dailyLoss", "overtrading", "revenge", "movingStops", "oversizing", "inconsistent", "targetPressure", "unknown"],
  riskPerTrade: ["lowRisk", "mediumRisk", "highRisk"],
  tradesPerDay: ["oneToTwo", "threeToFive", "sixToTen", "moreThanTen"],
  stopLossBehavior: ["never", "occasionally", "often", "remove"],
};

const QUESTION_KEYS: Record<AssessmentQuestionId, string> = {
  propFirm: "assessment.question.propFirm",
  accountSize: "assessment.question.accountSize",
  challengeStage: "assessment.question.challengeStage",
  previousAttempts: "assessment.question.previousAttempts",
  failurePattern: "assessment.question.failurePattern",
  riskPerTrade: "assessment.question.riskPerTrade",
  tradesPerDay: "assessment.question.tradesPerDay",
  stopLossBehavior: "assessment.question.stopLossBehavior",
};


type Props = {
  phase: AcquisitionPhase;
  onPhaseChange: (phase: AcquisitionPhase) => void;
  onOpenPaywall: (answers: AssessmentAnswers, result: AssessmentResult) => void;
  onExistingAuth: () => void;
};

function copy(key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

export function AssessmentFlowScreen({ phase, onPhaseChange, onOpenPaywall, onExistingAuth }: Props) {
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [analysisLine, setAnalysisLine] = useState(0);
  const restoredRef = useRef(false);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(ANSWERS_KEY),
      AsyncStorage.getItem(RESULT_KEY),
      AsyncStorage.getItem(QUESTION_INDEX_KEY),
    ]).then(([answersRaw, resultRaw, questionIndexRaw]) => {
      let restoredAnswers: AssessmentAnswers = {};
      if (answersRaw) {
        try {
          restoredAnswers = JSON.parse(answersRaw) as AssessmentAnswers;
          setAnswers(restoredAnswers);
        } catch { /* ignore malformed local progress */ }
      }
      if (resultRaw) {
        try {
          const restoredResult = JSON.parse(resultRaw) as AssessmentResult;
          setResult(restoredResult);
          restoredRef.current = true;
          onPhaseChange("assessment_result");
          return;
        } catch { /* ignore malformed result */ }
      }
      if (questionIndexRaw) {
        const restoredIndex = Number(questionIndexRaw);
        if (Number.isFinite(restoredIndex)) {
          setQuestionIndex(Math.max(0, Math.min(ASSESSMENT_QUESTION_IDS.length - 1, restoredIndex)));
          onPhaseChange("assessment_questions");
        }
      }
      if (Object.keys(restoredAnswers).length > 0) onPhaseChange("assessment_questions");
      restoredRef.current = true;
    });
  }, [onPhaseChange]);

  useEffect(() => {
    if (restoredRef.current) void AsyncStorage.setItem(ASSESSMENT_FUNNEL_PHASE_KEY, phase);
  }, [phase]);

  useEffect(() => {
    void AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    if (phase !== "assessment_analyzing") return;
    setAnalysisLine(0);
    const timers = [
      setTimeout(() => setAnalysisLine(1), 650),
      setTimeout(() => setAnalysisLine(2), 1300),
      setTimeout(() => {
        const next = calculateAssessmentResult(answers);
        setResult(next);
        void AsyncStorage.setItem(RESULT_KEY, JSON.stringify(next));
        trackEvent("assessment_completed", { model_version: ASSESSMENT_MODEL_VERSION });
        onPhaseChange("assessment_result");
      }, 2100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [answers, onPhaseChange, phase]);

  const currentQuestion = ASSESSMENT_QUESTION_IDS[questionIndex];
  const currentOptions = currentQuestion ? QUESTION_OPTIONS[currentQuestion] : [];
  const progress = `${questionIndex + 1} / ${ASSESSMENT_QUESTION_IDS.length}`;
  const benefits = useMemo(() => result?.propPassBenefitKeys || [], [result]);

  const chooseAnswer = (value: string) => {
    if (!currentQuestion) return;
    const next = { ...answers, [currentQuestion]: value };
    setAnswers(next);
    trackEvent("assessment_question_answered", { question: currentQuestion });
    void AsyncStorage.setItem(QUESTION_INDEX_KEY, String(questionIndex + 1));
    if (questionIndex === ASSESSMENT_QUESTION_IDS.length - 1 && isAssessmentComplete(next)) {
      onPhaseChange("assessment_analyzing");
    } else {
      setQuestionIndex((index) => index + 1);
    }
  };

  const back = () => {
    if (questionIndex > 0) setQuestionIndex((index) => index - 1);
    else onPhaseChange("assessment_intro");
  };

  const renderIntro = () => (
    <>
      <View style={styles.mark}><TrendingUp size={28} color={C.green} strokeWidth={2.2} /></View>
      <Text style={styles.eyebrow}>{copy("assessment.intro.eyebrow", "PROP CHALLENGE ASSESSMENT")}</Text>
      <Text style={styles.title}>{copy("assessment.intro.title", "Can You Pass Your Next Prop Challenge?")}</Text>
      <Text style={styles.body}>{copy("assessment.intro.body", "Take a 60-second assessment to uncover what could help—or prevent—you from reaching your profit target.")}</Text>
      <Pressable style={styles.primaryButton} onPress={() => { trackEvent("assessment_started", { model_version: ASSESSMENT_MODEL_VERSION }); onPhaseChange("assessment_questions"); }} testID="assessment-start">
        <Text style={styles.primaryLabel}>{copy("assessment.intro.cta", "Check My Pass Readiness")}</Text>
      </Pressable>
      <Pressable onPress={onExistingAuth} testID="assessment-existing-auth">
        <Text style={styles.secondaryLink}>{copy("assessment.intro.existing", "Already have an account? Sign in")}</Text>
      </Pressable>
      <View style={styles.privacyRow}><Lock size={14} color={C.muted} /><Text style={styles.privacy}>{copy("assessment.intro.privacy", "No login required. Your answers stay on this device until you choose to continue.")}</Text></View>
    </>
  );

  const renderQuestion = () => (
    <>
      <View style={styles.questionTop}>
        <Pressable onPress={back} accessibilityLabel={t("more.back")}><ChevronLeft size={24} color={C.text} /></Pressable>
        <Text style={styles.progress}>{progress}</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.eyebrow}>PASS READINESS CHECK</Text>
      <Text style={styles.questionTitle}>{t(QUESTION_KEYS[currentQuestion])}</Text>
      <View style={styles.options}>
        {currentOptions.map((option) => (
          <Pressable
            key={option}
            onPress={() => chooseAnswer(option)}
            style={[styles.option, answers[currentQuestion] === option && styles.optionSelected]}
            testID={`assessment-option-${option}`}
          >
            <Text style={[styles.optionLabel, answers[currentQuestion] === option && styles.optionLabelSelected]}>{t(`assessment.option.${option}`)}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const renderAnalysis = () => (
    <View style={styles.analysis}>
      <ActivityIndicator color={C.green} size="large" />
      <Text style={styles.analysisTitle}>{copy("assessment.analysis.title", "Building your Challenge Health")}</Text>
      <Text style={styles.analysisLine}>{[
        t("assessment.analysis.line1"),
        t("assessment.analysis.line2"),
        t("assessment.analysis.line3"),
      ][analysisLine]}</Text>
    </View>
  );

  const renderResult = () => (
    <>
      <Text style={styles.eyebrow}>YOUR PASS READINESS</Text>
      <Text style={styles.score}>{result?.overallReadiness ?? 0}</Text>
      <Text style={styles.scoreLabel}>Pass Readiness Score</Text>
      <Text style={styles.insightTitle}>{t(result?.insightKey || "assessment.result.insight.default")}</Text>
      <Text style={styles.body}>{t(result?.explanationKey || "assessment.result.explanation.default")}</Text>
      <View style={styles.metrics}>
        {["Risk Control", "Discipline", "Challenge Buffer"].map((label, index) => {
          const value = [result?.riskControl, result?.discipline, result?.challengeBuffer][index] || 0;
          return <View key={label} style={styles.metric}><Text style={styles.metricValue}>{value}%</Text><Text style={styles.metricLabel}>{label}</Text></View>;
        })}
      </View>
      <Pressable style={styles.primaryButton} onPress={() => { trackEvent("readiness_result_viewed", { model_version: ASSESSMENT_MODEL_VERSION }); onPhaseChange("prop_pass_preview"); }} testID="assessment-see-plan">
        <Text style={styles.primaryLabel}>See My Plan</Text>
      </Pressable>
    </>
  );

  const renderPreview = () => (
    <>
      <ShieldCheck size={34} color={C.green} strokeWidth={1.8} />
      <Text style={styles.title}>Your Prop Pass Plan Is Ready</Text>
      <Text style={styles.body}>{copy("assessment.preview.body", "You do not need more signals. You need a system that stops one emotional trade from damaging an otherwise passable challenge.")}</Text>
      <View style={styles.benefits}>
        {benefits.map((key) => <Text key={key} style={styles.benefit}>• {t(key)}</Text>)}
      </View>
      <Pressable style={styles.primaryButton} onPress={() => { if (result) { trackEvent("prop_pass_preview_viewed", { risk_category: result.primaryRisk }); onOpenPaywall(answers, result); } }} testID="assessment-unlock-prop-pass">
        <Text style={styles.primaryLabel}>Unlock My Prop Pass</Text>
      </Pressable>
    </>
  );

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {phase === "assessment_questions" ? renderQuestion()
          : phase === "assessment_analyzing" ? renderAnalysis()
            : phase === "assessment_result" ? renderResult()
              : phase === "prop_pass_preview" ? renderPreview()
                : renderIntro()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06080C" },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28, gap: 18 },
  mark: { width: 64, height: 64, borderRadius: 20, borderWidth: 1, borderColor: "rgba(163,255,18,0.25)", backgroundColor: "rgba(163,255,18,0.06)", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  eyebrow: { color: C.green, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textAlign: "center" },
  title: { color: C.text, fontSize: 34, lineHeight: 40, fontWeight: "800", textAlign: "center" },
  body: { color: C.sub, fontSize: 16, lineHeight: 23, fontWeight: "500", textAlign: "center" },
  primaryButton: { minHeight: 56, borderRadius: 17, backgroundColor: C.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 },
  primaryLabel: { color: "#05070A", fontSize: 16, fontWeight: "800" },
  secondaryLink: { color: C.sub, textAlign: "center", fontSize: 14, fontWeight: "700", paddingVertical: 12 },
  privacyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 8 },
  privacy: { color: C.muted, fontSize: 12, textAlign: "center" },
  questionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progress: { color: C.muted, fontSize: 13, fontWeight: "800" },
  questionTitle: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: "800", textAlign: "center", marginVertical: 24 },
  options: { gap: 10 },
  option: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)", justifyContent: "center", paddingHorizontal: 18 },
  optionSelected: { borderColor: C.green, backgroundColor: "rgba(163,255,18,0.10)" },
  optionLabel: { color: C.text, fontSize: 16, fontWeight: "700" },
  optionLabelSelected: { color: C.green },
  analysis: { alignItems: "center", gap: 20 },
  analysisTitle: { color: C.text, fontSize: 26, fontWeight: "800", textAlign: "center" },
  analysisLine: { color: C.sub, fontSize: 16, textAlign: "center" },
  score: { color: C.green, fontSize: 76, lineHeight: 84, fontWeight: "900", textAlign: "center" },
  scoreLabel: { color: C.muted, fontSize: 13, fontWeight: "800", textAlign: "center", letterSpacing: 0.8 },
  insightTitle: { color: C.text, fontSize: 21, lineHeight: 27, fontWeight: "800", textAlign: "center", marginTop: 10 },
  metrics: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginVertical: 12 },
  metric: { flex: 1, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 12, alignItems: "center" },
  metricValue: { color: C.text, fontSize: 20, fontWeight: "800" },
  metricLabel: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 4 },
  benefits: { gap: 12, marginVertical: 10 },
  benefit: { color: C.sub, fontSize: 15, lineHeight: 21, fontWeight: "600" },
});
