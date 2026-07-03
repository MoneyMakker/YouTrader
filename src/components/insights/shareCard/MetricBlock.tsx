import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EXPORT_COLORS } from "../exportDesign";

type Tone = "green" | "red" | "purple" | "gold" | "default";

export function MetricBlock({
  label,
  value,
  tone = "default",
  small,
}: {
  label: string;
  value: string;
  tone?: Tone;
  small?: boolean;
}) {
  const color =
    tone === "green"
      ? EXPORT_COLORS.green
      : tone === "red"
        ? EXPORT_COLORS.red
        : tone === "purple"
          ? EXPORT_COLORS.purple2
          : tone === "gold"
            ? EXPORT_COLORS.gold
            : EXPORT_COLORS.text;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }, small && styles.valueSmall]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {value}
      </Text>
    </View>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
  },
  block: {
    width: "48.9%",
    minHeight: 95,
    borderWidth: 2,
    borderColor: "rgba(244,201,93,0.32)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
  },
  label: {
    color: EXPORT_COLORS.sub,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    color: EXPORT_COLORS.green,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    marginTop: 4,
  },
  valueSmall: {
    fontSize: 24,
    lineHeight: 30,
  },
});
