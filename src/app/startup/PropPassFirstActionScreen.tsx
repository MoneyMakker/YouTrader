import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { C } from "../../theme/colors";
import { t } from "../../i18n";

type Props = { userId: string; onStart: () => void };
type Setup = {
  primaryRisk?: string; readinessScore?: number; riskLevel?: string; modelVersion?: string;
  accountSize?: string; propFirm?: string; challengeStage?: string;
  stopLossBehavior?: string; riskPerTrade?: string; tradesPerDay?: string;
} | null;

const SETUP_KEY_PREFIX = "prop-pass-setup-v1:";
const COMPLETION_KEY_PREFIX = "yt-prop-pass-first-action-done-v1:";

function nc(key: string, fallback: string): string { const v = t(key); return v === key ? fallback : v; }

export function PropPassFirstActionScreen({ userId, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const [setup, setSetup] = useState<Setup>(null);
  const [accountSize, setAccountSize] = useState("");
  const [profitTarget, setProfitTarget] = useState("");
  const [dailyLoss, setDailyLoss] = useState("");
  const [overallLoss, setOverallLoss] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    void AsyncStorage.getItem(`${SETUP_KEY_PREFIX}${userId}`).then((raw) => {
      if (!raw) return;
      try { setSetup(JSON.parse(raw) as Setup); } catch { /* keep safe */ }
    });
  }, [userId]);

  useEffect(() => {
    void AsyncStorage.getItem(`${COMPLETION_KEY_PREFIX}${userId}`).then((v) => {
      if (v === "done") onStart();
    });
  }, [userId, onStart]);

  const needsFirm = !setup?.propFirm || setup.propFirm === "other";
  const needsExact = !setup?.accountSize || ["small", "medium", "large"].includes(setup.accountSize || "");

  const handleConfirm = useCallback(async () => {
    if (busyRef.current) return;
    setError("");

    const as = Number(accountSize);
    const pt = Number(profitTarget);
    const dl = Number(dailyLoss);
    const ol = Number(overallLoss);

    if (needsExact && (!accountSize || as <= 0)) { setError(nc("propPass.validation.accountSize", "Enter a valid account size.")); return; }
    if (!profitTarget || pt <= 0) { setError(nc("propPass.validation.profitTarget", "Enter a valid profit target.")); return; }
    if (!dailyLoss || dl <= 0) { setError(nc("propPass.validation.dailyLoss", "Enter a valid daily loss limit.")); return; }
    if (!overallLoss || ol <= 0) { setError(nc("propPass.validation.overallLoss", "Enter a valid overall loss limit.")); return; }
    if (dl >= ol) { setError(nc("propPass.validation.dailyBelowOverall", "Daily loss limit must be below the overall loss limit.")); return; }

    busyRef.current = true;
    try {
      const confirmed = {
        ...setup,
        accountSize: needsExact ? accountSize : setup?.accountSize,
        profitTarget,
        dailyLossLimit: dailyLoss,
        overallLossLimit: overallLoss,
        confirmedAt: new Date().toISOString(),
      };
      const key = `${SETUP_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(confirmed));
      const readBack = await AsyncStorage.getItem(key);
      if (!readBack) { setError(nc("propPass.validation.writeFailed", "Setup could not be verified. Try again.")); busyRef.current = false; return; }
      await AsyncStorage.setItem(`${COMPLETION_KEY_PREFIX}${userId}`, "done");
      onStart();
    } catch {
      setError(nc("propPass.validation.writeFailed", "Setup could not be verified. Try again."));
      busyRef.current = false;
    }
  }, [accountSize, profitTarget, dailyLoss, overallLoss, needsExact, userId, onStart, setup]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ShieldCheck color={C.green} size={38} strokeWidth={1.8} />
          <Text style={styles.eyebrow}>{nc("propPass.firstAction.eyebrow", "PROP PASS")}</Text>
          <Text style={styles.title}>{nc("propPass.firstAction.title", "Your Prop Pass Is Active")}</Text>
          <Text style={styles.body}>{nc("propPass.firstAction.body", "Enter your exact challenge limits to enable accurate buffer warnings.")}</Text>

          <View style={styles.card}>
            <Row label={nc("propPass.firstAction.readiness", "Readiness")} value={setup?.readinessScore != null ? `${setup.readinessScore}/100` : "—"} />
            <Row label={nc("propPass.firstAction.riskProfile", "Risk profile")} value={setup?.primaryRisk || "—"} />
            {needsFirm ? (
              <Row label={nc("propPass.firstAction.propFirm", "Prop firm")} value={nc("propPass.firstAction.confirmFirm", "Select your firm")} />
            ) : (
              <Row label={nc("propPass.firstAction.propFirm", "Prop firm")} value={setup?.propFirm || "—"} />
            )}
          </View>

          <View style={styles.fieldGroup}>
            {needsExact ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{nc("propPass.firstAction.accountSize", "Account size ($)")}</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 50000" placeholderTextColor={C.muted} value={accountSize} onChangeText={setAccountSize} />
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.profitTarget", "Profit target ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 3000" placeholderTextColor={C.muted} value={profitTarget} onChangeText={setProfitTarget} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.dailyLoss", "Daily loss limit ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 1000" placeholderTextColor={C.muted} value={dailyLoss} onChangeText={setDailyLoss} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.overallLoss", "Overall loss limit ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 2500" placeholderTextColor={C.muted} value={overallLoss} onChangeText={setOverallLoss} />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.primary} onPress={handleConfirm} testID="prop-pass-first-action-confirm">
            <Text style={styles.primaryLabel}>{nc("propPass.firstAction.confirmAndStart", "Confirm and Start Challenge")}</Text>
          </Pressable>
          <Text style={styles.note}>{nc("propPass.firstAction.note", "Limits remain disabled until confirmed.")}</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: "#06080C" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 18 },
  eyebrow: { color: C.green, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textAlign: "center" },
  title: { color: C.text, fontSize: 30, lineHeight: 36, fontWeight: "800", textAlign: "center" },
  body: { color: C.sub, fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.045)", padding: 16, gap: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { color: C.muted, fontSize: 13, fontWeight: "700" },
  value: { color: C.text, fontSize: 14, fontWeight: "800", textAlign: "right", flexShrink: 1 },
  fieldGroup: { gap: 12 },
  field: { gap: 6 },
  fieldLabel: { color: C.sub, fontSize: 13, fontWeight: "700" },
  input: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 16, color: C.text, fontSize: 16, fontWeight: "700" },
  errorText: { color: C.red, fontSize: 13, fontWeight: "700", textAlign: "center" },
  primary: { minHeight: 56, borderRadius: 17, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: "#05070A", fontSize: 16, fontWeight: "800" },
  note: { color: C.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
