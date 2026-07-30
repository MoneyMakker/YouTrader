import React, { useEffect, useRef } from "react";
import {
  Animated,
  AppState,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useYdlReduceMotion } from "../accessibility";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YDL_SKELETON_MAX_ANIMATED } from "./contracts";

export type YdlSkeletonShape = "text" | "circle" | "rectangle";

export type YdlSkeletonProps = {
  shape?: YdlSkeletonShape;
  width?: number | `${number}%`;
  height?: number;
  /**
   * Prefer static (default false). Optional pulse uses RN Animated.
   * Cap simultaneous animated skeletons with YDL_SKELETON_MAX_ANIMATED (=4).
   */
  animated?: boolean;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Decorative placeholder. Reduce Motion → always static.
 * Pulse stops on unmount and when app backgrounds.
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
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const stop = () => {
      loopRef.current?.stop();
      loopRef.current = null;
      opacity.stopAnimation();
      opacity.setValue(theme.opacity.skeleton);
    };

    if (!allowAnim) {
      stop();
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
    loopRef.current = loop;
    loop.start();

    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") stop();
    });

    return () => {
      sub.remove();
      stop();
    };
  }, [
    allowAnim,
    opacity,
    theme.opacity.skeleton,
    theme.opacity.skeletonPulseMax,
    theme.opacity.skeletonPulseMin,
  ]);

  const dims = {
    text: { width: width ?? "80%", height: height ?? 12, radius: theme.radius.small },
    circle: { width: width ?? 40, height: height ?? 40, radius: theme.radius.pill },
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
  void YDL_SKELETON_MAX_ANIMATED;
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
