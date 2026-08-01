/**
 * Staging-only invisible markers for Maestro reset completion.
 * Must not be mounted in production.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";

import {
  STAGING_QA_RESET_A11Y,
  a11yIdForResetPhase,
  type StagingQaResetPhase,
} from "./stagingQaResetState";

type Props = {
  phase: StagingQaResetPhase;
  mode: string | null;
  error?: string | null;
};

export function StagingQaResetMarkers({ phase, mode, error }: Props) {
  const terminalId = a11yIdForResetPhase(phase);
  return (
    <View pointerEvents="none" style={styles.root} accessible={false}>
      {phase !== "idle" && phase !== "reset_complete" && phase !== "reset_failed" ? (
        <View
          testID={STAGING_QA_RESET_A11Y.inProgress}
          accessibilityLabel={STAGING_QA_RESET_A11Y.inProgress}
          accessible
          importantForAccessibility="yes"
          style={styles.dot}
        />
      ) : null}
      {terminalId ? (
        <View
          testID={terminalId}
          accessibilityLabel={terminalId}
          accessible
          importantForAccessibility="yes"
          style={styles.dot}
        />
      ) : null}
      {mode ? (
        <Text
          testID={STAGING_QA_RESET_A11Y.mode}
          accessibilityLabel={`${STAGING_QA_RESET_A11Y.mode}.${mode}`}
          accessible
          importantForAccessibility="yes"
          style={styles.hiddenText}
        >
          {mode}
        </Text>
      ) : null}
      <Text
        testID={STAGING_QA_RESET_A11Y.phase}
        accessibilityLabel={`${STAGING_QA_RESET_A11Y.phase}.${phase}`}
        accessible
        importantForAccessibility="yes"
        style={styles.hiddenText}
      >
        {phase}
        {error ? `:${error}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    opacity: 0.05,
    zIndex: 9999,
  },
  dot: { width: 8, height: 8, backgroundColor: "#00ff00" },
  hiddenText: { fontSize: 8, color: "#00ff00", height: 8 },
});
