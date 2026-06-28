import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { GlassCard } from "./GlassCard";
import { lightHaptic } from "./haptics";
import { C } from "../../theme/colors";

type Props = Omit<PressableProps, "style"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: "green" | "purple" | "red" | "none";
  locked?: boolean;
  intensity?: number;
  compact?: boolean;
};

export function PremiumGlassCard({
  children,
  style,
  glow = "purple",
  locked = false,
  intensity,
  compact,
  onPress,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isPressable = Boolean(onPress) && !disabled;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 26,
      bounciness: 3,
    }).start();
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled || !onPress}
      onPress={(event) => {
        if (isPressable) lightHaptic();
        onPress?.(event);
      }}
      onPressIn={() => isPressable && animateTo(0.985)}
      onPressOut={() => isPressable && animateTo(1)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <GlassCard
          compact={compact}
          intensity={intensity ?? (compact ? 26 : 42)}
          style={[
            styles.card,
            glow !== "none" && styles[`${glow}Glow`],
            locked && styles.locked,
            style,
          ]}
        >
          {glow !== "none" ? <View pointerEvents="none" style={[styles.glowOrb, styles[`${glow}Orb`]]} /> : null}
          {children}
        </GlassCard>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  greenGlow: { borderColor: "rgba(163,255,18,0.28)" },
  purpleGlow: { borderColor: "rgba(176,38,255,0.30)" },
  redGlow: { borderColor: "rgba(255,59,95,0.28)" },
  locked: { opacity: 0.92 },
  glowOrb: {
    position: "absolute",
    right: -34,
    top: -42,
    width: 112,
    height: 112,
    borderRadius: 56,
    opacity: 0.13,
  },
  greenOrb: { backgroundColor: C.green },
  purpleOrb: { backgroundColor: C.purple },
  redOrb: { backgroundColor: C.red },
});
