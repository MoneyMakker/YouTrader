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
  { id: "other", label: t("propPass.firstAction.otherFirm") },
] as const;

const CANONICAL_KEY = "prop-pass-canonical-setup-v1";
const LEGACY_KEY = CANONICAL_KEY; // old unscoped key

function scopedKey(userId: string): string {
  return `${CANONICAL_KEY}:${userId}`;
}

async function migrateLegacySetup(userId: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(scopedKey(userId));
    if (existing) return; // already have user-scoped data, don't overwrite
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const parsed = JSON.parse(legacy) as Partial<ConfirmedSetup>;
    if (parsed?.version === "prop-pass-canonical-v1" && parsed.propFirm && parsed.accountSize && parsed.profitTarget) {
      await AsyncStorage.setItem(scopedKey(userId), legacy);
      const verify = await AsyncStorage.getItem(scopedKey(userId));
      if (verify) await AsyncStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* best effort */ }
}

type AssessmentSetup = {
  modelVersion?: string; readinessScore?: number; riskControl?: number;
  discipline?: number; challengeBuffer?: number; primaryRisk?: string;
  riskLevel?: string; challengeStage?: string; stopLossBehavior?: string;
  riskPerTrade?: string; tradesPerDay?: string; propPassBenefitKeys?: string[];
  propFirm?: string; accountSize?: string;
} | null;

type ConfirmedSetup = {
  version: "prop-pass-canonical-v1";
  propFirm: string;
  propFirmDisplay: string;
  customFirmName?: string;
  accountSize: number;
  profitTarget: number;
  dailyLossLimit: number;
  overallLossLimit: number;
  limitsSource: "verified_template" | "user_confirmed";
  modelVersion?: string;
  readinessScore?: number;
  riskControl?: number;
  discipline?: number;
  challengeBuffer?: number;
  primaryRisk?: string;
  riskLevel?: string;
  challengeStage?: string;
  stopLossBehavior?: string;
  riskPerTrade?: string;
  tradesPerDay?: string;
  propPassBenefitKeys?: string[];
  confirmedAt: string;
};

function toNum(s: string): number | null { const n = Number(s.trim()); return Number.isFinite(n) && n > 0 ? n : null; }

