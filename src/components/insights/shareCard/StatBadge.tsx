import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EXPORT_COLORS } from "../exportDesign";

export function StatBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function StatBadgeRail({ labels }: { labels: string[] }) {
  return (
    <View style={styles.rail}>
      {labels.map((label) => (
        <StatBadge key={label} label={label} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14,
    width: "100%",
  },
  badge: {
    borderWidth: 2,
    borderColor: "rgba(156,255,0,0.46)",
    backgroundColor: "rgba(156,255,0,0.10)",
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  text: {
    color: EXPORT_COLORS.green,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
});
