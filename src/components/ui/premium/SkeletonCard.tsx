import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ydlSpace } from "../../../ydl/space";
import { ydlStatusSkeleton } from "../../../ydl/status";
import { PremiumCard } from "./PremiumCard";
import { ShimmerPlaceholder } from "./ShimmerPlaceholder";
import type { PremiumTone } from "./tokens";

export type SkeletonCardProps = {
  rows?: number;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
};

/** Shared loading skeleton — consistent avatar + row shimmer. */
export function SkeletonCard({
  rows = 3,
  tone = "purple",
  style,
}: SkeletonCardProps) {
  return (
    <PremiumCard
      tone={tone}
      compact
      style={[styles.card, style]}
      contentStyle={styles.content}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <View style={styles.headerRow} importantForAccessibility="no-hide-descendants">
        <ShimmerPlaceholder
          width={ydlStatusSkeleton.avatar}
          height={ydlStatusSkeleton.avatar}
          radius={16}
          tone={tone}
        />
        <View style={styles.headerCopy}>
          <ShimmerPlaceholder width="58%" height={10} radius={999} tone={tone} />
          <ShimmerPlaceholder width="36%" height={7} radius={999} tone="neutral" />
        </View>
      </View>
      {Array.from({ length: rows }).map((_, index) => (
        <ShimmerPlaceholder
          key={`skeleton-row-${index}`}
          width={index === rows - 1 ? "68%" : "100%"}
          height={ydlStatusSkeleton.rowHeight}
          radius={999}
          tone={index % 2 === 0 ? tone : "neutral"}
        />
      ))}
    </PremiumCard>
  );
}

export type SkeletonStackProps = {
  count?: number;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonStack({
  count = 3,
  tone = "purple",
  style,
}: SkeletonStackProps) {
  return (
    <View style={[styles.stack, style]} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard
          key={`skeleton-stack-${index}`}
          rows={index === 0 ? 4 : 3}
          tone={index % 2 === 0 ? tone : "lime"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  content: {
    gap: ydlStatusSkeleton.gap,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ydlSpace.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: ydlSpace.xs,
  },
  stack: {
    gap: ydlSpace.sm,
  },
});
