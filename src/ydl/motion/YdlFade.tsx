import React, { useEffect } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useYdlReduceMotion } from "../accessibility";
import { resolveYdlMotionMs } from "./reduceMotion";
import { ydlMotionDurationToken } from "./tokens";

export type YdlFadeProps = {
  children: React.ReactNode;
  /** Controlled visibility. When false, fades out then disables pointer events. */
  visible?: boolean;
  /** Enter on mount when visible (default true). */
  enter?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Called after exit fade completes (when visible becomes false). */
  onExited?: () => void;
  testID?: string;
};

/**
 * Opacity enter/exit. No layout animation.
 * Reduce Motion → near-instant. Hidden → pointerEvents none (no race).
 */
export function YdlFade({
  children,
  visible = true,
  enter = true,
  style,
  onExited,
  testID,
}: YdlFadeProps) {
  const reduceMotion = useYdlReduceMotion();
  const opacity = useSharedValue(visible && !enter ? 1 : visible ? (reduceMotion ? 1 : 0) : 0);
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    const duration = resolveYdlMotionMs(
      reduceMotion ? "instant" : visible ? "standard" : "fast",
      reduceMotion,
    );
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, {
        duration: duration || (reduceMotion ? 0 : ydlMotionDurationToken.standard),
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return;
    }
    opacity.value = withTiming(
      0,
      {
        duration: duration || (reduceMotion ? 0 : ydlMotionDurationToken.fast),
        easing: Easing.bezier(0.3, 0, 1, 0.45),
      },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
          if (onExited) runOnJS(onExited)();
        }
      },
    );
  }, [visible, reduceMotion, opacity, onExited]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!mounted && !visible) {
    return null;
  }

  return (
    <Animated.View
      testID={testID}
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.fill, animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    // no layout animation
  },
});
