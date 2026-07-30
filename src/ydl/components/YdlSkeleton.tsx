import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useYdlReduceMotion } from "../accessibility";
import { useYdlTheme, type YdlAppearance } from "../tokens";

export type YdlSkeletonShape = "text" | "circle" | "rectangle";

export type YdlSkeletonProps = {
  shape?: YdlSkeletonShape;
  width?: number | `${number}%`;
  height?: number;
  /** Prefer static; set true only for restrained pulse (RN Animated, not Reanimated). */
  animated?: boolean;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Decorative placeholder. Reduce Motion → always static.
 * Uses RN Animated for optional pulse — no Reanimated import (boundary preserved).
 */
export function YdlSkeleton({
  shape = "text",
  width,
  height,
  animated = false,
  appearance,
  style,
  testID,
}: YdlSkeletonProps) {
  const theme = useYdlTheme(appearance);
  const reduceMotion = useYdlReduceMotion();
  const allowAnim = animated && !reduceMotion;
  const opacity = useRef(new Animated.Value(theme.opacity.skeleton)).current;

  useEffect(() => {
    if (!allowAnim) {
      opacity.stopAnimation();
      opacity.setValue(theme.opacity.skeleton);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: theme.opacity.skeletonPulseMax,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: theme.opacity.skeletonPulseMin,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [allowAnim, opacity, theme.opacity.skeleton, theme.opacity.skeletonPulseMax, theme.opacity.skeletonPulseMin]);

  const dims = {
    text: { width: width ?? "80%", height: height ?? 12, radius: 6 },
    circle: { width: width ?? 40, height: height ?? 40, radius: 999 },
    rectangle: {
      width: width ?? "100%",
      height: height ?? 72,
      radius: theme.radius.medium,
    },
  }[shape];

  return (
    <Animated.View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: dims.width,
          height: dims.height,
          borderRadius: dims.radius,
          backgroundColor: theme.colors.surface.interactive,
          opacity: allowAnim ? opacity : theme.opacity.skeleton,
        },
        style,
      ]}
    />
  );
}

export function YdlSkeletonCard({
  appearance,
  animated = false,
}: {
  appearance?: YdlAppearance;
  animated?: boolean;
}) {
  const theme = useYdlTheme(appearance);
  return (
    <View
      style={[
        styles.card,
        {
          gap: theme.space[8],
          padding: theme.space[16],
          borderRadius: theme.radius.card,
          borderColor: theme.colors.border.subtle,
          backgroundColor: theme.colors.surface.card,
        },
      ]}
      accessible={false}
      importantForAccessibility="no"
    >
      <YdlSkeleton shape="circle" animated={animated} appearance={appearance} />
      <YdlSkeleton shape="text" width="70%" animated={animated} appearance={appearance} />
      <YdlSkeleton shape="text" width="50%" animated={animated} appearance={appearance} />
      <YdlSkeleton shape="rectangle" height={48} animated={animated} appearance={appearance} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
});
