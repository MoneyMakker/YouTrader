import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { C } from "../../theme/colors";
import { t } from "../../i18n";

type Props = { userId: string; onStart: () => void };

const PROP_FIRMS = [
  { id: "topstep", label: "Topstep" },
  { id: "ftmo", label: "FTMO" },
  { id: "fundedNext", label: "FundedNext" },
  { id: "apex", label: "Apex Trader Funding" },
  { id: "takeProfit", label: "Take Profit Trader" },
  { id: "myFundedFutures", label: "My Funded Futures" },
  { id: "other", label: "Other" },
] as const;

const VERSION = "prop-pass-setup-v2";
const RESULT_VERSION = "prop-pass-result-v2";

type ConfirmedSetup = {
  version: typeof VERSION;
  propFirm: string;
  propFirmDisplay: string;
  customFirmName?: string;
  accountSize: number;
  profitTarget: number;
  dailyLossLimit: number;
  overallLossLimit: number;
  limitsSource: "verified_template" | "user_confirmed";
  primaryRisk?: string;
  readinessScore?: number;
  riskLevel?: string;
  confirmedAt: string;
};

function nc(k: string, f: string): string { const v = t(k); return v === k ? f : v; }
function toNum(s: string): number | null { const n = Number(s.trim()); return Number.isFinite(n) && n > 0 ? n : null; }

