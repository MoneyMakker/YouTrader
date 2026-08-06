import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { C } from "../../theme/colors";
import { t } from "../../i18n";

type Props = { userId: string; onStart: () => void };
type Setup = {
  primaryRisk?: string;
  readinessScore?: number;
  riskLevel?: string;
  modelVersion?: string;
  accountSize?: string;
  propFirm?: string;
  challengeStage?: string;
  stopLossBehavior?: string;
  riskPerTrade?: string;
  tradesPerDay?: string;
} | null;

const COMPLETION_KEY_PREFIX = "yt-prop-pass-first-action-done-v1:";

function copy(key: string, fallback: string): string {
  const val = t(key);
  return val === key ? fallback : val;
}

export function PropPassFirstActionScreen({ userId, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const [setup, setSetup] = useState<Setup>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    void AsyncStorage.getItem(`prop-pass-setup-v1:${userId}`).then((raw) => {
      if (!raw) return;
      try { setSetup(JSON.parse(raw) as Setup); } catch { /* keep safe fallback */ }
    });
  }, [userId]);

  const handleStart = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    void AsyncStorage.setItem(`${COMPLETION_KEY_PREFIX}${userId}`, "done");
    onStart();
  }, [userId, onStart]);

  const needsConfirm = !setup?.accountSize || ["small", "medium", "large"].includes(setup.accountSize || "");
  const needsFirmConfirm = !setup?.propFirm || setup.propFirm === "other";
  const riskDesc =
    setup?.riskPerTrade === "lowRisk" ? "Under 0.5% per trade"
    : setup?.riskPerTrade === "mediumRisk" ? "0.5–1% per trade"
    : setup?.riskPerTrade === "highRisk" ? "Conservative cap required"
    : "Confirm in challenge rules";
  const stopDesc =
    setup?.stopLossBehavior === "never" ? "Keep fixed invalidation"
    : setup?.stopLossBehavior === "occasionally" ? "Use with caution"
    : setup?.stopLossBehavior === "often" || setup?.stopLossBehavior === "remove"
      ? "Requires strict guardrails"
      : "Review stop-loss behavior";

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ShieldCheck color={C.green} size={38} strokeWidth={1.8} />
        <Text style={styles.eyebrow}>{copy("propPass.firstAction.eyebrow", "PROP PASS")}</Text>
        <Text style={styles.title}>{copy("propPass.firstAction.title", "Your Prop Pass Is Active")}</Text>
        <Text style={styles.body}>{copy("propPass.firstAction.body", "Your personalized guardrails are ready. Confirm your challenge limits before enabling authoritative warnings.")}</Text>
        <View style={styles.card}>
          <Row label={copy("propPass.firstAction.readiness", "Readiness score")} value={setup?.readinessScore != null ? `${setup.readinessScore}/100` : "Ready"} />
          <Row label={copy("propPass.firstAction.riskProfile", "Risk profile")} value={setup?.primaryRisk || "Review required"} />
          <Row label={copy("propPass.firstAction.recommendedRisk", "Recommended risk")} value={riskDesc} />
          <Row label={copy("propPass.firstAction.stopLoss", "Stop-loss behavior")} value={stopDesc} />
          {needsConfirm ? (
            <Row label={copy("propPass.firstAction.accountSize", "Account size")} value={copy("propPass.firstAction.confirmLimits", "Confirm your challenge limits")} />
          ) : (
            <Row label={copy("propPass.firstAction.accountSize", "Account size")} value={setup?.accountSize || "—"} />
          )}
          <Row label={copy("propPass.firstAction.tradeGuardrail", "Trade guardrail")} value={setup?.riskLevel === "high" ? copy("propPass.firstAction.conservative", "Conservative") : copy("propPass.firstAction.reviewBefore", "Review before start")} />
        </View>
        {needsConfirm || needsFirmConfirm ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{needsFirmConfirm
              ? copy("propPass.firstAction.firmConfirmBody", "Select your exact prop firm and challenge account size so accurate limits can be calculated.")
              : copy("propPass.firstAction.accountConfirmBody", "Enter your exact challenge account size so buffer limits are accurate.")}</Text>
          </View>
        ) : null}
        <Pressable style={styles.primary} onPress={handleStart} testID="prop-pass-first-action">
          <Text style={styles.primaryLabel}>{needsConfirm || needsFirmConfirm
            ? copy("propPass.firstAction.confirmAndStart", "Confirm and Start Challenge")
            : copy("propPass.firstAction.start", "Start My Challenge")}</Text>
        </Pressable>
        <Text style={styles.note}>{copy("propPass.firstAction.note", "Firm limits remain disabled until you confirm the challenge rules.")}</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06080C" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 18 },
  eyebrow: { color: C.green, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textAlign: "center" },
  title: { color: C.text, fontSize: 32, lineHeight: 38, fontWeight: "800", textAlign: "center" },
  body: { color: C.sub, fontSize: 16, lineHeight: 23, textAlign: "center" },
  card: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.045)", padding: 16, gap: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { color: C.muted, fontSize: 13, fontWeight: "700" },
  value: { color: C.text, fontSize: 14, fontWeight: "800", textAlign: "right", flexShrink: 1 },
  warnBox: { borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(163,255,18,0.06)", padding: 12 },
  warnText: { color: C.sub, fontSize: 13, lineHeight: 18, textAlign: "center" },
  primary: { minHeight: 56, borderRadius: 17, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: "#05070A", fontSize: 16, fontWeight: "800" },
  note: { color: C.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
