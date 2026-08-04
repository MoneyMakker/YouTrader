import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "../../config/appConfig";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import type { PropPassLiveRiskSettings } from "../persistence";

type TradingMode = "calm" | "balanced" | "gambler";
type Draft = Readonly<{
  dailyRiskBudget: string;
  weeklyLossLimit: string;
  maximumDrawdown: string;
  perTradeRiskCap: string;
  maximumTrades: string;
  consecutiveLossLimit: string;
  recoveryThresholdPercent: string;
  normalRiskPerTrade: string;
  normalMaximumContracts: string;
  recoveryRiskPercent: string;
  minimumCompliantSessions: string;
}>;

const EMPTY_DRAFT: Draft = {
  dailyRiskBudget: "",
  weeklyLossLimit: "",
  maximumDrawdown: "",
  perTradeRiskCap: "",
  maximumTrades: "",
  consecutiveLossLimit: "",
  recoveryThresholdPercent: "",
  normalRiskPerTrade: "",
  normalMaximumContracts: "",
  recoveryRiskPercent: "",
  minimumCompliantSessions: "",
};

export function PropPassLiveSettingsEditor({ accountId, onSaved }: { accountId: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [mode, setMode] = useState<TradingMode>("balanced");
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setLoadError(true); setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    setDraft(EMPTY_DRAFT);
    const result = await supabase.from("prop_live_risk_settings").select("payload").eq("account_id", accountId).maybeSingle();
    if (result.error) { setLoadError(true); setLoading(false); return; }
    const settings = parseSettings(result.data?.payload);
    if (result.data?.payload != null && !settings) setLoadError(true);
    if (settings) {
      setDraft(toDraft(settings));
      setMode(settings.selectedMode ?? "balanced");
      setWeekStartsOn(settings.weekStartsOn ?? 1);
    }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  const canSave = Object.values(draft).every((value) => value.trim().length > 0);
  const update = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!supabase || saving) return;
    const parsed = parseDraft(draft, mode, weekStartsOn);
    if (!parsed) {
      Alert.alert(t("propPass.liveSettings.validationTitle"), t("propPass.liveSettings.validationBody"));
      return;
    }
    setSaving(true);
    const result = await supabase.functions.invoke("prop-pass-runtime-processor", {
      body: { op: "save_live_settings", accountId, settings: parsed },
    });
    setSaving(false);
    const report = (result.data as { kind?: unknown; report?: { failed?: unknown } } | null)?.report;
    if (result.error || (result.data as { kind?: unknown } | null)?.kind !== "success" || report?.failed !== 0) {
      Alert.alert(t("propPass.liveSettings.saveFailedTitle"), t("propPass.liveSettings.saveFailedBody"));
      return;
    }
    Alert.alert(t("propPass.liveSettings.saveSuccessTitle"), t("propPass.liveSettings.saveSuccessBody"));
    onSaved();
    void load();
  };

  if (loading) return <YdlCard><YdlText role="body" color="text.secondary">{t("propPass.liveSettings.loading")}</YdlText></YdlCard>;
  if (loadError) return <YdlCard><YdlText role="bodyEmphasized">{t("propPass.liveSettings.loadErrorTitle")}</YdlText><YdlText role="body" color="text.secondary">{t("propPass.liveSettings.loadErrorBody")}</YdlText><YdlButton label={t("propPass.commandCenter.retry")} variant="secondary" onPress={() => void load()} /></YdlCard>;

  return (
    <View style={styles.stack} testID="prop-pass-live-settings-editor">
      <YdlCard>
        <YdlText role="bodyEmphasized">{t("propPass.liveSettings.sourceTitle")}</YdlText>
        <YdlText role="caption" color="text.secondary">{t("propPass.liveSettings.sourceBody")}</YdlText>
      </YdlCard>
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        {(["calm", "balanced", "gambler"] as const).map((item) => <YdlButton key={item} label={t(`propPass.riskMode.${item}`)} size="small" variant={mode === item ? "primary" : "secondary"} onPress={() => setMode(item)} />)}
      </View>
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        <YdlButton label={t("propPass.liveSettings.weekStartsMonday")} size="small" variant={weekStartsOn === 1 ? "primary" : "secondary"} onPress={() => setWeekStartsOn(1)} />
        <YdlButton label={t("propPass.liveSettings.weekStartsSunday")} size="small" variant={weekStartsOn === 0 ? "primary" : "secondary"} onPress={() => setWeekStartsOn(0)} />
      </View>
      <View style={styles.grid}>
        <LiveSettingsField label={t("propPass.liveSettings.dailyRiskBudget")} suffix="$" value={draft.dailyRiskBudget} onChange={(value) => update("dailyRiskBudget", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.weeklyLossLimit")} suffix="$" value={draft.weeklyLossLimit} onChange={(value) => update("weeklyLossLimit", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.maximumDrawdown")} suffix="$" value={draft.maximumDrawdown} onChange={(value) => update("maximumDrawdown", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.perTradeRiskCap")} suffix="$" value={draft.perTradeRiskCap} onChange={(value) => update("perTradeRiskCap", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.maximumTrades")} value={draft.maximumTrades} integer onChange={(value) => update("maximumTrades", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.consecutiveLossStop")} value={draft.consecutiveLossLimit} integer onChange={(value) => update("consecutiveLossLimit", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.recoveryActivation")} suffix="%" value={draft.recoveryThresholdPercent} onChange={(value) => update("recoveryThresholdPercent", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.normalRiskPerTrade")} suffix="$" value={draft.normalRiskPerTrade} onChange={(value) => update("normalRiskPerTrade", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.normalMaxContracts")} value={draft.normalMaximumContracts} integer onChange={(value) => update("normalMaximumContracts", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.recoveryRisk")} suffix={t("propPass.liveSettings.percentOfNormal")} value={draft.recoveryRiskPercent} onChange={(value) => update("recoveryRiskPercent", value)} />
        <LiveSettingsField label={t("propPass.liveSettings.compliantSessionsToExit")} value={draft.minimumCompliantSessions} integer onChange={(value) => update("minimumCompliantSessions", value)} />
      </View>
      <YdlButton label={t("propPass.liveSettings.saveCta")} fullWidth loading={saving} disabled={!canSave} onPress={() => void save()} testID="prop-pass-save-live-settings" />
    </View>
  );

}

export function PropPassSessionLockControl({ accountId, active, onActivated }: { accountId: string; active: boolean; onActivated: () => void }) {
  const { t } = useTranslation();
  const [activating, setActivating] = useState(false);
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState<2 | 24>(2);
  const activate = () => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      Alert.alert(t("propPass.sessionLock.reasonRequiredTitle"), t("propPass.sessionLock.reasonRequiredBody"));
      return;
    }
    Alert.alert(
      t("propPass.sessionLock.confirmTitle"),
      t("propPass.sessionLock.confirmBody", { reason: normalizedReason }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("propPass.sessionLock.confirmCta"),
          style: "destructive",
          onPress: async () => {
            if (!supabase) return;
            setActivating(true);
            const result = await supabase.functions.invoke("prop-pass-runtime-processor", {
              body: {
                op: "activate_session_lock",
                accountId,
                confirm: true,
                reason: normalizedReason,
                expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1_000).toISOString(),
              },
            });
            setActivating(false);
            const body = result.data as { kind?: unknown; report?: { failed?: unknown } } | null;
            if (result.error || body?.kind !== "success" || body.report?.failed !== 0) {
              Alert.alert(t("propPass.sessionLock.activateFailedTitle"), t("propPass.sessionLock.activateFailedBody"));
              return;
            }
            Alert.alert(t("propPass.sessionLock.activateSuccessTitle"), t("propPass.sessionLock.activateSuccessBody"));
            onActivated();
          },
        },
      ],
    );
  };
  if (active) return <YdlButton label={t("propPass.commandCenter.killSwitchActive")} variant="destructive" fullWidth disabled onPress={activate} testID="prop-pass-activate-session-lock" />;
  return (
    <View style={styles.stack}>
      <LiveSettingsField label={t("propPass.sessionLock.reasonLabel")} value={reason} onChange={setReason} />
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        <YdlButton label={t("propPass.sessionLock.reviewIn2Hours")} size="small" variant={durationHours === 2 ? "primary" : "secondary"} onPress={() => setDurationHours(2)} />
        <YdlButton label={t("propPass.sessionLock.reviewIn24Hours")} size="small" variant={durationHours === 24 ? "primary" : "secondary"} onPress={() => setDurationHours(24)} />
      </View>
      <YdlButton label={t("propPass.sessionLock.lockCta")} variant="destructive" fullWidth disabled={!reason.trim()} loading={activating} onPress={activate} testID="prop-pass-activate-session-lock" />
    </View>
  );
}

