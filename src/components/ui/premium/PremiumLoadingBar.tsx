import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { premiumRadii, premiumTone, type PremiumTone } from "./tokens";

export type PremiumLoadingBarProps = {
  progress?: number;
  indeterminate?: boolean;
  height?: number;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
};

export function PremiumLoadingBar({
  progress = 0,
  indeterminate = progress <= 0,
  height = 6,
  tone = "lime",
  style,
}: PremiumLoadingBarProps) {
  const fill = useRef(new Animated.Value(Math.max(0, Math.min(1, progress)))).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const toneConfig = premiumTone[tone];

  useEffect(() => {
    Animated.timing(fill, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, progress]);

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
    <View style={[styles.track, { height, borderRadius: height || premiumRadii.sm }, style]}>
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
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: toneConfig.soft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.075)",
  },
  fill: {
    height: "100%",
  },
  indeterminateFill: {
    width: 120,
    height: "100%",
    opacity: 0.88,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.38,
  },
});
