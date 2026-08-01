import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { BrainCircuit, Camera, Check, ImagePlus, Sparkles } from "lucide-react-native";
import { t } from "../../i18n";
import { fetchAITradeVisionReview, type AITradeVisionReview } from "../../api/aiCoach";
import { hashLocalAiInput, localAiCacheKey, readLocalAiResponse, writeLocalAiResponse } from "../../utils/localAiResponseCache";
import { lightHaptic, successHaptic, warningHaptic } from "../../components/ui/haptics";
import { AnimatedPressable, EmptyStateCard } from "../../components/ui/premium";
import { trackEvent } from "../../observability/analytics";
import { logger } from "../../lib/logger";
import { WarningCard } from "../ui/WarningCard";
import { C } from "../theme";
import { styles } from "../styles";
import {
  incrementMonthlyUsageCount,
  monthlyUsageStorageKey,
} from "../utils/quota";
import { AiFlowRail, AiImageScan, AiIntelligencePulse } from "./animations";
import { truncateCoachLine } from "./propCoach";
import { AiOsTextBlock, MetricPillRow, TerminalGlassCard } from "./sharedUi";

export const TRADE_VISION_MONTHLY_LIMIT = 25;

export const TRADE_VISION_USAGE_KEY = "trade-vision-reviews";

export const TRADE_VISION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const TRADE_VISION_PROMPTS = [

  { label: "Entry valid?", question: "Was my entry valid?" },

  { label: "Stop logical?", question: "Was my stop logical?" },

  { label: "A+ setup?", question: "Is this an A+ setup?" },

  { label: "Did I chase?", question: "Did I chase?" },

  { label: "Better entry?", question: "Where was the better entry?" },

  { label: "Better stop?", question: "Where should my stop have been?" },

  { label: "Risk too high?", question: "Was my risk too high?" },

  { label: "Would you take it?", question: "Would you take this trade?" },

  { label: "What to fix?", question: "What should I fix next time?" },

] as const;

export const TRADE_VISION_THINKING_STEPS = [

  "Analyzing market structure...",

  "Reviewing entry...",

  "Checking risk management...",

  "Comparing with your journal...",

  "Building coach response...",

];

export type TradeVisionUiState = "empty" | "image_selected" | "loading" | "result" | "error" | "limit_reached";
export type TradeVisionDetail = "entry" | "stop" | "rr" | "mistake" | "alternative" | "evidence" | "journal";

