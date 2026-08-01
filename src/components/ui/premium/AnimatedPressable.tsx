import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  getYdlReduceMotionCached,
  runYdlHaptic,
  ydlControlState,
  ydlPress,
  ydlTouchTarget,
  type YdlPressToken,
} from "../../../ydl";

export type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Motion Foundation press token. Defaults to buttonPrimary. */
  press?: YdlPressToken;
  /** Overrides press token scale when provided. */
  scaleTo?: number;
  /** When true, fires the press token haptic (or Selection). Default false for back-compat. */
  haptic?: boolean;
  disabledOpacity?: number;
};

export function AnimatedPressable({
  children,
  style,
  contentStyle,
  press = "buttonPrimary",
  scaleTo,
  haptic = false,
  disabledOpacity = ydlControlState.disabledOpacity,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const interaction = ydlPress[press];
  const resolvedScale = scaleTo ?? interaction.scaleTo;

  const animateTo = (value: number) => {
    if (getYdlReduceMotionCached()) {
      scale.setValue(value);
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      stiffness: interaction.spring.stiffness,
      damping: interaction.spring.damping,
      mass: interaction.spring.mass,
      useNativeDriver: interaction.useNativeDriver,
      overshootClamping: true,
    }).start();
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (!disabled && haptic) {
      const preset = "haptic" in interaction && interaction.haptic
        ? interaction.haptic
        : "Selection";
      runYdlHaptic(preset);
    }
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      hitSlop={rest.hitSlop ?? ydlTouchTarget.hitSlopSm}
      onPressIn={(event) => {
        if (!disabled) animateTo(resolvedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View
        style={[
          styles.content,
          disabled && { opacity: disabledOpacity },
          contentStyle,
          { transform: [{ scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    minHeight: ydlTouchTarget.min,
    minWidth: ydlTouchTarget.min,
  },
});
