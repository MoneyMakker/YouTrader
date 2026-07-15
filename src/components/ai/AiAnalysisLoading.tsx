import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "../../theme/colors";
import { PremiumCard, PremiumLoadingBar, ShimmerPlaceholder } from "../ui/premium";

const DEFAULT_STAGES = [
  "Analyzing your edge...",
  "Checking risk behavior...",
  "Reading trade patterns...",
  "Building AI report...",
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
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulse]);

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

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const progress = (stageIndex + 1) / safeStages.length;

  return (
    <PremiumCard tone="purple" compact={compact} style={[styles.card, compact && styles.compactCard, style]} contentStyle={styles.content}>
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity }]} />
      <View style={styles.header}>
        <View style={styles.statusDot} />
        <Text style={styles.kicker}>AI ANALYSIS</Text>
      </View>
      <Text style={[styles.stageText, compact && styles.stageTextCompact]}>
        {typedText}
        <Text style={styles.cursor}>_</Text>
      </Text>
      <PremiumLoadingBar progress={progress} height={4} tone="purple" />
      {!compact ? (
        <View style={styles.statusStack}>
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
    gap: 11,
  },
  glow: {
    position: "absolute",
    right: -44,
    top: -52,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: C.purpleSoft,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  kicker: {
    color: C.sub,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  stageText: {
    color: C.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  stageTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  cursor: {
    color: C.green,
  },
  statusStack: {
    gap: 8,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  statusCode: {
    width: 28,
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  statusCodeActive: {
    color: C.green,
  },
});