export function tradeVisionMimeFromUri(uri: string, fallback?: string | null) {
  if (fallback && /^image\/(jpeg|png|webp)$/i.test(fallback)) return fallback.toLowerCase();
  const clean = uri.toLowerCase().split("?")[0];
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function tradeVisionAnalysisKey(imageUri: string, imageBase64: string, question: string) {
  return hashLocalAiInput({ imageUri, imageBase64, question: question.trim().toLowerCase() });
}

export function TradeVisionCoachSection({
  userId,
  journalContext,
}: {
  userId: string | null;
  journalContext?: Record<string, unknown>;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");
  const [question, setQuestion] = useState("");
  const [used, setUsed] = useState(0);
  const [uiState, setUiState] = useState<TradeVisionUiState>("empty");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<AITradeVisionReview | null>(null);
  const [openDetail, setOpenDetail] = useState<TradeVisionDetail | null>(null);
  const [thinkingStep, setThinkingStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const limitReached = used >= TRADE_VISION_MONTHLY_LIMIT;
  const canAnalyze = !!imageUri && !!imageBase64 && !!question.trim() && !limitReached && uiState !== "loading";

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(monthlyUsageStorageKey(TRADE_VISION_USAGE_KEY, userId)).then((raw) => {
      if (!mounted) return;
      const count = Number(raw || "0");
      const nextUsed = Number.isFinite(count) ? count : 0;
      setUsed(nextUsed);
      if (nextUsed >= TRADE_VISION_MONTHLY_LIMIT) {
        setUiState("limit_reached");
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (uiState !== "loading") {
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      return;
    }
    setThinkingStep(0);
    const progress = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(progressAnim, { toValue: 0, duration: 500, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
    );
    progress.start();
    const statusTimer = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % TRADE_VISION_THINKING_STEPS.length);
    }, 520);
    return () => {
      clearInterval(statusTimer);
      progress.stop();
    };
  }, [progressAnim, uiState]);

  const pickTradeVisionImage = async (source: "camera" | "library" = "library") => {
    if (limitReached) {
      setUiState("limit_reached");
      return;
    }
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setUiState("error");
        setMessage(source === "camera" ? t("cameraPermissionNeeded") : t("photoPermissionNeeded"));
        return;
      }
      const pickerOptions = { quality: 0.58, allowsEditing: false, base64: true } as const;
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri || !asset.base64) {
        setUiState("error");
        setMessage("Could not prepare that image for AI review. Try a JPG, PNG, or WebP screenshot.");
        return;
      }
      setImageUri(asset.uri);
      setImageBase64(asset.base64);
      setImageMimeType(tradeVisionMimeFromUri(asset.uri, asset.mimeType));
      setAnalysis(null);
      setOpenDetail(null);
      setUiState("image_selected");
      setMessage("");
    } catch {
      setUiState("error");
      setMessage("Could not load that screenshot. Try a JPG, PNG, or WebP image.");
    }
  };

  const selectPrompt = (prompt: string) => {
    setQuestion(prompt);
    if (imageUri && !limitReached) setUiState("image_selected");
    setMessage("");
  };

  const handleAnalyze = async () => {
    if (limitReached) {
      setUiState("limit_reached");
      return;
    }
    if (!canAnalyze) return;
    lightHaptic();
    setUiState("loading");
    setMessage("");
    const analysisKey = tradeVisionAnalysisKey(imageUri, imageBase64, question);
    try {
      const cacheKey = localAiCacheKey("trade-vision", userId, analysisKey);
      const cached = await readLocalAiResponse<AITradeVisionReview>(cacheKey);
      if (cached) {
        setAnalysis(cached);
        setMessage("Showing cached review for this screenshot and question.");
        setUiState("result");
        successHaptic();
        return;
      }
      const response = await fetchAITradeVisionReview({
        question: question.trim(),
        imageBase64,
        imageMimeType,
        journalContext: journalContext || {},
      });
      if (response.usedFallback || response.providerStatus === "local_fallback" || response.providerStatus === "free_preview") {
        setUiState("error");
        setMessage(response.message || "AI Trade Analysis is unavailable right now. No review was used.");
        warningHaptic();
        return;
      }
      setAnalysis(response.data);
      await writeLocalAiResponse(cacheKey, response.data, TRADE_VISION_CACHE_TTL_MS);
      const nextUsed = await incrementMonthlyUsageCount(TRADE_VISION_USAGE_KEY, userId);
      setUsed(nextUsed);
      setUiState("result");
      successHaptic();
      trackEvent("ai_trade_vision_review_completed", {
        provider_status: response.providerStatus,
        cached: false,
      });
    } catch (error) {
      logger.error(error, { feature: "ai_trade_analysis", action: "review_failed" });
      setUiState("error");
      setMessage("AI Trade Analysis could not review this image. No review was used.");
      warningHaptic();
    }
  };

  const resetQuestion = () => {
    setQuestion("");
    setMessage("");
    setAnalysis(null);
    setOpenDetail(null);
    setUiState(imageUri && !limitReached ? "image_selected" : limitReached ? "limit_reached" : "empty");
  };

  const progressScale = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 1],
  });
  const resultDetails: { key: TradeVisionDetail; label: string; items: string[] }[] = analysis
    ? [
        { key: "entry", label: "Entry", items: [analysis.entryQuality] },
        { key: "stop", label: "Stop", items: [analysis.stopPlacementFeedback] },
        { key: "rr", label: "Risk / Reward", items: [analysis.riskRewardFeedback] },
        { key: "mistake", label: "Mistake", items: [analysis.mistakeDetected] },
        { key: "alternative", label: "Alternative", items: [analysis.bestAlternativeAction] },
        { key: "evidence", label: "Evidence", items: analysis.evidenceFromImage },
        { key: "journal", label: "Journal", items: [analysis.journalBehaviorConnection] },
      ]
    : [];

  return (
    <TerminalGlassCard>
      <View style={styles.terminalHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.workflowNextLabel}>Screenshot coach</Text>
          <Text style={styles.coachCompactHeadline}>Trade Vision</Text>
          <Text style={styles.coachCompactSub}>Upload a trade and ask what happened.</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <AiIntelligencePulse tone={C.muted} />
          <Text style={styles.tradeMetaChip}>{used}/{TRADE_VISION_MONTHLY_LIMIT} REVIEWS</Text>
          <Text style={styles.terminalSmallLabel}>Uses 1 AI review</Text>
        </View>
      </View>

      {limitReached ? (
        <WarningCard
          title={`You used ${TRADE_VISION_MONTHLY_LIMIT}/${TRADE_VISION_MONTHLY_LIMIT} Trade Vision reviews this month`}
          body="Trade Vision reviews reset next month. No AI call will run while the monthly limit is reached."
        />
      ) : null}

      {imageUri ? (
        <View style={styles.tradeVisionSelectedArea}>
          <Image source={{ uri: imageUri }} style={styles.tradeVisionPreview} resizeMode="cover" />
          <AiImageScan active={uiState === "image_selected" || uiState === "loading"} />
          <View style={styles.tradeVisionImageOverlay}>
            <Check size={12} color={C.green} strokeWidth={3} />
            <Text style={styles.tradeVisionImageBadge}>Ready</Text>
          </View>
          <View style={styles.tradeVisionQuestionBox}>
            <Text style={styles.terminalSmallLabel}>Ask Coach</Text>
            <TextInput
              value={question}
              onChangeText={(value) => {
                setQuestion(value);
                if (!limitReached) setUiState("image_selected");
                setMessage("");
              }}
              placeholder="Ask what really happened on this trade..."
              placeholderTextColor={C.sub}
              multiline
              style={styles.tradeVisionInput}
            />
          </View>
        </View>
      ) : (
        <View style={styles.tradeVisionUploadHero}>
          <View style={styles.tradeVisionIconOrb}>
            <ImagePlus size={25} color={C.purple} strokeWidth={2.3} />
          </View>
          <Text style={styles.propCoachHeadline}>Select one trade screenshot</Text>
          <Text style={[styles.terminalSub, { textAlign: "center" }]}>Chart · DOM · Footprint · Execution</Text>
          <AiFlowRail nodes={["Entry", "Stop", "Risk", "Reward", "Execution", "Psychology", "Discipline"]} />
        </View>
      )}

      <View style={styles.tradeVisionPickActions}>
        <AnimatedPressable
          press="buttonPrimary"
          haptic
          onPress={() => pickTradeVisionImage("library")}
          disabled={limitReached || uiState === "loading"}
          style={styles.workflowPrimaryInStack}
          contentStyle={[styles.primaryBig, styles.tradeVisionResultButton, (limitReached || uiState === "loading") && styles.disabledBtn]}
          accessibilityRole="button"
          accessibilityLabel="Upload Screenshot"
        >
          <Text style={styles.primaryText} maxFontSizeMultiplier={1.25}>Upload Screenshot</Text>
        </AnimatedPressable>
        <AnimatedPressable
          press="buttonSecondary"
          haptic
          onPress={() => pickTradeVisionImage("camera")}
          disabled={limitReached || uiState === "loading"}
          style={styles.workflowSecondaryInStack}
          contentStyle={[styles.secondaryBig, styles.tradeVisionResultButton, (limitReached || uiState === "loading") && styles.disabledBtn]}
          accessibilityRole="button"
          accessibilityLabel="Take Photo"
        >
          <Text style={styles.secondaryText} maxFontSizeMultiplier={1.25}>Take Photo</Text>
        </AnimatedPressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tradeVisionChipScroller} contentContainerStyle={styles.tradeVisionChipRow}>
        {TRADE_VISION_PROMPTS.map((prompt) => {
          const active = question === prompt.question;
          return (
            <Pressable key={prompt.question} onPress={() => selectPrompt(prompt.question)} style={[styles.tradeVisionChip, active && styles.tradeVisionChipActive]}>
              <Text style={[styles.tradeVisionChipText, active && styles.tradeVisionChipTextActive]}>{prompt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {uiState === "loading" ? (
        <View style={styles.tradeVisionStatusBox}>
          <View style={styles.tradeVisionThinkingHeader}>
            <BrainCircuit size={18} color={C.green} strokeWidth={2.3} />
            <Text style={styles.terminalSmallLabel}>Trade Vision is thinking</Text>
          </View>
          <View style={styles.tradeVisionProgressTrack}>
            <Animated.View style={[styles.tradeVisionProgressFill, { transform: [{ scaleX: progressScale }] }]} />
          </View>
          <Text style={styles.tradeVisionThinkingText}>{TRADE_VISION_THINKING_STEPS[thinkingStep]}</Text>
        </View>
      ) : null}

      {uiState === "result" && analysis ? (
        <View style={styles.tradeVisionReadyCard}>
          <View style={styles.tradeVisionReadyTop}>
            <View style={styles.tradeVisionIconOrbSmall}>
              <Sparkles size={18} color={C.green} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.propCoachHeadline}>Trade review complete</Text>
              <Text style={styles.terminalSub}>{message || `Confidence: ${analysis.confidence}`}</Text>
            </View>
          </View>
          <MetricPillRow
            items={[
              { label: "Verdict", value: truncateCoachLine(analysis.verdict, 42), tone: "green" },
              ...(analysis.confidence ? [{ label: "Confidence", value: analysis.confidence, tone: String(analysis.confidence).toLowerCase().includes("high") ? "green" as const : "purple" as const }] : []),
            ]}
          />
          <View style={styles.tradeVisionNextAction}>
            <Text style={styles.terminalSmallLabel}>NEXT ACTION</Text>
            <Text style={[styles.coachCompactValue, { color: C.green, fontWeight: "600" }]} maxFontSizeMultiplier={1.3}>
              {analysis.bestAlternativeAction}
            </Text>
          </View>
          <View style={styles.tradeVisionDetailRail}>
            {resultDetails.map((detail) => {
              const active = openDetail === detail.key;
              return (
                <Pressable key={detail.key} onPress={() => setOpenDetail(active ? null : detail.key)} style={[styles.tradeVisionChip, active && styles.tradeVisionChipActive]}>
                  <Text style={[styles.tradeVisionChipText, active && styles.tradeVisionChipTextActive]}>{detail.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {openDetail ? (
            <AiOsTextBlock
              title={resultDetails.find((detail) => detail.key === openDetail)?.label || "Details"}
              items={resultDetails.find((detail) => detail.key === openDetail)?.items || []}
            />
          ) : null}
          <Text style={styles.coachCompactSub}>{analysis.coachNote}</Text>
          <View style={styles.tradeVisionResultActions}>
            <AnimatedPressable
              press="buttonSecondary"
              haptic
              onPress={() => pickTradeVisionImage("library")}
              style={styles.workflowSecondaryInStack}
              contentStyle={[styles.secondaryBig, styles.tradeVisionResultButton]}
              accessibilityRole="button"
              accessibilityLabel="Change Screenshot"
            >
              <Text style={styles.secondaryText} maxFontSizeMultiplier={1.25}>Change Screenshot</Text>
            </AnimatedPressable>
            <Pressable
              onPress={resetQuestion}
              style={styles.workflowGhostAction}
              accessibilityRole="button"
              accessibilityLabel="Ask Another Question"
            >
              <Text style={styles.workflowGhostText} maxFontSizeMultiplier={1.25}>Ask Another Question</Text>
            </Pressable>
          </View>
          <Text style={styles.terminalSub}>{analysis.educationalDisclaimer}</Text>
        </View>
      ) : null}

      {uiState === "error" && message ? (
        <WarningCard title="AI Trade Analysis unavailable" body={message} />
      ) : null}

      <Pressable
        disabled={!canAnalyze}
        onPress={handleAnalyze}
        style={[styles.primaryBig, !canAnalyze && styles.disabledBtn]}
      >
        <AiIntelligencePulse tone={canAnalyze ? C.green : C.sub} />
        <Text style={styles.primaryText}>{uiState === "loading" ? "Analyzing Trade" : "Analyze Trade"}</Text>
      </Pressable>
      <Text style={styles.terminalSub}>Sent only after Analyze.</Text>
    </TerminalGlassCard>
  );
}
