import React, { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

export function AnimatedEntrance({
  children,
  style,
  delay = 0,
  distance = 10,
  disabled = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  distance?: number;
  disabled?: boolean;
}) {
  const opacity = useRef(new Animated.Value(disabled ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(disabled ? 0 : distance)).current;

  useEffect(() => {
    if (disabled) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, disabled, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