export function PropPassFirstActionScreen({ userId, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const [firm, setFirm] = useState("");
  const [customFirm, setCustomFirm] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [profitTarget, setProfitTarget] = useState("");
  const [dailyLoss, setDailyLoss] = useState("");
  const [overallLoss, setOverallLoss] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const handledRef = useRef(false);

  useEffect(() => {
    void AsyncStorage.getItem(`${RESULT_VERSION}:${userId}`).then((raw) => {
      if (!raw) return;
      try { const s = JSON.parse(raw) as Partial<ConfirmedSetup>; if (s.version === VERSION && s.propFirm && s.accountSize && s.profitTarget) { handledRef.current = true; onStart(); return; } } catch { /* ignore */ }
    });
  }, [userId, onStart]);

  const handleConfirm = useCallback(async () => {
    if (busyRef.current || handledRef.current) return;
    setError("");

    const selectedFirm = firm;
    if (!selectedFirm) { setError(nc("propPass.validation.selectFirm", "Select a prop firm.")); return; }
    const isCustom = selectedFirm === "other";
    const firmName = isCustom ? customFirm.trim() : PROP_FIRMS.find((f) => f.id === selectedFirm)?.label || "";
    if (isCustom && !firmName) { setError(nc("propPass.validation.enterFirmName", "Enter your prop firm name.")); return; }

    const asNum = toNum(accountSize);
    const ptNum = toNum(profitTarget);
    const dlNum = toNum(dailyLoss);
    const olNum = toNum(overallLoss);
    if (asNum === null) { setError(nc("propPass.validation.accountSize", "Enter a valid account size.")); return; }
    if (ptNum === null) { setError(nc("propPass.validation.profitTarget", "Enter a valid profit target.")); return; }
    if (dlNum === null) { setError(nc("propPass.validation.dailyLoss", "Enter a valid daily loss limit.")); return; }
    if (olNum === null) { setError(nc("propPass.validation.overallLoss", "Enter a valid overall loss limit.")); return; }
    if (dlNum >= olNum) { setError(nc("propPass.validation.dailyBelowOverall", "Daily loss limit must be below the overall loss limit.")); return; }

    busyRef.current = true;
    try {
      const confirmed: ConfirmedSetup = {
        version: VERSION,
        propFirm: selectedFirm,
        propFirmDisplay: firmName,
        ...(isCustom ? { customFirmName: firmName } : {}),
        accountSize: asNum,
        profitTarget: ptNum,
        dailyLossLimit: dlNum,
        overallLossLimit: olNum,
        limitsSource: "user_confirmed",
        confirmedAt: new Date().toISOString(),
      };
      const key = `${RESULT_VERSION}:${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(confirmed));
      const readBack = await AsyncStorage.getItem(key);
      if (!readBack) { setError(nc("propPass.validation.writeFailed", "Setup could not be verified. Try again.")); busyRef.current = false; return; }
      let parsed: Partial<ConfirmedSetup> | null = null;
      try { parsed = JSON.parse(readBack) as Partial<ConfirmedSetup>; } catch { parsed = null; }
      if (!parsed || parsed.version !== VERSION || parsed.propFirm !== confirmed.propFirm || parsed.accountSize !== confirmed.accountSize || parsed.profitTarget !== confirmed.profitTarget || parsed.dailyLossLimit !== confirmed.dailyLossLimit || parsed.overallLossLimit !== confirmed.overallLossLimit) {
        setError(nc("propPass.validation.writeFailed", "Setup verification failed. Try again.")); busyRef.current = false; return;
      }
      handledRef.current = true;
      onStart();
    } catch {
      setError(nc("propPass.validation.writeFailed", "Setup could not be verified. Try again."));
      busyRef.current = false;
    }
  }, [firm, customFirm, accountSize, profitTarget, dailyLoss, overallLoss, userId, onStart]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ShieldCheck color={C.green} size={38} strokeWidth={1.8} />
          <Text style={styles.eyebrow}>{nc("propPass.firstAction.eyebrow", "PROP PASS")}</Text>
          <Text style={styles.title}>{nc("propPass.firstAction.title", "Your Prop Pass Is Active")}</Text>
          <Text style={styles.body}>{nc("propPass.firstAction.body", "Enter your exact challenge limits to enable accurate buffer warnings.")}</Text>

          <Text style={styles.sectionLabel}>{nc("propPass.firstAction.propFirm", "Prop firm")}</Text>
          <View style={styles.firmGrid}>
            {PROP_FIRMS.map((pf) => (
              <Pressable key={pf.id} onPress={() => { setFirm(pf.id); setError(""); }}
                style={[styles.firmChip, firm === pf.id && styles.firmChipSelected]}
                testID={`prop-firm-${pf.id}`}>
                <Text style={[styles.firmChipText, firm === pf.id && styles.firmChipTextSelected]}>{pf.label}</Text>
              </Pressable>
            ))}
          </View>
          {firm === "other" ? (
            <TextInput style={styles.input} placeholder={nc("propPass.firstAction.customFirm", "Custom firm name")} placeholderTextColor={C.muted} value={customFirm} onChangeText={(v) => { setCustomFirm(v); setError(""); }} />
          ) : null}

          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.accountSize", "Account size ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="50000" placeholderTextColor={C.muted} value={accountSize} onChangeText={setAccountSize} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.profitTarget", "Profit target ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="3000" placeholderTextColor={C.muted} value={profitTarget} onChangeText={setProfitTarget} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.dailyLoss", "Daily loss limit ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor={C.muted} value={dailyLoss} onChangeText={setDailyLoss} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{nc("propPass.firstAction.overallLoss", "Overall loss limit ($)")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="2500" placeholderTextColor={C.muted} value={overallLoss} onChangeText={setOverallLoss} />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.primary} onPress={handleConfirm} testID="prop-pass-first-action-confirm">
            <Text style={styles.primaryLabel}>{nc("propPass.firstAction.confirmAndStart", "Confirm and Start Challenge")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: "#06080C" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 18 },
  eyebrow: { color: C.green, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textAlign: "center" },
  title: { color: C.text, fontSize: 30, lineHeight: 36, fontWeight: "800", textAlign: "center" },
  body: { color: C.sub, fontSize: 15, lineHeight: 22, textAlign: "center" },
  sectionLabel: { color: C.sub, fontSize: 14, fontWeight: "800", marginTop: 4 },
  firmGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  firmChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)" },
  firmChipSelected: { borderColor: C.green, backgroundColor: "rgba(163,255,18,0.12)" },
  firmChipText: { color: C.text, fontSize: 13, fontWeight: "700" },
  firmChipTextSelected: { color: C.green },
  fieldGroup: { gap: 12 },
  field: { gap: 6 },
  fieldLabel: { color: C.sub, fontSize: 13, fontWeight: "700" },
  input: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 16, color: C.text, fontSize: 16, fontWeight: "700" },
  errorText: { color: C.red, fontSize: 13, fontWeight: "700", textAlign: "center" },
  primary: { minHeight: 56, borderRadius: 17, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: "#05070A", fontSize: 16, fontWeight: "800" },
});
