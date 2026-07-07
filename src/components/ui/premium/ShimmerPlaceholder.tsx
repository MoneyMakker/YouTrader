import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "../../../theme/colors";
import { premiumRadii, premiumTone, type PremiumTone } from "./tokens";

export type ShimmerPlaceholderProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  tone?: PremiumTone;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ShimmerPlaceholder({
  width = "100%",
  height = 18,
  radius = premiumRadii.sm,
  tone = "purple",
  active = true,
  style,
}: ShimmerPlaceholderProps) {
  const travel = useRef(new Animated.Value(0)).current;
  const toneConfig = premiumTone[tone];

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: 1350,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, travel]);

  const translateX = travel.interpolate({ inputRange: [0, 1], outputRange: [-120, 220] });

  return (
    <View style={[styles.root, { width, height, borderRadius: radius }, style]}>
      <View style={[styles.baseTint, { backgroundColor: toneConfig.soft }]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          {
            backgroundColor: toneConfig.accent,
            transform: [{ translateX }, { rotate: "14deg" }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  baseTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.44,
  },
  shimmer: {
    position: "absolute",
    top: -24,
    bottom: -24,
    width: 58,
    opacity: 0.16,
  },
});
