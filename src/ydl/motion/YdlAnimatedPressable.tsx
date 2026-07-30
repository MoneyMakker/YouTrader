import React, { useCallback, useRef } from "react";
import {
  Pressable,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { runYdlHaptic, type YdlHapticIntent } from "../haptics";
import { useYdlReduceMotion, ydlMinTouchTargetStyle } from "../accessibility";
import { ydlMotionDurationToken, ydlSpring } from "./tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type YdlAnimatedPressableProps = {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { disabled?: boolean; selected?: boolean; busy?: boolean };
  /** Enforce ≥44×44 for icon-sized controls. */
  minTouchTarget?: boolean;
  /** Subtle scale on press (default true). */
  scaleOnPress?: boolean;
  /** Opacity response on press (default true). */
  opacityOnPress?: boolean;
  /** Fired once per intentional press — never per frame. */
  haptic?: YdlHapticIntent | false;
  testID?: string;
};

/**
 * Restrained press feedback — opacity/transform only.
 * Reduce Motion: opacity flash or immediate state, no scale travel.
 */
export function YdlAnimatedPressable({
  children,
  onPress,
  disabled = false,
  style,
  accessibilityRole = "button",
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  minTouchTarget = false,
  scaleOnPress = true,
  opacityOnPress = true,
  haptic = false,
  testID,
}: YdlAnimatedPressableProps) {
  const reduceMotion = useYdlReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const hapticFired = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const resetPress = useCallback(() => {
    hapticFired.current = false;
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = withTiming(1, { duration: ydlMotionDurationToken.instant });
      return;
    }
    scale.value = withSpring(1, ydlSpring.press);
    opacity.value = withTiming(1, { duration: ydlMotionDurationToken.fast });
  }, [opacity, reduceMotion, scale]);

  const onPressIn = useCallback(() => {
    if (disabled) return;
    if (reduceMotion) {
      if (opacityOnPress) opacity.value = 0.72;
      scale.value = 1;
      return;
    }
    if (scaleOnPress) {
      scale.value = withSpring(0.97, ydlSpring.press);
    }
    if (opacityOnPress) {
      opacity.value = withTiming(0.88, { duration: ydlMotionDurationToken.fast });
    }
  }, [disabled, opacity, opacityOnPress, reduceMotion, scale, scaleOnPress]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled) return;
      if (haptic && !hapticFired.current) {
        hapticFired.current = true;
        runYdlHaptic(haptic);
      }
      onPress?.(event);
    },
    [disabled, haptic, onPress],
  );

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={resetPress}
      style={[minTouchTarget ? ydlMinTouchTargetStyle() : null, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
