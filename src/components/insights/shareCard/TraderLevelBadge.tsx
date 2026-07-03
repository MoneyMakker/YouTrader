import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EXPORT_COLORS } from "../exportDesign";

export function TraderScoreBadge({ score }: { score: number | null }) {
  return (
    <View style={styles.scoreBlock}>
      <Text style={styles.scoreNumber}>{score != null ? Math.round(score) : "--"}</Text>
      <Text style={styles.scoreLabel}>TRD</Text>
    </View>
  );
}

export function TraderLevelBadge({ tier, accentColor = EXPORT_COLORS.purple2 }: { tier: string; accentColor?: string }) {
  return (
    <View style={[styles.tierPill, { borderColor: `${accentColor}B8` }]}>
      <Text style={[styles.tierText, { color: accentColor }]}>{tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreBlock: {
    width: 142,
    height: 132,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(244,201,93,0.7)",
    backgroundColor: "rgba(0,0,0,0.36)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    color: EXPORT_COLORS.text,
    fontSize: 70,
    lineHeight: 74,
    fontWeight: "900",
  },
  scoreLabel: {
    color: EXPORT_COLORS.gold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: 2,
  },
  tierPill: {
    minWidth: 150,
    borderWidth: 2,
    backgroundColor: "rgba(176,38,255,0.13)",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  tierText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
