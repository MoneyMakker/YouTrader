import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "../../theme/colors";
import { ydlSpace } from "../../ydl/space";
import { ydlTypography } from "../../ydl/typography";
import { PremiumCard, PremiumLoadingBar, ShimmerPlaceholder } from "../ui/premium";

const DEFAULT_STAGES = [
  "Analyzing your edge...",
  "Checking risk behavior...",
  "Reading trade patterns...",
  "Building performance report...",
  "Finalizing insights...",
];

type Props = {
  stages?: string[];
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AiAnalysisLoading({ stages = DEFAULT_STAGES, compact = false, style }: Props) {
  const safeStages = stages.length ? stages : DEFAULT_STAGES;
  const [stageIndex, setStageIndex] = useState(0);
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((current) => (current + 1) % safeStages.length);
    }, 1450);
    return () => clearInterval(stageTimer);
  }, [safeStages.length]);

  useEffect(() => {
    const fullText = safeStages[stageIndex] || safeStages[0];
    setTypedText("");
    let index = 0;
    const typingTimer = setInterval(() => {
      index += 1;
      setTypedText(fullText.slice(0, index));
      if (index >= fullText.length) clearInterval(typingTimer);
    }, 22);
    return () => clearInterval(typingTimer);
  }, [safeStages, stageIndex]);

  const progress = (stageIndex + 1) / safeStages.length;

  return (
    <PremiumCard tone="purple" compact={compact} style={[styles.card, compact && styles.compactCard, style]} contentStyle={styles.content}>
      <View style={styles.header} accessibilityRole="progressbar" accessibilityLabel={typedText || "Performance analysis loading"}>
        <View style={styles.statusDot} />
        <Text style={styles.kicker}>PERFORMANCE ANALYSIS</Text>
      </View>
      <Text style={[styles.stageText, compact && styles.stageTextCompact]} maxFontSizeMultiplier={1.3}>
        {typedText}
        <Text style={styles.cursor}>_</Text>
      </Text>
      <PremiumLoadingBar progress={progress} height={4} tone="purple" accessibilityLabel="Performance analysis progress" />
      {!compact ? (
        <View style={styles.statusStack} importantForAccessibility="no">
          {safeStages.slice(0, 3).map((line, index) => (
            <View key={line} style={styles.statusLine}>
              <Text style={[styles.statusCode, index <= stageIndex % safeStages.length && styles.statusCodeActive]}>
                {index <= stageIndex % safeStages.length ? "RUN" : "QUE"}
              </Text>
              <ShimmerPlaceholder
                width={index === 2 ? "58%" : "76%"}
                height={7}
                radius={999}
                tone={index <= stageIndex % safeStages.length ? "lime" : "neutral"}
              />
            </View>
          ))}
        </View>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  compactCard: {
    minWidth: 160,
  },
  content: {
    gap: ydlSpace.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ydlSpace.xs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  kicker: {
    ...ydlTypography.label,
    color: C.sub,
    textTransform: "uppercase",
  },
  stageText: {
    ...ydlTypography.callout,
    color: C.text,
    fontWeight: "600",
  },
  stageTextCompact: {
    ...ydlTypography.footnote,
    fontWeight: "600",
  },
  cursor: {
    color: C.green,
  },
  statusStack: {
    gap: ydlSpace.xs,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: ydlSpace.xs,
  },
  statusCode: {
    width: 28,
    color: C.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  statusCodeActive: {
    color: C.green,
  },
});
