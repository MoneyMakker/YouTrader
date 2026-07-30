import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { runYdlHaptic } from "../../src/ydl/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Minimal Phase 1 demo: Reanimated spring + Expo Haptics via YDL bridge.
 * Not wired into production screens.
 */
export function Phase1MotionDemo() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.wrap} testID="phase1-motion-demo">
      <Text style={styles.title}>YouTrader Phase 1</Text>
      <Text style={styles.subtitle}>Reanimated + Expo Haptics</Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Pulse demo button"
        testID="phase1-pulse-button"
        onPressIn={() => {
          scale.value = withSpring(0.94, { damping: 16, stiffness: 320 });
          runYdlHaptic("impactLight");
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        onPress={() => {
          runYdlHaptic("success");
        }}
        style={[styles.button, animatedStyle]}
      >
        <Text style={styles.buttonLabel}>Pulse</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070B",
    padding: 24,
    gap: 12,
  },
  title: {
    color: "#F4F7FB",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#8B93A7",
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    minWidth: 160,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: "#1C2433",
    borderWidth: 1,
    borderColor: "#2A3447",
    alignItems: "center",
  },
  buttonLabel: {
    color: "#7CFFB2",
    fontSize: 16,
    fontWeight: "600",
  },
});
