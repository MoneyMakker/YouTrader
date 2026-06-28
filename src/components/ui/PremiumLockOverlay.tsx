import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Lock } from "lucide-react-native";
import { GlassCard } from "./GlassCard";
import { lightHaptic } from "./haptics";
import { C } from "../../theme/colors";

type Props = {
  title: string;
  subtitle: string;
  cta?: string;
  secondary?: string;
  onUpgrade: () => void;
  onSecondary?: () => void;
  compact?: boolean;
};

export function PremiumLockOverlay({
  title,
  subtitle,
  cta = "Upgrade to Pro",
  secondary,
  onUpgrade,
  onSecondary,
  compact = false,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <GlassCard style={[styles.card, compact && styles.compact]} intensity={58}>
        <Animated.View style={[styles.lockHalo, { opacity, transform: [{ scale }] }]}>
          <Lock size={compact ? 26 : 34} color={C.green} strokeWidth={2.4} />
        </Animated.View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Pressable
          onPress={() => {
            lightHaptic();
            onUpgrade();
          }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{cta}</Text>
        </Pressable>
        {secondary ? (
          <Pressable
            onPress={() => {
              lightHaptic();
              onSecondary?.();
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>{secondary}</Text>
          </Pressable>
        ) : null}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    borderRadius: 28,
    borderColor: "rgba(163,255,18,0.30)",
    backgroundColor: "rgba(3,7,10,0.42)",
    padding: 20,
  },
  compact: {
    padding: 16,
    borderRadius: 22,
  },
  lockHalo: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.36)",
    backgroundColor: "rgba(163,255,18,0.10)",
    shadowColor: C.green,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    color: C.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },
  subtitle: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
  cta: {
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: C.green,
    shadowColor: C.green,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaText: {
    color: C.bg,
    fontWeight: "900",
    fontSize: 13,
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryText: {
    color: C.purple,
    fontWeight: "900",
    fontSize: 12,
  },
});
