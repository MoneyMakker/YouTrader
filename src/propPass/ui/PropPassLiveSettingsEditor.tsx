import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
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
      Alert.alert("Check risk settings", "Enter complete non-negative dollar amounts, whole-number limits, and percentages from 0 to 100. Recovery requires at least two compliant profitable sessions.");
      return;
    }
    setSaving(true);
    const result = await supabase.functions.invoke("prop-pass-runtime-processor", {
      body: { op: "save_live_settings", accountId, settings: parsed },
    });
    setSaving(false);
    const report = (result.data as { kind?: unknown; report?: { failed?: unknown } } | null)?.report;
    if (result.error || (result.data as { kind?: unknown } | null)?.kind !== "success" || report?.failed !== 0) {
      Alert.alert("Settings not saved", "The server did not confirm the updated Live rules. Your prior saved rules remain active.");
      return;
    }
    Alert.alert("Live rules saved", "The account was recalculated from the saved rules and persisted Journal facts.");
    onSaved();
    void load();
  };

  if (loading) return <YdlCard><YdlText role="body" color="text.secondary">Loading saved Live rules…</YdlText></YdlCard>;
  if (loadError) return <YdlCard><YdlText role="bodyEmphasized">Saved rules could not be verified</YdlText><YdlText role="body" color="text.secondary">No editable values are shown until the authenticated row passes validation.</YdlText><YdlButton label="Retry" variant="secondary" onPress={() => void load()} /></YdlCard>;

  return (
    <View style={styles.stack} testID="prop-pass-live-settings-editor">
      <YdlCard>
        <YdlText role="bodyEmphasized">Live risk source of truth</YdlText>
        <YdlText role="caption" color="text.secondary">Verify these rules against your current broker, risk policy, and account agreement. Saving recalculates the account; it never edits Journal history.</YdlText>
      </YdlCard>
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        {(["calm", "balanced", "gambler"] as const).map((item) => <YdlButton key={item} label={capitalized(item)} size="small" variant={mode === item ? "primary" : "secondary"} onPress={() => setMode(item)} />)}
      </View>
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        <YdlButton label="Week starts Monday" size="small" variant={weekStartsOn === 1 ? "primary" : "secondary"} onPress={() => setWeekStartsOn(1)} />
        <YdlButton label="Week starts Sunday" size="small" variant={weekStartsOn === 0 ? "primary" : "secondary"} onPress={() => setWeekStartsOn(0)} />
      </View>
      <View style={styles.grid}>
        <LiveSettingsField label="Daily risk budget" suffix="$" value={draft.dailyRiskBudget} onChange={(value) => update("dailyRiskBudget", value)} />
        <LiveSettingsField label="Weekly loss limit" suffix="$" value={draft.weeklyLossLimit} onChange={(value) => update("weeklyLossLimit", value)} />
        <LiveSettingsField label="Maximum drawdown" suffix="$" value={draft.maximumDrawdown} onChange={(value) => update("maximumDrawdown", value)} />
        <LiveSettingsField label="Per-trade risk cap" suffix="$" value={draft.perTradeRiskCap} onChange={(value) => update("perTradeRiskCap", value)} />
        <LiveSettingsField label="Maximum trades" value={draft.maximumTrades} integer onChange={(value) => update("maximumTrades", value)} />
        <LiveSettingsField label="Consecutive-loss stop" value={draft.consecutiveLossLimit} integer onChange={(value) => update("consecutiveLossLimit", value)} />
        <LiveSettingsField label="Recovery activation" suffix="%" value={draft.recoveryThresholdPercent} onChange={(value) => update("recoveryThresholdPercent", value)} />
        <LiveSettingsField label="Normal risk / trade" suffix="$" value={draft.normalRiskPerTrade} onChange={(value) => update("normalRiskPerTrade", value)} />
        <LiveSettingsField label="Normal max contracts" value={draft.normalMaximumContracts} integer onChange={(value) => update("normalMaximumContracts", value)} />
        <LiveSettingsField label="Recovery risk" suffix="% of normal" value={draft.recoveryRiskPercent} onChange={(value) => update("recoveryRiskPercent", value)} />
        <LiveSettingsField label="Compliant sessions to exit" value={draft.minimumCompliantSessions} integer onChange={(value) => update("minimumCompliantSessions", value)} />
      </View>
      <YdlButton label="Save and recalculate Live account" fullWidth loading={saving} disabled={!canSave} onPress={() => void save()} testID="prop-pass-save-live-settings" />
    </View>
  );

}

export function PropPassSessionLockControl({ accountId, active, onActivated }: { accountId: string; active: boolean; onActivated: () => void }) {
  const [activating, setActivating] = useState(false);
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState<2 | 24>(2);
  const activate = () => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      Alert.alert("Reason required", "Record why this session is being locked before confirming.");
      return;
    }
    Alert.alert(
      "Lock this trading session?",
      `Reason: ${normalizedReason}\n\nThis sets recommended risk and contracts to zero until the selected review time. It cannot be bypassed by Calm, Balanced, Gambler, or Continue Anyway.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Lock Session",
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
              Alert.alert("Session not locked", "The server did not confirm the lock. Existing hard limits remain active.");
              return;
            }
            Alert.alert("Session locked", "Stop Trading is active. Journal access remains available.");
            onActivated();
          },
        },
      ],
    );
  };
  if (active) return <YdlButton label="Stop Trading active" variant="destructive" fullWidth disabled onPress={activate} testID="prop-pass-activate-session-lock" />;
  return (
    <View style={styles.stack}>
      <LiveSettingsField label="Session Lock reason" value={reason} onChange={setReason} />
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        <YdlButton label="Review in 2 hours" size="small" variant={durationHours === 2 ? "primary" : "secondary"} onPress={() => setDurationHours(2)} />
        <YdlButton label="Review in 24 hours" size="small" variant={durationHours === 24 ? "primary" : "secondary"} onPress={() => setDurationHours(24)} />
      </View>
      <YdlButton label="Lock this session" variant="destructive" fullWidth disabled={!reason.trim()} loading={activating} onPress={activate} testID="prop-pass-activate-session-lock" />
    </View>
  );
}

function LiveSettingsField({ label, suffix, value, integer = false, onChange }: { label: string; suffix?: string; value: string; integer?: boolean; onChange: (value: string) => void }) {
  const theme = useYdlTheme("dark");
  return <View style={styles.field}><YdlText role="caption" color="text.secondary">{label}{suffix ? ` (${suffix})` : ""}</YdlText><TextInput value={value} onChangeText={onChange} keyboardType={integer ? "number-pad" : "decimal-pad"} accessibilityLabel={label} placeholder="Required" placeholderTextColor={theme.colors.text.secondary} style={[styles.input, { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.interactive, borderColor: theme.colors.border.subtle }]} /></View>;
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
function capitalized(value: string): string { return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`; }

const styles = StyleSheet.create({ stack: { gap: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, field: { width: "48%", gap: 5 }, input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontVariant: ["tabular-nums"] }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
