import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { ydlSpace } from "../../ydl/space";
import { ydlTypography } from "../../ydl/typography";
import { C } from "../theme";

/** Deduplicate short AI list lines for display (presentation helper only). */
export function aiOsUniqueList(items: string[], limit = 4) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const clean = item.trim();
    const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

/** Quiet section kicker — stays secondary to body copy. */
export function AiCoachSectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[readStyles.sectionLabel, style]} maxFontSizeMultiplier={1.2}>
      {children}
    </Text>
  );
}

/** Primary coaching observation / summary. */
export function AiCoachProse({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[readStyles.prose, style]} maxFontSizeMultiplier={1.35} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** Supporting interpretation — quieter than prose. */
export function AiCoachSupport({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[readStyles.support, style]} maxFontSizeMultiplier={1.3} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** Clear next-step line. */
export function AiCoachActionLine({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[readStyles.action, style]} maxFontSizeMultiplier={1.3} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/**
 * Editorial list block for AI bullets.
 * Title → spaced items. No nested card chrome.
 */
export function AiCoachListBlock({
  title,
  items,
  style,
}: {
  title: string;
  items: string[];
  style?: StyleProp<ViewStyle>;
}) {
  const visible = aiOsUniqueList(items, 4);
  if (!visible.length) return null;
  const a11y = `${title}. ${visible.join(". ")}`;
  return (
    <View style={[readStyles.block, style]} accessible accessibilityRole="summary" accessibilityLabel={a11y}>
      <Text style={readStyles.sectionLabel} maxFontSizeMultiplier={1.2} importantForAccessibility="no">
        {title}
      </Text>
      <View style={readStyles.list} importantForAccessibility="no">
        {visible.map((item) => (
          <Text key={`${title}-${item}`} style={readStyles.bullet} maxFontSizeMultiplier={1.3}>
            {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

const readStyles = StyleSheet.create({
  block: {
    gap: ydlSpace.xs,
    paddingVertical: ydlSpace.xs,
  },
  sectionLabel: {
    ...ydlTypography.label,
    color: C.muted,
    textTransform: "uppercase",
  },
  prose: {
    ...ydlTypography.callout,
    color: C.text,
    lineHeight: 22,
    fontWeight: "500",
  },
  support: {
    ...ydlTypography.footnote,
    color: C.sub,
    lineHeight: 20,
  },
  action: {
    ...ydlTypography.callout,
    color: C.green,
    lineHeight: 22,
    fontWeight: "600",
  },
  list: {
    gap: ydlSpace.sm,
  },
  bullet: {
    ...ydlTypography.footnote,
    color: C.text,
    lineHeight: 20,
    paddingLeft: ydlSpace.sm,
    borderLeftWidth: 2,
    borderLeftColor: C.border,
  },
});
