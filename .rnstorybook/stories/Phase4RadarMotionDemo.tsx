import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MetricExplanationSheet, type MetricExplanationContent } from "../../src/components/stats/MetricExplanationSheet";
import { YdlAnimatedPressable } from "../../src/ydl/motion";

const METRICS: MetricExplanationContent[] = [
  {
    label: "Win Rate",
    value: "55%",
    target: "≥ 50%",
    explanation: "Share of winning trades in the selected window.",
  },
  {
    label: "Profit Factor",
    value: "1.42",
    target: "≥ 1.20",
    explanation: "Gross profit divided by gross loss.",
  },
  {
    label: "Expectancy",
    value: "-12.5",
    target: "> 0",
    explanation: "Average expected result per trade.",
  },
];

export type Phase4RadarMotionDemoProps = {
  variant:
    | "default"
    | "otherMetric"
    | "rapidSwitch"
    | "reduceMotion"
    | "largeText"
    | "dark";
};

export function Phase4RadarMotionDemo({ variant }: Phase4RadarMotionDemoProps) {
  const initialIndex = variant === "otherMetric" ? 1 : 0;
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(true);

  const content = useMemo(() => METRICS[index] ?? METRICS[0], [index]);

  React.useEffect(() => {
    if (variant !== "rapidSwitch") return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setIndex(n % METRICS.length);
      if (n >= 6) clearInterval(id);
    }, 180);
    return () => clearInterval(id);
  }, [variant]);

  return (
    <View style={[styles.screen, variant === "largeText" && styles.largePad]}>
      <Text style={styles.heading}>Radar metric motion / {variant}</Text>
      <View style={styles.row}>
        {METRICS.map((m, i) => (
          <YdlAnimatedPressable
            key={m.label}
            accessibilityLabel={`Open ${m.label}`}
            haptic="selection"
            onPress={() => {
              setIndex(i);
              setOpen(true);
            }}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{m.label}</Text>
          </YdlAnimatedPressable>
        ))}
      </View>
      <MetricExplanationSheet
        visible={open}
        content={content}
        onClose={() => setOpen(false)}
        appearance="dark"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#05070A", padding: 18, gap: 12 },
  largePad: { paddingTop: 40 },
  heading: { color: "#F4F7F5", fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipText: { color: "#F4F7F5", fontWeight: "700" },
});