function LiveSettingsField({ label, suffix, value, integer = false, onChange }: { label: string; suffix?: string; value: string; integer?: boolean; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  return <View style={styles.field}><YdlText role="caption" color="text.secondary">{label}{suffix ? ` (${suffix})` : ""}</YdlText><TextInput value={value} onChangeText={onChange} keyboardType={integer ? "number-pad" : "decimal-pad"} accessibilityLabel={label} placeholder={t("propPass.liveSettings.requiredPlaceholder")} placeholderTextColor={theme.colors.text.secondary} style={[styles.input, { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.interactive, borderColor: theme.colors.border.subtle }]} /></View>;
}

function parseSettings(value: unknown): PropPassLiveRiskSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  const rules = settings.rules;
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return null;
  const row = rules as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  if (settings.selectedMode != null && !isMode(settings.selectedMode)) return null;
  if (settings.weekStartsOn != null && settings.weekStartsOn !== 0 && settings.weekStartsOn !== 1) return null;
  const numeric = [row.dailyRiskBudgetMinor, row.weeklyLossLimitMinor, row.maximumDrawdownMinor, row.perTradeRiskCapMinor, row.maximumTrades, row.consecutiveLossLimit, row.recoveryModeThresholdBps, settings.normalRiskPerTradeMinor, settings.normalMaximumContracts, settings.recoveryRiskBps, settings.minimumCompliantProfitableSessions];
  if (!numeric.every((item) => item == null || (Number.isSafeInteger(item) && Number(item) >= 0))) return null;
  if (settings.minimumCompliantProfitableSessions != null && Number(settings.minimumCompliantProfitableSessions) < 2) return null;
  if (typeof settings.configuredAt !== "string" || Number.isNaN(Date.parse(settings.configuredAt))) return null;
  return value as PropPassLiveRiskSettings;
}

