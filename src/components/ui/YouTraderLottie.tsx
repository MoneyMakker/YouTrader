import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ChartColumnIncreasing } from "lucide-react-native";
import { t } from "../../i18n";
import { C } from "../../theme/colors";

export type YouTraderLottieSlot =
  | "passedEvaluation"
  | "firstGreenWeek"
  | "upgradeToPro"
  | "emptyState"
  | "dailyGoalReached";

type Props = {
  slot: YouTraderLottieSlot;
  style?: StyleProp<ViewStyle>;
  label?: string;
};

const LABEL_KEYS: Record<YouTraderLottieSlot, string> = {
  passedEvaluation: "lottiePassedEvaluation",
  firstGreenWeek: "lottieFirstGreenWeek",
  upgradeToPro: "upgradeToPro",
  emptyState: "lottieEmptyState",
  dailyGoalReached: "lottieDailyGoalReached",
};

export function YouTraderLottie({ slot, style, label }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.03] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Animated.View style={[styles.wrap, style, { transform: [{ scale }] }]}>
      <Animated.View style={[styles.glow, { opacity: glow }]} />
      <View style={styles.core}>
        <ChartColumnIncreasing size={34} color={C.green} strokeWidth={2.4} />
      </View>
      {label || LABEL_KEYS[slot] ? (
        <Text style={styles.label} numberOfLines={2}>
          {label || t(LABEL_KEYS[slot])}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 10 },
  glow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.green,
  },
  core: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(10,12,16,0.92)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 180,
  },
});
