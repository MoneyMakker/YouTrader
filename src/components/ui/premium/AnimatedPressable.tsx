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
import { lightHaptic } from "../haptics";

export type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  disabledOpacity?: number;
};

export function AnimatedPressable({
  children,
  style,
  contentStyle,
  scaleTo = 0.975,
  haptic = false,
  disabledOpacity = 0.48,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 28,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (!disabled && haptic) lightHaptic();
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={(event) => {
        if (!disabled) animateTo(scaleTo);
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
    minHeight: 44,
    minWidth: 44,
  },
});
