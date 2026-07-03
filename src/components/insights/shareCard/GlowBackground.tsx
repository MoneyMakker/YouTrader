import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH, EXPORT_COLORS } from "../exportDesign";

export function GlowBackground({ accent = "mixed" }: { accent?: "green" | "purple" | "gold" | "mixed" }) {
  const showGreen = accent === "green" || accent === "mixed" || accent === "gold";
  const showPurple = accent === "purple" || accent === "mixed" || accent === "gold";
  const showGold = accent === "gold" || accent === "mixed";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {showPurple ? <View style={styles.glowPurple} /> : null}
      {showGreen ? <View style={styles.glowGreen} /> : null}
      {showGold ? <View style={styles.glowGold} /> : null}
      <Svg width={EXPORT_CARD_WIDTH} height={EXPORT_CARD_HEIGHT} style={styles.svgLayer}>
        <Defs>
          <LinearGradient id="shareBgFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#120A1F" stopOpacity="0.55" />
            <Stop offset="0.45" stopColor="#030507" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#061408" stopOpacity="0.42" />
          </LinearGradient>
        </Defs>
        <Path d={`M0 0 H${EXPORT_CARD_WIDTH} V${EXPORT_CARD_HEIGHT} H0 Z`} fill="url(#shareBgFade)" />
        {Array.from({ length: 14 }).map((_, row) =>
          Array.from({ length: 8 }).map((__, col) => (
            <Circle
              key={`${row}-${col}`}
              cx={80 + col * 130}
              cy={220 + row * 120}
              r={1.2}
              fill="rgba(156,255,0,0.12)"
            />
          )),
        )}
      </Svg>
      <View style={styles.scanLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowPurple: {
    position: "absolute",
    top: -240,
    right: -200,
    width: 720,
    height: 720,
    borderRadius: 360,
    backgroundColor: "rgba(176,38,255,0.24)",
  },
  glowGreen: {
    position: "absolute",
    left: -280,
    bottom: 220,
    width: 620,
    height: 620,
    borderRadius: 310,
    backgroundColor: "rgba(156,255,0,0.14)",
  },
  glowGold: {
    position: "absolute",
    top: 420,
    left: "18%",
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: "rgba(244,201,93,0.08)",
  },
  svgLayer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  scanLine: {
    position: "absolute",
    left: 64,
    right: 64,
    top: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    shadowColor: EXPORT_COLORS.purple,
    shadowOpacity: 0.85,
    shadowRadius: 24,
  },
});
