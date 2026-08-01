import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { getYdlProgressMotionConfig } from "../../../ydl/motion/progress";
import { ydlStatusLoadingBar } from "../../../ydl/status";
import { premiumRadii, premiumTone, type PremiumTone } from "./tokens";

export type PremiumLoadingBarProps = {
  progress?: number;
  indeterminate?: boolean;
  height?: number;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PremiumLoadingBar({
  progress = 0,
  indeterminate = progress <= 0,
  height = ydlStatusLoadingBar.height,
  tone = "lime",
  style,
  accessibilityLabel = "Loading",
}: PremiumLoadingBarProps) {
  const fill = useRef(new Animated.Value(Math.max(0, Math.min(1, progress)))).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const toneConfig = premiumTone[tone];
  const progressMotion = getYdlProgressMotionConfig("linear");

  useEffect(() => {
    Animated.timing(fill, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: progressMotion.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, progress, progressMotion.durationMs]);

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, sweep]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, 240] });

  return (
    <View
      style={[styles.track, { height, borderRadius: height || premiumRadii.sm }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        indeterminate
          ? undefined
          : { min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, progress)) * 100) }
      }
    >
      {indeterminate ? (
        <Animated.View
          style={[
            styles.indeterminateFill,
            {
              backgroundColor: toneConfig.accent,
              borderRadius: height,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : (
        <Animated.View style={[styles.fill, { width, backgroundColor: toneConfig.accent, borderRadius: height }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: ydlStatusLoadingBar.track,
  },
  fill: {
    height: "100%",
  },
  indeterminateFill: {
    width: 120,
    height: "100%",
    opacity: 0.88,
  },
});
