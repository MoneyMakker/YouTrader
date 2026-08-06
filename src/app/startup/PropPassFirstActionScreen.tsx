import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { C } from "../../theme/colors";
import { t } from "../../i18n";

type Props = { userId: string; onStart: () => void };
type Setup = { primaryRisk?: string; readinessScore?: number; riskLevel?: string; modelVersion?: string } | null;

export function PropPassFirstActionScreen({ userId, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const [setup, setSetup] = useState<Setup>(null);

  useEffect(() => {
    void AsyncStorage.getItem(`prop-pass-setup-v1:${userId}`).then((raw) => {
      if (!raw) return;
      try { setSetup(JSON.parse(raw) as Setup); } catch { /* keep safe fallback */ }
    });
  }, [userId]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ShieldCheck color={C.green} size={38} strokeWidth={1.8} />
        <Text style={styles.eyebrow}>PROP PASS</Text>
        <Text style={styles.title}>Your Prop Pass Is Active</Text>
        <Text style={styles.body}>Your personalized guardrails are ready. Confirm your challenge limits before enabling authoritative warnings.</Text>
        <View style={styles.card}>
          <Row label="Readiness score" value={setup?.readinessScore != null ? `${setup.readinessScore}/100` : "Ready"} />
          <Row label="Risk profile" value={setup?.primaryRisk || "Review required"} />
          <Row label="Recommended risk" value="Confirm your challenge limits" />
          <Row label="Trade guardrail" value={setup?.riskLevel === "high" ? "Conservative" : "Review before start"} />
        </View>
        <Pressable style={styles.primary} onPress={onStart} testID="prop-pass-first-action">
          <Text style={styles.primaryLabel}>Start My Challenge</Text>
        </Pressable>
        <Text style={styles.note}>Firm limits remain disabled until you confirm the challenge rules.</Text>
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
  primary: { minHeight: 56, borderRadius: 17, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: "#05070A", fontSize: 16, fontWeight: "800" },
  note: { color: C.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
