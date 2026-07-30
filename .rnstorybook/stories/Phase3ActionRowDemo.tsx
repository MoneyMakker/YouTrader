import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { YdlActionRow } from "../../src/ydl/components";

export type Phase3ActionRowDemoProps = {
  variant:
    | "titleOnly"
    | "titleSubtitle"
    | "trailing"
    | "longLocalized"
    | "largeFont"
    | "disabled"
    | "dark"
    | "light";
};

export function Phase3ActionRowDemo({ variant }: Phase3ActionRowDemoProps) {
  const [last, setLast] = useState("—");
  const light = variant === "light";
  const bg = light ? "#F7F8FA" : "#05070A";
  const tint = light ? "#0E141D" : "#F4F7F5";
  const large = variant === "largeFont";

  const longTitle =
    "Очень длинный локализованный заголовок метрики дисциплины, который должен переноситься без обрезки";
  const longSubtitle =
    "Дополнительное описание с переносом строк для VoiceOver и Dynamic Type — layout must not use a fixed clipping height.";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.heading, { color: tint, fontSize: large ? 28 : 18 }]}>
        YdlActionRow / {variant}
      </Text>
      <Text style={{ color: tint }}>Last press: {last}</Text>

      {(variant === "titleOnly" || variant === "dark" || variant === "light") && (
        <YdlActionRow
          title="Trading radar"
          leadingSymbol="chart"
          showChevron
          onPress={() => setLast("titleOnly")}
        />
      )}

      {(variant === "titleSubtitle" || variant === "largeFont") && (
        <YdlActionRow
          title={large ? "Win rate" : "Discipline score"}
          subtitle={large ? longSubtitle : "How consistently you follow your plan"}
          leadingSymbol="journal"
          onPress={() => setLast("subtitle")}
        />
      )}

      {variant === "trailing" && (
        <YdlActionRow
          title="Average R"
          trailingValue="1.42"
          leadingSymbol="profit"
          showChevron={false}
          onPress={() => setLast("trailing")}
        />
      )}

      {variant === "longLocalized" && (
        <YdlActionRow
          title={longTitle}
          subtitle={longSubtitle}
          leadingSymbol="info"
          trailingValue="PRO"
          onPress={() => setLast("long")}
        />
      )}

      {variant === "disabled" && (
        <YdlActionRow
          title="Locked metric"
          subtitle="Upgrade to unlock"
          leadingSymbol="lock"
          disabled
          onPress={() => setLast("should-not-fire")}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  heading: { fontWeight: "800" },
});
