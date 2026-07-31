import React from "react";
import { Dimensions, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { getLastStartupCheckpoint } from "../lib/startupPerf";

type Props = {
  reasonCode: string;
  onRetry: () => void;
  onSignOut?: () => void;
};

/**
 * Minimal fallback — no premium/YDL deps — so SafeArea or design-system
 * failures cannot recursively blank the screen.
 */
export function StartupFailureFallback({ reasonCode, onRetry, onSignOut }: Props) {
  const diagnosticId = `yt-start-${Date.now().toString(36)}-${getLastStartupCheckpoint() || "none"}`;

  const shareDiagnostic = () => {
    void Share.share({ message: diagnosticId }).catch(() => {});
  };

  return (
    <View style={styles.root} accessibilityRole="summary">
      <Text style={styles.title}>YouTrader couldn’t finish starting.</Text>
      <Text style={styles.reason}>Reason: {reasonCode}</Text>
      <Text style={styles.meta}>Diagnostic: {diagnosticId}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryBtn}>
        <Text style={styles.primaryText}>Retry</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={shareDiagnostic} style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>Copy diagnostic ID</Text>
      </Pressable>
      {onSignOut ? (
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Sign out / reset session</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: Dimensions.get("window").height * 0.5,
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  reason: {
    color: "#A3FF12",
    fontSize: 15,
    marginBottom: 8,
  },
  meta: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: "#A3FF12",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});