function parseDraft(draft: Draft, mode: TradingMode, weekStartsOn: 0 | 1): PropPassLiveRiskSettings | null {
  const moneyValues = [draft.dailyRiskBudget, draft.weeklyLossLimit, draft.maximumDrawdown, draft.perTradeRiskCap, draft.normalRiskPerTrade].map(parseMoneyMinor);
  const ints = [draft.maximumTrades, draft.consecutiveLossLimit, draft.normalMaximumContracts, draft.minimumCompliantSessions].map(parseInteger);
  const percentages = [draft.recoveryThresholdPercent, draft.recoveryRiskPercent].map(parseBasisPoints);
  if ([...moneyValues, ...ints, ...percentages].some((value) => value == null)) return null;
  const [maximumTrades, consecutiveLossLimit, normalMaximumContracts, minimumCompliantProfitableSessions] = ints as number[];
  if (maximumTrades < 1 || consecutiveLossLimit < 1 || normalMaximumContracts < 1 || minimumCompliantProfitableSessions < 2) return null;
  return {
    rules: { id: "live.custom.v1", dailyRiskBudgetMinor: moneyValues[0]!, weeklyLossLimitMinor: moneyValues[1]!, maximumDrawdownMinor: moneyValues[2]!, perTradeRiskCapMinor: moneyValues[3]!, maximumTrades, consecutiveLossLimit, recoveryModeThresholdBps: percentages[0]! },
    configuredAt: new Date().toISOString(), selectedMode: mode, weekStartsOn,
    normalRiskPerTradeMinor: moneyValues[4]!, normalMaximumContracts,
    recoveryRiskBps: percentages[1]!, minimumCompliantProfitableSessions,
  };
}

function toDraft(settings: PropPassLiveRiskSettings): Draft {
  return {
    dailyRiskBudget: fromMinor(settings.rules.dailyRiskBudgetMinor), weeklyLossLimit: fromMinor(settings.rules.weeklyLossLimitMinor), maximumDrawdown: fromMinor(settings.rules.maximumDrawdownMinor), perTradeRiskCap: fromMinor(settings.rules.perTradeRiskCapMinor), maximumTrades: String(settings.rules.maximumTrades ?? ""), consecutiveLossLimit: String(settings.rules.consecutiveLossLimit ?? ""), recoveryThresholdPercent: fromBps(settings.rules.recoveryModeThresholdBps), normalRiskPerTrade: fromMinor(settings.normalRiskPerTradeMinor), normalMaximumContracts: String(settings.normalMaximumContracts ?? ""), recoveryRiskPercent: fromBps(settings.recoveryRiskBps), minimumCompliantSessions: String(settings.minimumCompliantProfitableSessions ?? ""),
  };
}
function parseMoneyMinor(value: string): number | null { const normalized = value.trim().replace(",", "."); if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null; const [whole, fraction = ""] = normalized.split("."); const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0")); return Number.isSafeInteger(minor) ? minor : null; }
function parseBasisPoints(value: string): number | null { const normalized = value.trim().replace(",", "."); if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null; const bps = Number(normalized) * 100; return Number.isSafeInteger(bps) && bps <= 10_000 ? bps : null; }
function parseInteger(value: string): number | null { if (!/^(?:0|[1-9]\d*)$/.test(value.trim())) return null; const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : null; }
function fromMinor(value: number | undefined): string { return value == null ? "" : (value / 100).toFixed(2); }
function fromBps(value: number | undefined): string { return value == null ? "" : (value / 100).toFixed(2); }
function isMode(value: unknown): value is TradingMode { return value === "calm" || value === "balanced" || value === "gambler"; }

const styles = StyleSheet.create({ stack: { gap: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, field: { width: "48%", gap: 5 }, input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontVariant: ["tabular-nums"] }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
