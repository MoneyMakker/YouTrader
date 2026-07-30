import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  YdlAnimatedNumber,
  YdlAnimatedPressable,
  YdlStagger,
} from "../../src/ydl/motion";

export type Phase4PressableDemoProps = {
  variant: "default" | "disabled" | "reduceMotion" | "haptic" | "icon" | "light" | "dark";
};

export function Phase4PressableDemo({ variant }: Phase4PressableDemoProps) {
  const [count, setCount] = useState(0);
  const light = variant === "light";
  const bg = light ? "#F7F8FA" : "#05070A";
  const tint = light ? "#0E141D" : "#F4F7F5";

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <Text style={[styles.heading, { color: tint }]}>
        YdlAnimatedPressable / {variant}
      </Text>
      <Text style={{ color: tint }}>Presses: {count}</Text>
      <YdlAnimatedPressable
        accessibilityLabel="Demo press control"
        disabled={variant === "disabled"}
        haptic={variant === "haptic" ? "selection" : false}
        minTouchTarget={variant === "icon"}
        onPress={() => setCount((n) => n + 1)}
        style={[styles.btn, { borderColor: tint }]}
      >
        <Text style={{ color: tint, fontWeight: "700" }}>
          {variant === "icon" ? "◎" : "Press"}
        </Text>
      </YdlAnimatedPressable>
      {variant === "reduceMotion" ? (
        <Text style={{ color: tint, fontSize: 12 }}>
          Enable Reduce Motion in system settings to verify opacity-only feedback.
        </Text>
      ) : null}
    </View>
  );
}

export type Phase4NumberDemoProps = {
  variant:
    | "currencyPositive"
    | "currencyNegative"
    | "percentage"
    | "zeroToPositive"
    | "positiveToNegative"
    | "rapid"
    | "large"
    | "reduceMotion"
    | "largeText";
};

export function Phase4NumberDemo({ variant }: Phase4NumberDemoProps) {
  const [value, setValue] = useState(0);
  const tint = "#F4F7F5";

  useEffect(() => {
    if (variant === "currencyPositive") setValue(1284.5);
    if (variant === "currencyNegative") setValue(-842.25);
    if (variant === "percentage") setValue(55);
    if (variant === "zeroToPositive") {
      setValue(0);
      const t = setTimeout(() => setValue(128), 400);
      return () => clearTimeout(t);
    }
    if (variant === "positiveToNegative") {
      setValue(220);
      const t = setTimeout(() => setValue(-90), 400);
      return () => clearTimeout(t);
    }
    if (variant === "large") setValue(1_250_000.42);
    if (variant === "reduceMotion" || variant === "largeText") setValue(64.2);
    if (variant === "rapid") {
      let n = 0;
      const id = setInterval(() => {
        n += 1;
        setValue(n * 11.5);
        if (n >= 8) clearInterval(id);
      }, 80);
      return () => clearInterval(id);
    }
    return undefined;
  }, [variant]);

  const kind =
    variant === "percentage" ? "percentage" : variant.includes("currency") || variant === "large"
      ? "currency"
      : "decimal";

  return (
    <View style={[styles.screen, { backgroundColor: "#05070A" }]}>
      <Text style={[styles.heading, { color: tint }]}>YdlAnimatedNumber / {variant}</Text>
      <YdlAnimatedNumber
        value={value}
        kind={kind}
        style={{
          color: tint,
          fontSize: variant === "largeText" ? 40 : 28,
          fontWeight: "900",
        }}
      />
    </View>
  );
}

export type Phase4StaggerDemoProps = {
  variant: "smallGroup" | "reduceMotion" | "longText" | "light" | "dark";
};

export function Phase4StaggerDemo({ variant }: Phase4StaggerDemoProps) {
  const light = variant === "light";
  const bg = light ? "#F7F8FA" : "#05070A";
  const tint = light ? "#0E141D" : "#F4F7F5";
  const body =
    variant === "longText"
      ? "Long localized explanation text that must remain readable without large travel distance during entrance."
      : "Metric explanation line";

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <Text style={[styles.heading, { color: tint }]}>YdlStagger / {variant}</Text>
      <YdlStagger entranceKey={variant} preset="tight">
        <Text style={{ color: tint, fontWeight: "800" }}>Item 1</Text>
        <Text style={{ color: tint }}>{body}</Text>
        <Text style={{ color: tint }}>Item 3</Text>
        <Text style={{ color: tint }}>Item 4</Text>
      </YdlStagger>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, gap: 14 },
  heading: { fontSize: 18, fontWeight: "800" },
  btn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
