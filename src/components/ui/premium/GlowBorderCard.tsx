import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { C } from "../../../theme/colors";
import { premiumRadii, premiumTone, type PremiumTone } from "./tokens";

export type GlowBorderCardProps = ViewProps & {
  children?: React.ReactNode;
  tone?: PremiumTone;
  radius?: number;
  animated?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function GlowBorderCard({
  children,
  tone = "lime",
  radius = premiumRadii.lg,
  animated = true,
  style,
  contentStyle,
  ...rest
}: GlowBorderCardProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const toneConfig = premiumTone[tone];

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, pulse]);

  const glowOpacity = animated ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.64] }) : 0.44;

  return (
    <View
      {...rest}
      style={[
        styles.shell,
        {
          borderRadius: radius,
          borderColor: toneConfig.border,
          shadowColor: toneConfig.accent,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowBorder,
          {
            borderRadius: radius,
            borderColor: toneConfig.accent,
            opacity: glowOpacity,
          },
        ]}
      />
      <View pointerEvents="none" style={[styles.innerTint, { borderRadius: radius - 1, backgroundColor: toneConfig.soft }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "rgba(5,7,10,0.90)",
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  innerTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
  },
});
