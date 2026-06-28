import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
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

const LABELS: Record<YouTraderLottieSlot, string> = {
  passedEvaluation: "Evaluation passed",
  firstGreenWeek: "First green week",
  upgradeToPro: "Upgrade to Pro",
  emptyState: "Start building your journal",
  dailyGoalReached: "Daily goal reached",
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

  return (
    <View style={[styles.root, style]}>
      <Animated.View style={[styles.mark, { transform: [{ scale }] }]}>
        <View style={styles.candleGreen} />
        <View style={styles.candlePurple} />
        <View style={styles.candleGreenSmall} />
      </Animated.View>
      <Text style={styles.label}>{label || LABELS[slot]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 92,
    gap: 10,
  },
  mark: {
    width: 72,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.22)",
    backgroundColor: "rgba(163,255,18,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  candleGreen: {
    width: 8,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.green,
  },
  candlePurple: {
    width: 8,
    height: 38,
    borderRadius: 6,
    backgroundColor: C.purple,
  },
  candleGreenSmall: {
    width: 8,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.green,
  },
  label: {
    color: C.sub,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
});
