import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { YdlIconButton } from "../../src/ydl/components";
import { YDL_MIN_TOUCH_TARGET } from "../../src/ydl/accessibility";

export type Phase3IconButtonDemoProps = {
  variant:
    | "default"
    | "pressed"
    | "disabled"
    | "largeTouch"
    | "iconOnlyA11y"
    | "dark"
    | "light";
};

export function Phase3IconButtonDemo({ variant }: Phase3IconButtonDemoProps) {
  const [count, setCount] = useState(0);
  const light = variant === "light";
  const bg = light ? "#F7F8FA" : "#05070A";
  const tint = light ? "#0E141D" : "#F4F7F5";

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <Text style={[styles.heading, { color: tint }]}>YdlIconButton / {variant}</Text>
      <Text style={{ color: tint }}>Presses: {count}</Text>
      <View style={styles.row}>
        <YdlIconButton
          symbol="close"
          accessibilityLabel="Close details"
          tintColor={tint}
          disabled={variant === "disabled"}
          haptic="selection"
          onPress={() => setCount((n) => n + 1)}
          style={
            variant === "largeTouch"
              ? { minWidth: 56, minHeight: 56, borderWidth: 1, borderColor: tint }
              : { borderWidth: 1, borderColor: "rgba(128,128,128,0.4)" }
          }
          testID="phase3-icon-button"
        />
        {variant === "iconOnlyA11y" ? (
          <Text style={{ color: tint, maxWidth: 220 }}>
            Icon-only control exposes accessibilityRole=button and a spoken label; visual glyph is decorative.
          </Text>
        ) : null}
      </View>
      <Text style={{ color: tint, fontSize: 12 }}>
        Min touch target guidance: {YDL_MIN_TOUCH_TARGET}×{YDL_MIN_TOUCH_TARGET} pt
      </Text>
      {variant === "pressed" ? (
        <Text style={{ color: tint }}>Press and hold to observe pressed opacity.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, gap: 14 },
  heading: { fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
});
