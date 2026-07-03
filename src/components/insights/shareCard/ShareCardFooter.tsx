import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EXPORT_BRAND, EXPORT_COLORS } from "../exportDesign";

export function ShareCardFooter({ dateLabel }: { dateLabel?: string }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.title}>{EXPORT_BRAND.appStoreHint}</Text>
      <Text style={styles.sub}>
        {EXPORT_BRAND.disclaimer}
        {dateLabel ? ` • ${dateLabel}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(244,201,93,0.28)",
    paddingTop: 22,
    width: "100%",
    alignItems: "center",
  },
  title: {
    color: EXPORT_COLORS.text,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  sub: {
    color: EXPORT_COLORS.sub,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
});
