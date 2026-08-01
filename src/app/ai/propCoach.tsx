import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ShieldCheck, Target, Zap } from "lucide-react-native";
import type { PassProbabilityResult } from "../../ai/passProbabilityEngine";
import type { RevengeTradingResult } from "../../ai/revengeTradingDetector";
import type { AiOperatingSystem } from "../../ai/aiInsightEngine";
import type { RiskTemplate } from "../../propFirm";
import { computePropRiskSnapshot } from "../../propFirm";
import { WarningCard } from "../ui/WarningCard";
import { C } from "../theme";
import { styles } from "../styles";
import type { FirmMode, Trade } from "../types";
import { moneyCompact } from "../utils/format";
import { calcStats } from "../utils/stats";
import { lightHaptic } from "../../components/ui/haptics";
import { AiAnimatedBar, AiFlowRail, AiGuardianRing, AiIntelligencePulse } from "./animations";
import { MetricPillRow, TerminalGlassCard } from "./sharedUi";

export type AiOsPropTool = "limits" | "whatif" | "emergency" | "green" | "recovery";

export type PropAggression = "safe" | "balanced" | "aggressive";

export const PROP_COACH_FIRMS = ["Topstep", "Apex", "Take Profit Trader", "Lucid", "Other"] as const;
export const PROP_COACH_ACCOUNT_SIZES = [25000, 50000, 100000, 150000, 250000];
export const PROP_RULE_REVIEW_DAYS = 14;

export function propRuleNeedsReview(template: RiskTemplate | null) {
  if (!template?.lastVerified) return true;
  const verified = new Date(template.lastVerified).getTime();
  if (!Number.isFinite(verified)) return true;
  return Date.now() - verified > PROP_RULE_REVIEW_DAYS * 24 * 60 * 60 * 1000;
}

export function propFirmMatches(template: RiskTemplate, firm: string) {
  if (firm === "Other") return true;
  const haystack = `${template.firm} ${template.company} ${template.label}`.toLowerCase();
  return haystack.includes(firm.toLowerCase().replace(/\s+/g, "")) || haystack.includes(firm.toLowerCase());
}

export function propAggressionLabel(aggression: PropAggression) {
  if (aggression === "safe") return "Micros, lower daily stop, highest selectivity.";
  if (aggression === "aggressive") return "Faster path, higher violation risk, strict stop required.";
  return "Moderate size, controlled RR, avoid overtrading.";
}

