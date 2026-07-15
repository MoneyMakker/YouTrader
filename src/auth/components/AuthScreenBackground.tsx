import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const { width: W, height: H } = Dimensions.get("window");

const PARTICLES = [
  { x: W * 0.14, y: H * 0.26, r: 0.8 },
  { x: W * 0.84, y: H * 0.2, r: 0.7 },
  { x: W * 0.76, y: H * 0.64, r: 0.9 },
  { x: W * 0.2, y: H * 0.74, r: 0.7 },
  { x: W * 0.9, y: H * 0.46, r: 0.8 },
];

/** Near-black atmosphere — subtle pixel particles only. */
export function AuthScreenBackground() {
  const glow = useRef(new Animated.Value(0.018)).current;

  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.028,
          duration: 6400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.015,
          duration: 6400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();
    return () => {
      glowLoop.stop();
    };
  }, [glow]);

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.centerGlow, { opacity: glow }]} />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {PARTICLES.map((p, i) => (
          <Circle key={`p-${i}`} cx={p.x} cy={p.y} r={p.r} fill="rgba(163,255,18,0.03)" />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000000" },
  centerGlow: {
    position: "absolute",
    alignSelf: "center",
    top: H * 0.16,
    width: W * 0.85,
    height: W * 0.5,
    borderRadius: W * 0.28,
    backgroundColor: "rgba(163,255,18,0.06)",
  },
});
