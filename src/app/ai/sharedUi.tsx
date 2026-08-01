import React from "react";
import { Text, View } from "react-native";
import { GlassCard } from "../../components/ui/GlassCard";
import { C } from "../theme";
import { styles } from "../styles";
import { AiCoachListBlock, aiOsUniqueList } from "./coachRead";

export { aiOsUniqueList };
export {
  AiCoachActionLine,
  AiCoachListBlock,
  AiCoachProse,
  AiCoachSectionLabel,
  AiCoachSupport,
} from "./coachRead";

export function TerminalGlassCard({
  children,
  style,
  intensity = 46,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
  return (
    <GlassCard style={[styles.terminalCard, style]} intensity={intensity}>
      {children}
    </GlassCard>
  );
}

export function MetricPillRow({ items }: { items: { label: string; value: string; tone?: "green" | "red" | "purple" | "grey" }[] }) {
  return (
    <View style={styles.metricPillRow}>
      {items.map((item) => {
        const color = item.tone === "red" ? C.red : item.tone === "purple" ? C.purple : item.tone === "green" ? C.green : C.sub;
        return (
          <View
            key={item.label}
            style={styles.metricPill}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${item.label}, ${item.value}`}
          >
            <Text
              style={[styles.metricPillValue, { color }]}
              maxFontSizeMultiplier={1.3}
              importantForAccessibility="no"
            >
              {item.value}
            </Text>
            <Text
              style={styles.metricPillLabel}
              maxFontSizeMultiplier={1.2}
              importantForAccessibility="no"
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** @deprecated Prefer AiCoachListBlock — kept as alias for existing call sites. */
export function AiOsTextBlock({ title, items }: { title: string; items: string[] }) {
  return <AiCoachListBlock title={title} items={items} />;
}