export function truncateCoachLine(value: string, max = 88) {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function PropCoachQuickCard({
  snapshot,
  templates,
  templateKey,
  propMode,
  operatingSystem,
  passProbability,
  stats,
  trades,
  revengeTrading,
  onTemplateChange,
  onModeChange,
}: {
  snapshot: ReturnType<typeof computePropRiskSnapshot> | null;
  templates: RiskTemplate[];
  templateKey: string;
  propMode: FirmMode;
  operatingSystem: AiOperatingSystem;
  passProbability: PassProbabilityResult;
  stats: ReturnType<typeof calcStats>;
  trades: Trade[];
  revengeTrading: RevengeTradingResult;
  onTemplateChange: (key: string) => void;
  onModeChange: (mode: FirmMode) => void;
}) {
  const [activeTool, setActiveTool] = useState<AiOsPropTool>("limits");
  const [plannedContracts, setPlannedContracts] = useState("1");
  const [expectedStop, setExpectedStop] = useState("");
  const [expectedTarget, setExpectedTarget] = useState("");
  const [hypotheticalLoss, setHypotheticalLoss] = useState("");
  const [dailyTarget, setDailyTarget] = useState("");
  const [selectedFirm, setSelectedFirm] = useState<(typeof PROP_COACH_FIRMS)[number]>("Other");
  const [selectedAccountSizeInput, setSelectedAccountSizeInput] = useState(PROP_COACH_ACCOUNT_SIZES[0]);
  const [aggression, setAggression] = useState<PropAggression>("balanced");
  const notConfigured = !snapshot;
  const contracts = Math.max(0, Math.round(Number(plannedContracts) || 0));
  const nextLoss = Math.max(0, Math.abs(Number(hypotheticalLoss) || Math.abs(stats.avgLoss || 0)));
  const stopDollars = Math.max(0, Math.abs(Number(expectedStop) || nextLoss));
  const targetDollars = Math.max(0, Math.abs(Number(expectedTarget) || Number(dailyTarget) || 0));
  const plannedLoss = Math.max(nextLoss, contracts * stopDollars);
  const projectedDaily = snapshot ? Math.max(0, snapshot.dailyRemaining - plannedLoss) : 0;
  const projectedAccount = snapshot ? Math.max(0, snapshot.accountRemaining - plannedLoss) : 0;
  const revengeRiskScore = revengeTrading.severity === "HIGH" ? 85 : revengeTrading.severity === "MEDIUM" ? 60 : 20;
  const riskStatus: "safe" | "caution" | "danger" =
    !snapshot || projectedDaily <= 0 || projectedAccount <= 0 || revengeRiskScore >= 85
      ? "danger"
      : projectedDaily / Math.max(1, snapshot.template.dailyLossLimit) < 0.35 || revengeRiskScore >= 60
        ? "caution"
        : "safe";
  const baseSafeLoss = snapshot ? Math.floor(Math.max(0, Math.min(snapshot.dailyRemaining, snapshot.accountRemaining) * 0.35)) : 0;
  const maxSafeLoss =
    aggression === "safe"
      ? Math.floor(baseSafeLoss * 0.65)
      : aggression === "aggressive"
        ? Math.floor(baseSafeLoss * 1.2)
        : baseSafeLoss;
  const baseContracts = snapshot?.engine?.contractRecommendation.recommended ?? (riskStatus === "safe" ? Math.max(1, contracts) : 0);
  const maxContracts = propMode === "funded" ? snapshot?.template.liveContracts : snapshot?.template.evaluationContracts;
  const suggestedContracts =
    aggression === "safe"
      ? Math.max(0, Math.min(maxContracts || baseContracts, Math.floor(baseContracts / 2) || 1))
      : aggression === "aggressive"
        ? Math.max(0, Math.min(maxContracts || baseContracts + 1, baseContracts + 1))
        : Math.max(0, Math.min(maxContracts || baseContracts, baseContracts));
  const activeRuleTemplate = snapshot?.template || templates.find((template) => template.key === templateKey) || null;
  const rulesNeedReview = propRuleNeedsReview(activeRuleTemplate);
  const dailyBufferRatio = snapshot ? snapshot.dailyRemaining / Math.max(1, snapshot.template.dailyLossLimit) : 0;
  const accountBufferRatio = snapshot ? snapshot.accountRemaining / Math.max(1, snapshot.template.maxLossLimit) : 0;
  const selectedAccountSize = activeRuleTemplate?.accountSize || selectedAccountSizeInput;
  const chooseTemplate = (firm: string, accountSize: number) => {
    setSelectedAccountSizeInput(accountSize);
    const match = templates.find((template) => template.accountSize === accountSize && propFirmMatches(template, firm));
    onTemplateChange(match?.key || "");
  };
  const toolButtons: { key: AiOsPropTool; label: string }[] = [
    { key: "limits", label: "Generate limits" },
    { key: "whatif", label: "Run what-if" },
    { key: "emergency", label: "Emergency mode" },
    { key: "green", label: "Green day lock" },
    { key: "recovery", label: "Recovery plan" },
  ];

  const statusTone =
    notConfigured || riskStatus === "danger" || snapshot?.status === "STOP"
      ? C.red
      : riskStatus === "caution" || snapshot?.status === "CAUTION"
        ? C.purple
        : C.green;
  const statusTitle = notConfigured ? "SETUP" : snapshot.status;
  const statusSub = notConfigured
    ? "Choose a synced prop template."
    : riskStatus === "danger"
      ? "Current calculated risk requires account protection."
      : riskStatus === "caution"
        ? "Current buffers call for reduced risk."
        : "Next trade limits based on journal + prop rules.";
  const actionLabel =
    activeTool === "limits"
      ? "Today's limits"
      : activeTool === "whatif"
        ? "What-if result"
        : activeTool === "emergency"
          ? "Emergency rules"
          : activeTool === "green"
            ? "Green day protection"
            : "Recovery steps";
  const actionBody = notConfigured
    ? "No matching prop template is selected. Prop Coach will not invent firm rules. Select an available synced template or review rules first."
    : activeTool === "emergency"
      ? riskStatus === "danger"
        ? "Stop trading. One rule break ends the session."
        : "Keep a hard stop ready before the next trade."
      : activeTool === "green"
        ? "If green, lock progress: reduce size and stop after one break."
        : activeTool === "recovery"
          ? `Cap size at ${Math.max(0, suggestedContracts)} contracts and rebuild with clean entries.`
          : activeTool === "whatif"
            ? `Projected buffers: ${moneyCompact(projectedDaily)} daily · ${moneyCompact(projectedAccount)} account · ${riskStatus.toUpperCase()}`
            : `Safe loss ${moneyCompact(maxSafeLoss)} · ${suggestedContracts} contracts · ${moneyCompact(snapshot.dailyRemaining)} buffer`;

  const supportingControls = (
    <View style={styles.propMissionControls} accessibilityRole="summary" accessibilityLabel="Prop supporting controls">
      <Text style={styles.propMissionSectionLabel} maxFontSizeMultiplier={1.2}>Supporting controls</Text>
      <View style={styles.propModeRail}>
        {(["evaluation", "funded"] as FirmMode[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => onModeChange(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: propMode === item }}
            accessibilityLabel={item === "evaluation" ? "Evaluation mode" : "Live mode"}
            style={[styles.propModeChip, propMode === item && styles.propModeChipActive]}
          >
            <Text style={[styles.propModeChipText, propMode === item && styles.propModeChipTextActive]}>{item === "evaluation" ? "EVAL" : "LIVE"}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propTemplateRailCompact}>
        {PROP_COACH_FIRMS.map((firm) => {
          const active = selectedFirm === firm;
          return (
            <Pressable
              key={firm}
              onPress={() => {
                setSelectedFirm(firm);
                chooseTemplate(firm, selectedAccountSize);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Firm ${firm}`}
              style={[styles.propTemplateChipCompact, active && styles.propTemplateChipActive]}
            >
              <Text style={[styles.propTemplateChipText, active && styles.propTemplateChipTextActive]}>{firm}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propTemplateRailCompact}>
        {PROP_COACH_ACCOUNT_SIZES.map((size) => {
          const active = selectedAccountSize === size;
          return (
            <Pressable
              key={size}
              onPress={() => chooseTemplate(selectedFirm, size)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Account size ${size / 1000}K`}
              style={[styles.propTemplateChipCompact, active && styles.propTemplateChipActive]}
            >
              <Text style={[styles.propTemplateChipText, active && styles.propTemplateChipTextActive]}>${size / 1000}K</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.propAggressionRail}>
        {(["safe", "balanced", "aggressive"] as PropAggression[]).map((item) => {
          const active = aggression === item;
          const tone = item === "safe" ? C.green : item === "balanced" ? C.purple : C.red;
          return (
            <Pressable
              key={item}
              onPress={() => setAggression(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item} aggression. ${propAggressionLabel(item)}`}
              style={({ pressed }) => [
                styles.propAggressionChip,
                active && { borderColor: tone, backgroundColor: `${tone}14` },
                pressed && styles.analyticsToolTilePressed,
              ]}
            >
              {item === "safe" ? <ShieldCheck size={14} color={tone} strokeWidth={2.4} /> : item === "balanced" ? <Target size={14} color={tone} strokeWidth={2.4} /> : <Zap size={14} color={tone} strokeWidth={2.4} />}
              <Text style={[styles.propAggressionChipText, { color: active ? tone : C.muted }]}>{item.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.coachCompactSub} numberOfLines={2} maxFontSizeMultiplier={1.2}>
        {propAggressionLabel(aggression)}
      </Text>
    </View>
  );

  return (
    <TerminalGlassCard style={styles.propCoachQuickCard}>
      <View style={styles.propMissionHeader}>
        <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>Prop Coach</Text>
        <AiIntelligencePulse tone={C.muted} />
      </View>

      {/* 1. Status — single hero */}
      <View
        style={[styles.propMissionHero, { borderColor: statusTone }]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Status ${statusTitle}. ${statusSub}`}
      >
        <Text style={styles.propMissionSectionLabel} maxFontSizeMultiplier={1.2}>Status</Text>
        <Text style={[styles.propMissionStatus, { color: statusTone }]} maxFontSizeMultiplier={1.35}>
          {statusTitle}
        </Text>
        <Text style={styles.coachCompactSub} maxFontSizeMultiplier={1.25}>{statusSub}</Text>
        <View style={[styles.tradeMetaChip, notConfigured || rulesNeedReview ? styles.propPreviewBadge : null]}>
          <Text style={styles.terminalSmallLabel}>
            {notConfigured ? "SETUP" : rulesNeedReview ? "REVIEW RULES" : "RULES CURRENT"}
          </Text>
        </View>
      </View>

      {rulesNeedReview ? (
        <WarningCard
          title="Rules may need review"
          body="Prop firm rules must stay current. This template is missing a recent verification date or is older than 14 days."
        />
      ) : null}

      {notConfigured ? (
        <View style={styles.propMissionStack}>
          <View style={styles.propMissionAction}>
            <Text style={styles.propMissionSectionLabel} maxFontSizeMultiplier={1.2}>Primary action</Text>
            <Text style={styles.coachCompactValue} maxFontSizeMultiplier={1.3}>{actionBody}</Text>
            {templates.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propTemplateRailCompact}>
                {templates.map((template) => {
                  const active = template.key === templateKey;
                  return (
                    <Pressable
                      key={template.key}
                      onPress={() => onTemplateChange(template.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Template ${template.accountSize / 1000}K`}
                      style={[styles.propTemplateChipCompact, active && styles.propTemplateChipActive]}
                    >
                      <Text style={[styles.propTemplateChipText, active && styles.propTemplateChipTextActive]}>{template.accountSize / 1000}K</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <Pressable
              onPress={() => templates[0] && onTemplateChange(templates[0].key)}
              style={styles.coachPrimaryCta}
              accessibilityRole="button"
              accessibilityLabel="Connect Prop Template"
            >
              <Text style={styles.coachPrimaryCtaText}>Connect Prop Template</Text>
            </Pressable>
          </View>
          {supportingControls}
        </View>
      ) : (
        <View style={styles.propMissionStack}>
          {/* 2. Today's limits */}
          <View
            style={styles.propMissionLimits}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`Today's limits. Safe loss ${moneyCompact(maxSafeLoss)}. Contracts ${suggestedContracts}. Daily buffer ${moneyCompact(snapshot.dailyRemaining)}.`}
          >
            <Text style={styles.propMissionSectionLabel} maxFontSizeMultiplier={1.2}>Today's limits</Text>
            <View style={styles.propMissionLimitRow}>
              <View style={styles.propMissionLimitCell}>
                <Text style={styles.terminalSmallLabel}>SAFE LOSS</Text>
                <Text style={styles.propMissionLimitValue} maxFontSizeMultiplier={1.3}>{moneyCompact(maxSafeLoss)}</Text>
              </View>
              <View style={styles.propMissionLimitCell}>
                <Text style={styles.terminalSmallLabel}>CONTRACTS</Text>
                <Text style={styles.propMissionLimitValue} maxFontSizeMultiplier={1.3}>{suggestedContracts}</Text>
              </View>
              <View style={styles.propMissionLimitCell}>
                <Text style={styles.terminalSmallLabel}>DAILY BUFFER</Text>
                <Text style={styles.propMissionLimitValue} maxFontSizeMultiplier={1.3}>{moneyCompact(snapshot.dailyRemaining)}</Text>
              </View>
            </View>
          </View>

          {/* 3. Primary action */}
          <View
            style={styles.propMissionAction}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${actionLabel}. ${actionBody}`}
          >
            <Text style={styles.propMissionSectionLabel} maxFontSizeMultiplier={1.2}>Primary action</Text>
            <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>{actionLabel}</Text>
            <Text style={[styles.coachCompactValue, { color: statusTone }]} maxFontSizeMultiplier={1.3}>
              {actionBody}
            </Text>
            {activeTool === "whatif" ? (
              <Text style={styles.coachCompactSub} maxFontSizeMultiplier={1.25}>
                Suggested action: {riskStatus === "danger" ? "Do not take this plan." : riskStatus === "caution" ? "Reduce contracts or stop size before entry." : "Plan is inside current buffers."}
              </Text>
            ) : null}
          </View>

          {/* 4. Supporting controls */}
          <View style={styles.coachConsoleActionRow}>
            {toolButtons.map((tool) => {
              const active = activeTool === tool.key;
              return (
                <Pressable
                  key={tool.key}
                  onPress={() => {
                    lightHaptic();
                    setActiveTool(tool.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tool.label}
                  style={[styles.coachConsoleActionChip, active && styles.coachConsoleActionChipActive]}
                >
                  <Text style={[styles.coachConsoleActionText, active && styles.coachConsoleActionTextActive]}>{tool.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {activeTool === "whatif" ? (
            <View style={styles.propSimulatorBox}>
              <View style={styles.propSimulatorInputRow}>
                <View style={styles.propSimulatorInputWrap}>
                  <Text style={styles.terminalSmallLabel}>Contracts</Text>
                  <TextInput value={plannedContracts} onChangeText={setPlannedContracts} keyboardType="number-pad" placeholder="1" placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                </View>
                <View style={styles.propSimulatorInputWrap}>
                  <Text style={styles.terminalSmallLabel}>Expected Stop $</Text>
                  <TextInput value={expectedStop} onChangeText={setExpectedStop} keyboardType="decimal-pad" placeholder={moneyCompact(Math.abs(stats.avgLoss || 0))} placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                </View>
              </View>
              <View style={styles.propSimulatorInputRow}>
                <View style={styles.propSimulatorInputWrap}>
                  <Text style={styles.terminalSmallLabel}>Expected Target $</Text>
                  <TextInput value={expectedTarget} onChangeText={setExpectedTarget} keyboardType="decimal-pad" placeholder="Target" placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                </View>
                <View style={styles.propSimulatorInputWrap}>
                  <Text style={styles.terminalSmallLabel}>Hypothetical Loss</Text>
                  <TextInput value={hypotheticalLoss} onChangeText={setHypotheticalLoss} keyboardType="decimal-pad" placeholder={moneyCompact(Math.abs(stats.avgLoss || 0))} placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
                </View>
              </View>
              <View style={styles.propSimulatorInputWrap}>
                <Text style={styles.terminalSmallLabel}>Daily Target</Text>
                <TextInput value={dailyTarget} onChangeText={setDailyTarget} keyboardType="decimal-pad" placeholder="Optional" placeholderTextColor={C.sub} style={styles.propSimulatorInput} />
              </View>
            </View>
          ) : null}
          {supportingControls}

          {/* 5. Advanced information */}
          <View style={styles.propMissionAdvanced}>
            <Text style={styles.propMissionSectionLabel} maxFontSizeMultiplier={1.2}>Advanced</Text>
            <View style={styles.propGuardianBody}>
              <AiGuardianRing
                ratio={dailyBufferRatio}
                tone={riskStatus === "danger" ? C.red : riskStatus === "caution" ? C.purple : C.green}
                label="BUFFER"
              />
              <View style={styles.propGuardianMetrics}>
                <View style={styles.propGuardianBarGroup}>
                  <View style={styles.propGuardianBarLabel}>
                    <Text style={styles.terminalSmallLabel}>DAILY</Text>
                    <Text style={styles.coachCompactSub}>{moneyCompact(snapshot.dailyRemaining)}</Text>
                  </View>
                  <AiAnimatedBar ratio={dailyBufferRatio} tone={dailyBufferRatio < 0.35 ? C.red : C.green} />
                  <View style={styles.propGuardianBarLabel}>
                    <Text style={styles.terminalSmallLabel}>ACCOUNT</Text>
                    <Text style={styles.coachCompactSub}>{moneyCompact(snapshot.accountRemaining)}</Text>
                  </View>
                  <AiAnimatedBar ratio={accountBufferRatio} tone={accountBufferRatio < 0.35 ? C.red : C.purple} />
                </View>
              </View>
            </View>
            <MetricPillRow
              items={[
                { label: "Mode", value: propMode === "funded" ? "LIVE" : "EVAL", tone: "purple" },
                { label: "Status", value: snapshot.status, tone: snapshot.status === "STOP" ? "red" : snapshot.status === "CAUTION" ? "purple" : "green" },
                { label: "Daily Buffer", value: moneyCompact(snapshot.dailyRemaining), tone: snapshot.dailyRemaining > 0 ? "green" : "red" },
                { label: "Max Safe Loss", value: moneyCompact(maxSafeLoss), tone: maxSafeLoss > 0 ? "purple" : "red" },
                { label: "Contracts", value: `${suggestedContracts}`, tone: suggestedContracts > 0 ? "green" : "grey" },
                { label: "Target RR", value: targetDollars > 0 && stopDollars > 0 ? `${(targetDollars / Math.max(1, stopDollars)).toFixed(1)}R` : "1.5R+", tone: "grey" },
              ]}
            />
            <View style={styles.propCoachSignalRail}>
              <AiFlowRail nodes={["Plan", "Risk", "Protect"]} tone={riskStatus === "danger" ? C.red : C.green} />
            </View>
          </View>
        </View>
      )}
    </TerminalGlassCard>
  );
}
