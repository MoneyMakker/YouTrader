import React from "react";
import { ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import {
  YDL_SYMBOL_MAP,
  YdlSymbol,
  type YdlSemanticSymbol,
  type YdlSymbolWeight,
} from "../../src/ydl/symbols";

export type Phase3SymbolsDemoProps = {
  variant:
    | "gallery"
    | "weightsSizes"
    | "disabled"
    | "decorativeVsMeaningful"
    | "androidFallback"
    | "dark"
    | "light";
};

const NAMES = Object.keys(YDL_SYMBOL_MAP) as YdlSemanticSymbol[];
const WEIGHTS: YdlSymbolWeight[] = ["ultraLight", "regular", "semibold", "bold"];

export function Phase3SymbolsDemo({ variant }: Phase3SymbolsDemoProps) {
  const scheme = useColorScheme();
  const light =
    variant === "light" || (variant !== "dark" && scheme === "light");
  const tint = light ? "#0E141D" : "#F4F7F5";
  const bg = light ? "#F7F8FA" : "#05070A";

  return (
    <ScrollView style={[styles.screen, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: tint }]}>YdlSymbol / {variant}</Text>

      {variant === "gallery" || variant === "dark" || variant === "light" ? (
        <View style={styles.grid}>
          {NAMES.map((name) => (
            <View key={name} style={styles.cell}>
              <YdlSymbol name={name} size="lg" tintColor={tint} accessibilityLabel={name} />
              <Text style={[styles.caption, { color: tint }]}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {variant === "weightsSizes" ? (
        <View style={styles.col}>
          {(["sm", "md", "lg", "xl"] as const).map((size) => (
            <View key={size} style={styles.row}>
              <Text style={[styles.caption, { color: tint, width: 36 }]}>{size}</Text>
              {WEIGHTS.map((weight) => (
                <YdlSymbol
                  key={`${size}-${weight}`}
                  name="settings"
                  size={size}
                  weight={weight}
                  tintColor={tint}
                  accessibilityLabel={`${size} ${weight}`}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {variant === "disabled" ? (
        <View style={styles.row}>
          <YdlSymbol name="lock" size="lg" tintColor={tint} accessibilityLabel="Enabled lock" />
          <YdlSymbol name="lock" size="lg" tintColor={tint} disabled accessibilityLabel="Disabled lock" />
        </View>
      ) : null}

      {variant === "decorativeVsMeaningful" ? (
        <View style={styles.col}>
          <View style={styles.row}>
            <YdlSymbol name="info" decorative tintColor={tint} />
            <Text style={{ color: tint }}>Decorative (hidden from SR)</Text>
          </View>
          <YdlSymbol name="info" accessibilityLabel="Meaningful information" tintColor={tint} />
        </View>
      ) : null}

      {variant === "androidFallback" ? (
        <View style={styles.col}>
          <Text style={[styles.caption, { color: tint }]}>
            On Android, Lucide vectors render via SymbolView fallback (no emoji).
            On iOS this story still shows SF Symbols; compare on an Android device/emulator.
          </Text>
          <View style={styles.grid}>
            {(["close", "settings", "chart", "warning"] as YdlSemanticSymbol[]).map((name) => (
              <View key={name} style={styles.cell}>
                <YdlSymbol name={name} size="xl" tintColor={tint} accessibilityLabel={name} />
                <Text style={[styles.caption, { color: tint }]}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, gap: 14 },
  heading: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  cell: { width: 72, alignItems: "center", gap: 6 },
  caption: { fontSize: 11, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  col: { gap: 14 },
});