export function PropPassFirstActionScreen({ userId, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const [assessment, setAssessment] = useState<AssessmentSetup>(null);
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
    void migrateLegacySetup(userId);
    const key = scopedKey(userId);
    void AsyncStorage.getItem(key).then((raw) => {
      if (!raw) return;
      try { const s = JSON.parse(raw) as Partial<ConfirmedSetup>; if (s.version === "prop-pass-canonical-v1" && s.propFirm && s.accountSize && s.profitTarget) { handledRef.current = true; onStart(); return; } } catch { /* ignore */ }
    });
    void AsyncStorage.getItem(`prop-pass-setup-v1:${userId}`).then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw) as AssessmentSetup;
        setAssessment(s);
        if (s?.propFirm && s.propFirm !== "other") { setFirm(s.propFirm); }
        if (s?.accountSize && !["small", "medium", "large"].includes(s.accountSize)) { setAccountSize(String(s.accountSize)); }
      } catch { /* ignore */ }
    });
  }, [userId, onStart]);

  const handleConfirm = useCallback(async () => {
    if (busyRef.current || handledRef.current) return;
    setError("");

    const selectedFirm = firm;
    if (!selectedFirm) { setError(t("propPass.validation.selectFirm")); return; }
    const isCustom = selectedFirm === "other";
    const firmName = isCustom ? customFirm.trim() : PROP_FIRMS.find((f) => f.id === selectedFirm)?.label || "";
    if (isCustom && !firmName) { setError(t("propPass.validation.enterFirmName")); return; }

    const asNum = toNum(accountSize);
    const ptNum = toNum(profitTarget);
    const dlNum = toNum(dailyLoss);
    const olNum = toNum(overallLoss);
    if (asNum === null) { setError(t("propPass.validation.accountSize")); return; }
    if (ptNum === null) { setError(t("propPass.validation.profitTarget")); return; }
    if (dlNum === null) { setError(t("propPass.validation.dailyLoss")); return; }
    if (olNum === null) { setError(t("propPass.validation.overallLoss")); return; }
    if (dlNum >= olNum) { setError(t("propPass.validation.dailyBelowOverall")); return; }

    busyRef.current = true;
    try {
      const confirmed: ConfirmedSetup = {
        version: "prop-pass-canonical-v1",
        propFirm: selectedFirm,
        propFirmDisplay: firmName,
        ...(isCustom ? { customFirmName: firmName } : {}),
        accountSize: asNum,
        profitTarget: ptNum,
        dailyLossLimit: dlNum,
        overallLossLimit: olNum,
        limitsSource: "user_confirmed",
        modelVersion: assessment?.modelVersion,
        readinessScore: assessment?.readinessScore,
        riskControl: assessment?.riskControl,
        discipline: assessment?.discipline,
        challengeBuffer: assessment?.challengeBuffer,
        primaryRisk: assessment?.primaryRisk,
        riskLevel: assessment?.riskLevel,
        challengeStage: assessment?.challengeStage,
        stopLossBehavior: assessment?.stopLossBehavior,
        riskPerTrade: assessment?.riskPerTrade,
        tradesPerDay: assessment?.tradesPerDay,
        propPassBenefitKeys: assessment?.propPassBenefitKeys,
        confirmedAt: new Date().toISOString(),
      };
      const key = scopedKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(confirmed));
      const readBack = await AsyncStorage.getItem(key);
      if (!readBack) { setError(t("propPass.validation.writeFailed")); busyRef.current = false; return; }
      let parsed: Partial<ConfirmedSetup> | null = null;
      try { parsed = JSON.parse(readBack) as Partial<ConfirmedSetup>; } catch { parsed = null; }
      if (!parsed || parsed.version !== confirmed.version || parsed.propFirm !== confirmed.propFirm || parsed.accountSize !== confirmed.accountSize || parsed.profitTarget !== confirmed.profitTarget || parsed.dailyLossLimit !== confirmed.dailyLossLimit || parsed.overallLossLimit !== confirmed.overallLossLimit) {
        setError(t("propPass.validation.writeFailed")); busyRef.current = false; return;
      }
      handledRef.current = true;
      onStart();
    } catch {
      setError(t("propPass.validation.writeFailed"));
      busyRef.current = false;
    }
  }, [firm, customFirm, accountSize, profitTarget, dailyLoss, overallLoss, userId, onStart]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ShieldCheck color={C.green} size={38} strokeWidth={1.8} />
          <Text style={styles.eyebrow}>{t("propPass.firstAction.eyebrow")}</Text>
          <Text style={styles.title}>{t("propPass.firstAction.title")}</Text>
          <Text style={styles.body}>{t("propPass.firstAction.body")}</Text>

          <Text style={styles.sectionLabel}>{t("propPass.firstAction.propFirm")}</Text>
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
            <TextInput style={styles.input} placeholder={t("propPass.firstAction.customFirm")} placeholderTextColor={C.muted} value={customFirm} onChangeText={(v) => { setCustomFirm(v); setError(""); }} />
          ) : null}

          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t("propPass.firstAction.accountSize")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="50000" placeholderTextColor={C.muted} value={accountSize} onChangeText={setAccountSize} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t("propPass.firstAction.profitTarget")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="3000" placeholderTextColor={C.muted} value={profitTarget} onChangeText={setProfitTarget} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t("propPass.firstAction.dailyLoss")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor={C.muted} value={dailyLoss} onChangeText={setDailyLoss} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t("propPass.firstAction.overallLoss")}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="2500" placeholderTextColor={C.muted} value={overallLoss} onChangeText={setOverallLoss} />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.primary} onPress={handleConfirm} testID="prop-pass-first-action-confirm">
            <Text style={styles.primaryLabel}>{t("propPass.firstAction.confirmAndStart")}</Text>
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
