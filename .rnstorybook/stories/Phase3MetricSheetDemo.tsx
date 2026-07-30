import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { YdlSheetRoot } from "../../src/ydl/sheets";
import { MetricExplanationSheet } from "../../src/components/stats/MetricExplanationSheet";
import type { YdlSheetAppearance } from "../../src/ydl/sheets";

export type Phase3MetricSheetDemoProps = {
  variant: "default" | "largeText" | "reduceMotion" | "dark" | "longLocalized";
};

const SAMPLE = {
  label: "Discipline",
  value: "78",
  target: "≥ 70",
  explanation: "Share of trades that followed your documented plan for this period.",
};

const LONG = {
  label: "Дисциплина исполнения торгового плана за выбранный период",
  value: "78 / 100",
  target: "≥ 70 при достаточном объёме сделок",
  explanation:
    "Доля сделок, в которых вы следовали заранее записанному плану. Это объяснение метрики — не торговый сигнал и не прогноз рынка. Длинный текст проверяет перенос строк и динамический размер sheet.",
};

export function Phase3MetricSheetDemo({ variant }: Phase3MetricSheetDemoProps) {
  const [open, setOpen] = useState(true);
  const appearance: YdlSheetAppearance = "dark";
  const content = variant === "longLocalized" ? LONG : SAMPLE;
  const fontNote = variant === "largeText" ? "Simulate larger text in iOS Settings → Accessibility." : null;
  const motionNote =
    variant === "reduceMotion"
      ? "Enable Reduce Motion in system settings; decorative chart mark is omitted."
      : null;

  return (
    <YdlSheetRoot>
      <View style={styles.screen}>
        <Text style={styles.heading}>MetricExplanationSheet / {variant}</Text>
        {fontNote ? <Text style={styles.note}>{fontNote}</Text> : null}
        {motionNote ? <Text style={styles.note}>{motionNote}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={styles.btn}
        >
          <Text style={styles.btnLabel}>Open sheet</Text>
        </Pressable>
        <MetricExplanationSheet
          visible={open}
          content={content}
          onClose={() => setOpen(false)}
          appearance={appearance}
        />
      </View>
    </YdlSheetRoot>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#05070A",
    padding: 18,
    gap: 14,
  },
  heading: { color: "#F4F7FB", fontSize: 18, fontWeight: "800" },
  note: { color: "#A7B0C0", fontSize: 13 },
  btn: {
    alignSelf: "flex-start",
    backgroundColor: "#B026FF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnLabel: { color: "#fff", fontWeight: "700" },
});
