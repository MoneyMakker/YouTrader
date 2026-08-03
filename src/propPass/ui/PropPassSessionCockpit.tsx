import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlChip } from "../../ydl/components/YdlChip";
import { YdlSkeletonCard } from "../../ydl/components/YdlSkeleton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlReduceMotion } from "../../ydl/accessibility";
import { runYdlHaptic } from "../../ydl/haptics";
import { YdlAnimatedNumber, YdlFade } from "../../ydl/motion";
import { useYdlTheme } from "../../ydl/tokens";
import type { PersistedRuntimeState } from "../persistence/index";
import { compareRiskModes, buildDailyRiskCalendar, calendarFactFromPipelineOutput, type PropPassCalculationPipelineOutput } from "../tradingOs/index";
import type { PropPassViewModel } from "../types";
import { PropPassLiveSettingsEditor, PropPassSessionLockControl } from "./PropPassLiveSettingsEditor";

type PanelId = "next_trade" | "plan" | "calculator" | "what_if" | "risk_modes" | "rules" | "readiness" | "timeline" | "replay" | "live_health" | "survival" | "calendar" | "breach" | "session_lock";
type Props = { model: PropPassViewModel; runtime: PersistedRuntimeState | null; runtimeLoading: boolean; runtimeError: "repository_unavailable" | "invalid_state" | null; onRefresh: () => void; onAssignTrades: () => void; onOpenTrade?: (tradeId: string) => void };

export function PropPassSessionCockpit({ model, runtime, runtimeLoading, runtimeError, onRefresh, onAssignTrades, onOpenTrade }: Props) {
  const theme = useYdlTheme("dark");
  const reduceMotion = useYdlReduceMotion();
  const [panel, setPanel] = useState<PanelId | null>(null);
  const output = runtime?.payload ?? null;
  const context = output?.dailyPlan.values?.context ?? (model.challenge.phase === "funded" ? "live" : "challenge");
  const currency = model.progress.currentBalance?.currency ?? model.account.accountSize?.currency ?? "USD";
  const equityMinor = model.progress.currentBalance?.minor ?? model.account.accountSize?.minor ?? null;
  const risk = output?.riskMeter.values;
  const status = risk?.status ?? (output?.status === "stop_trading" ? "stop_trading" : null);
  const warning = output?.interventions[0] ?? null;
  const plan = output?.dailyPlan.values ?? null;
  const priorHapticRevision = useRef<number | null>(null);

  useEffect(() => {
    if (!runtime || priorHapticRevision.current === runtime.stateRevision) return;
    priorHapticRevision.current = runtime.stateRevision;
    if (runtime.payload.riskMeter.values.enteredDanger) runYdlHaptic("warning");
    if (runtime.payload.status === "stop_trading") runYdlHaptic("error");
  }, [runtime]);

  if (runtimeLoading && !runtime) return <View style={styles.stack} testID="prop-pass-cockpit-loading"><YdlSkeletonCard animated /><YdlSkeletonCard animated /></View>;

  return (
    <View style={styles.stack} testID="prop-pass-session-cockpit">
      <YdlCard variant="elevated" style={styles.hero} testID="prop-pass-cockpit-hero">
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <YdlText role="label" color="text.secondary">{context === "live" ? "LIVE CAPITAL" : "CHALLENGE"}</YdlText>
            <YdlText role="title" numberOfLines={1}>{model.account.displayName}</YdlText>
          </View>
          <StatusChip status={status} fallback={model.account.lifecycleStatus} />
        </View>
        <YdlText role="caption" color="text.secondary">Current equity</YdlText>
        {equityMinor == null ? <Unavailable label="Add current equity to calculate account state." /> : <YdlAnimatedNumber value={equityMinor / 100} kind="currency" currency={currency} style={[styles.display, { color: theme.colors.text.primary }]} />}
        <RiskProgress usedRatio={risk?.usedRatio ?? null} status={status} reduceMotion={reduceMotion} />
        <View style={styles.metricGrid}>
          <Metric label="Daily risk used" value={money(risk?.usedMinor ?? null, currency)} />
          <Metric label="Daily risk remaining" value={money(risk?.remainingMinor ?? output?.hardRiskRooms?.dailyLossRemainingMinor ?? null, currency)} />
          <Metric label={context === "live" ? "Weekly loss room" : "Target remaining"} value={money(context === "live" ? output?.hardRiskRooms?.weeklyLossRemainingMinor ?? null : output?.challengeLifecycle?.values.profitRemainingMinor ?? model.progress.profitRemaining?.minor ?? null, currency)} />
          <Metric label="Drawdown room" value={money(output?.hardRiskRooms?.drawdownRemainingMinor ?? model.buffers.trailingDrawdown?.remainingMinor ?? null, currency)} />
          <Metric label="Trades used / allowed" value={plan ? `${output?.journalApplication.appliedTradeIds.length ?? 0} / ${plan.maximumTrades}` : "Needs plan"} />
          <Metric label="Risk mode" value={plan?.mode ? title(plan.mode) : "Needs plan"} />
        </View>
        <View style={[styles.warning, { backgroundColor: warning?.blocking ? theme.colors.status.negativeSoft : theme.colors.status.warningSoft }]} accessibilityLiveRegion="polite">
          <YdlText role="label">{warning?.title ?? (output?.missingInputs.length ? "Setup required" : "Next safe action")}</YdlText>
          <YdlText role="body" color="text.secondary">{warning?.recommendedAction ?? (output?.missingInputs[0] ? setupAction(output.missingInputs[0]) : "Keep the next trade inside the frozen plan.")}</YdlText>
        </View>
        <YdlButton label="Check Next Trade" fullWidth leadingSymbol="trade" disabled={!output} onPress={() => setPanel("next_trade")} haptic="selection" testID="prop-pass-check-next-trade" />
      </YdlCard>

      {runtimeError ? <YdlCard><YdlText role="bodyEmphasized">Saved risk state needs a refresh</YdlText><YdlText role="body" color="text.secondary">{runtimeError === "invalid_state" ? "The stored calculation failed validation; no recommendation is shown." : "The last validated account snapshot remains visible. Retry to load the Build 117 risk state."}</YdlText><YdlButton label="Retry" variant="secondary" onPress={onRefresh} /></YdlCard> : null}
      {!runtime && !runtimeLoading ? <YdlCard testID="prop-pass-runtime-empty"><YdlText role="bodyEmphasized">Finish account risk setup</YdlText><YdlText role="body" color="text.secondary">No Build 117 calculation is available yet. Existing Journal data is unchanged, and no risk recommendation is invented.</YdlText><YdlButton label="Assign Journal Trades" onPress={onAssignTrades} /></YdlCard> : null}

      {output ? <CompactRiskStrip output={output} currency={currency} /> : null}
      <YdlText role="label" color="text.secondary">DECISIONS</YdlText>
      <View style={styles.actions}>
        <Action label="Today’s Plan" detail={plan ? `${money(plan.riskPerTradeMinor, currency)} / trade` : "Needs input"} onPress={() => setPanel("plan")} />
        <Action label="Contract Calculator" detail={output?.contractSize?.values.recommendedContracts == null ? "Needs instrument" : `${output.contractSize.values.recommendedContracts} contracts`} onPress={() => setPanel("calculator")} />
        <Action label="What-If Simulator" detail={output?.whatIf ? title(output.whatIf.status) : "No saved scenario"} onPress={() => setPanel("what_if")} />
        <Action label="Risk Modes" detail={plan?.mode ? title(plan.mode) : "Compare"} onPress={() => setPanel("risk_modes")} />
        <Action label={context === "live" ? "Safe Withdrawal" : "Payout Planner"} detail="Safety floor enforced" onPress={() => setPanel("readiness")} />
        <Action label="Risk Rules" detail={runtime?.versions.ruleVersion ?? "Needs version"} onPress={() => setPanel("rules")} />
        <Action label="Timeline" detail={`${output?.timeline.length ?? 0} real events`} onPress={() => setPanel("timeline")} />
        <Action label="Decision Replay" detail={title(output?.decisionReplay.verdict ?? "insufficient_data")} onPress={() => setPanel("replay")} />
        <Action label={context === "live" ? "Capital Preservation" : "Account Command"} detail={context === "live" ? scoreLabel(output?.liveLifecycle?.values.preservation?.score ?? null) : "Selected account isolated"} onPress={() => setPanel("live_health")} />
        <Action label="Survival Capacity" detail="Static scenario" onPress={() => setPanel("survival")} />
        <Action label="Daily Risk Calendar" detail="Persisted days only" onPress={() => setPanel("calendar")} />
        <Action label="Breach Replay" detail={output?.breachReplay?.values ? "Recorded breach" : "No breach data"} onPress={() => setPanel("breach")} />
        <Action label="Session Lock" detail={output?.liveLifecycle?.values.killSwitch?.active ? "Stop Trading" : "Configured guardrail"} onPress={() => setPanel("session_lock")} />
      </View>
      <YdlFade visible={panel != null}>{panel && output ? <Panel id={panel} output={output} runtime={runtime!} currency={currency} context={context} onClose={() => setPanel(null)} onRefresh={onRefresh} onAssignTrades={onAssignTrades} onOpenTrade={onOpenTrade} /> : null}</YdlFade>
    </View>
  );
}

function Panel({ id, output, runtime, currency, context, onClose, onRefresh, onAssignTrades, onOpenTrade }: { id: PanelId; output: PropPassCalculationPipelineOutput; runtime: PersistedRuntimeState; currency: string; context: "challenge" | "live"; onClose: () => void; onRefresh: () => void; onAssignTrades: () => void; onOpenTrade?: (id: string) => void }) {
  const plan = output.dailyPlan.values;
  const trace = output.calculationTrace;
  const close = <YdlButton label="Close" variant="tertiary" onPress={onClose} />;
  if (id === "next_trade") return <Detail title="Check Next Trade" close={close}><StatusChip status={output.preTrade?.status ?? output.status} fallback="Needs input" /><Rows rows={[["Allowed risk", money(output.allowedRisk.values.allowedRiskMinor, currency)], ["Planned risk", money(output.preTrade?.values.totalPlannedRiskMinor ?? null, currency)], ["Recommended contracts", value(output.contractSize?.values.recommendedContracts)], ["Decision", title(output.preTrade?.status ?? "needs_input")]]} /><Missing values={output.preTrade?.missingInputs ?? output.missingInputs} /><CalculationTrace output={output} stages={["hard_risk_rooms", "mode_limits", "pre_trade", "contract_size"]} /></Detail>;
  if (id === "plan") return <Detail title="Today’s Immutable Plan" close={close}>{plan ? <Rows rows={[["Trading day", plan.tradingDay], ["Mode", title(plan.mode)], ["Risk per trade", money(plan.riskPerTradeMinor, currency)], ["Maximum risk", money(plan.maximumRiskTodayMinor, currency)], ["Maximum trades", String(plan.maximumTrades)], ["Stop after losses", value(plan.stopAfterLosses)], ["Instrument", plan.preferredInstrument ?? "Needs setup"], ["Session", plan.allowedSessionId ?? "Needs setup"], ["Calculation", plan.calculationVersion]]} /> : <Unavailable label="Create a Daily Plan from recorded account rules before trading." />}{close}</Detail>;
  if (id === "calculator") return <Detail title="Contract Size Calculator" close={close}><Rows rows={[["Allowed risk", money(output.allowedRisk.values.allowedRiskMinor, currency)], ["Loss / contract", money(output.contractSize?.values.totalLossPerContractMinor ?? null, currency)], ["Recommended contracts", value(output.contractSize?.values.recommendedContracts)], ["Actual planned risk", money(output.contractSize?.values.actualRiskMinor ?? null, currency)], ["Unused risk", money(output.contractSize?.values.unusedRiskMinor ?? null, currency)], ["Rounding", "Contracts always round down"]]} /><Missing values={output.contractSize?.missingInputs ?? []} /><CalculationTrace output={output} stages={["instrument", "contract_size"]} /></Detail>;
  if (id === "what_if") { const scenario = output.whatIf; return <Detail title="What-If Simulator" close={close}>{scenario ? <><Rows rows={[["Projected equity", money(scenario.values.projectedEquityMinor, currency)], ["Projected balance", money(scenario.values.projectedBalanceMinor, currency)], ["Daily room", money(scenario.values.projectedDailyRoomMinor, currency)], ["Drawdown room", money(scenario.values.projectedDrawdownRoomMinor, currency)], ["Weekly room", money(scenario.values.projectedWeeklyRoomMinor, currency)], ["Another trade permitted", scenario.values.anotherTradePermitted == null ? "Needs input" : scenario.values.anotherTradePermitted ? "Yes" : "No"]]} /><Missing values={scenario.missingInputs} /></> : <Unavailable label="Choose and save a scenario from complete account facts. Temporary scenarios are never persisted automatically." />}</Detail>; }
  if (id === "risk_modes") return <ModeComparison output={output} currency={currency} context={context} close={close} />;
  if (id === "rules") return <Detail title="Risk Rules & Versions" close={close}><Rows rows={[["Rule version", runtime.versions.ruleVersion], ["Instrument version", runtime.versions.instrumentVersion ?? "Needs verified instrument"], ["Calculation version", runtime.versions.calculationVersion], ["Daily room", money(output.hardRiskRooms?.dailyLossRemainingMinor ?? null, currency)], ["Maximum loss room", money(output.hardRiskRooms?.maximumLossRemainingMinor ?? null, currency)], ["Drawdown room", money(output.hardRiskRooms?.drawdownRemainingMinor ?? null, currency)], ["Weekly room", money(output.hardRiskRooms?.weeklyLossRemainingMinor ?? null, currency)]]} /><YdlText role="caption" color="text.secondary">Verify these rules against your current prop-firm agreement.</YdlText>{context === "live" ? <PropPassLiveSettingsEditor accountId={runtime.accountId} onSaved={onRefresh} /> : null}<CalculationTrace output={output} stages={["rules", "trading_day", "instrument", "hard_risk_rooms"]} /></Detail>;
  if (id === "readiness") { const result = context === "live" ? output.withdrawalReadiness : output.payoutReadiness; const amount = context === "live" ? output.withdrawalReadiness?.values.recommendedMaximumWithdrawalMinor : output.payoutReadiness?.values.recommendedMaximumPayoutMinor; return <Detail title={context === "live" ? "Safe Withdrawal" : "Payout Planner"} close={close}><Rows rows={[["Readiness", title(result?.status ?? "needs_input")], ["Recommended maximum", money(amount ?? null, currency)], ["Safety floor", money(context === "live" ? output.withdrawalReadiness?.values.safetyFloorMinor ?? null : output.payoutReadiness?.values.safetyFloorMinor ?? null, currency)], ["Reserve", money(context === "live" ? output.withdrawalReadiness?.values.reserveMinor ?? null : output.payoutReadiness?.values.postPayoutReserveMinor ?? null, currency)]]} /><Missing values={result?.missingInputs ?? []} />{context === "challenge" && output.payoutPlanner ? <Rows rows={output.payoutPlanner.values.scenarios.map((scenario) => [money(scenario.amountMinor, currency), scenario.permitted ? "Within safe limit" : title(scenario.blocker ?? "blocked")])} /> : null}<YdlText role="caption" color="text.secondary">Planning only. YouTrader does not execute payouts or withdrawals.</YdlText></Detail>; }
  if (id === "timeline") return <Detail title="Account Timeline" close={close}>{output.timeline.length ? output.timeline.map((event) => <YdlCard key={`${event.type}:${event.occurredAt}`}><YdlText role="bodyEmphasized">{title(event.type)}</YdlText><YdlText role="caption" color="text.secondary">{event.occurredAt}</YdlText><YdlText role="body">{event.explanation}</YdlText></YdlCard>) : <Unavailable label="No persisted account events are available." />}</Detail>;
  if (id === "replay") { const replay = output.decisionReplay; return <Detail title="Decision Replay" close={close}><StatusChip status={replay.verdict} fallback="Insufficient data" /><YdlText role="bodyEmphasized">{replay.reason}</YdlText><YdlText role="body" color="text.secondary">{replay.mathematicalConsequence}</YdlText><YdlText role="body">Next: {replay.nextAction}</YdlText>{replay.relatedTradeId && onOpenTrade ? <YdlButton label="Open Journal Trade" variant="secondary" onPress={() => onOpenTrade(replay.relatedTradeId!)} /> : null}</Detail>; }
  if (id === "live_health") { const live = output.liveLifecycle?.values; return <Detail title={context === "live" ? "Capital Preservation" : "Account Command Center"} close={close}>{context === "live" ? <><Rows rows={[["State", title(live?.state ?? "needs_input")], ["Preservation score", scoreLabel(live?.preservation?.score ?? null)], ["Recovery Mode", live?.recovery?.active == null ? "Needs input" : live.recovery.active ? "Active" : "Normal"], ["Kill Switch", live?.killSwitch?.active == null ? "Needs input" : live.killSwitch.active ? "Stop Trading" : "Clear"], ["Weekly loss room", money(live?.weeklyLossRoomMinor ?? null, currency)], ["Next improvement", live?.preservation?.primaryImprovementAction ?? "Complete risk setup"]]} /></> : <><Rows rows={[["Selected account", runtime.accountId], ["Lifecycle", title(output.challengeLifecycle?.values.state ?? "needs_input")], ["Risk state", title(output.riskMeter.values.status ?? "needs_input")], ["Next action", output.interventions[0]?.recommendedAction ?? "Keep this account inside plan"]]} /><YdlText role="caption" color="text.secondary">Limits remain isolated per account; no values are merged.</YdlText></>}</Detail>; }
  if (id === "survival") return <Detail title="Account Survival Capacity" close={close}><YdlText role="caption" color="text.secondary">Static scenario capacity, not a prediction or passage probability.</YdlText><Rows rows={output.survival.values.modes.map((mode) => [title(mode.mode), mode.maximumRiskLossesRemaining == null ? "Needs input" : `${mode.maximumRiskLossesRemaining} maximum-risk losses`])} /><Rows rows={[["Hard room", money(output.survival.values.hardRoomMinor, currency)], ["Daily capacity", value(output.survival.values.dailyCapacity)], ["Drawdown capacity", value(output.survival.values.drawdownCapacity)]]} /></Detail>;
  if (id === "calendar") {
    const fact = calendarFactFromPipelineOutput(output);
    const days = fact ? buildDailyRiskCalendar([fact]) : [];
    return (
      <Detail title="Daily Risk Calendar" close={close}>
        {days.length ? days.map((day) => (
          <YdlCard key={day.tradingDayId} testID={`prop-pass-calendar-day-${day.tradingDayId}`}>
            <View style={styles.heroTop}>
              <YdlText role="bodyEmphasized">{day.tradingDayId}</YdlText>
              <YdlChip label={title(day.semanticState)} />
            </View>
            <Rows rows={[
              ["Risk used", money(day.riskUsedMinor, currency)],
              ["Risk remaining", money(day.riskRemainingMinor, currency)],
              ["Health", title(day.health ?? "needs_input")],
              ["Trades", String(day.tradeIds.length)],
              ["Interventions", String(day.interventions.length)],
              ["Markers", day.markers.length ? day.markers.map(title).join(", ") : "None"],
            ]} />
          </YdlCard>
        )) : <Unavailable label="No persisted trading-day snapshot is available. Missing historical days are never backfilled." />}
        <YdlText role="caption" color="text.secondary">Only persisted daily snapshots are displayed. Missing historical days are never backfilled.</YdlText>
      </Detail>
    );
  }
  if (id === "breach") { const breach = output.breachReplay.values; return <Detail title="Breach Replay" close={close}>{breach ? <><YdlText role="bodyEmphasized">Account failed here</YdlText><Rows rows={[["Trade", breach.triggeringTradeId], ["Rule", breach.ruleId], ["Buffer before", money(breach.bufferBeforeMinor, currency)], ["Planned risk", money(breach.plannedRiskMinor, currency)], ["Actual risk", money(breach.actualRiskMinor, currency)], ["Breach amount", money(breach.breachAmountMinor, currency)], ["Recommended contracts", String(breach.counterfactual.contracts)], ["Projected remaining buffer", money(breach.counterfactual.projectedRemainingBufferMinor, currency)]]} /><YdlText role="caption" color="text.secondary">The counterfactual changes size only. It does not change the recorded market outcome.</YdlText></> : <Unavailable label="No complete persisted breach fact is available; no replay is invented." />}</Detail>; }
  if (id === "session_lock") {
    const kill = output.liveLifecycle?.values.killSwitch;
    const lockTrigger = kill?.exactTriggers.find((trigger) => /manual session lock/i.test(trigger)) ?? null;
    const lockReviewRows: Array<[string, string]> = [];
    if (kill?.manualSessionLockReason) lockReviewRows.push(["Lock reason", kill.manualSessionLockReason]);
    if (kill?.manualSessionLockExpiresAt) lockReviewRows.push(["Review expires", formatReviewExpiry(kill.manualSessionLockExpiresAt)]);
    return (
      <Detail title="Personal Kill Switch & Session Lock" close={close}>
        <Rows rows={[
          ["State", kill?.active ? "Stop Trading" : "Ready"],
          ["Recommended risk", money(kill?.recommendedRiskMinor ?? output.allowedRisk.values.allowedRiskMinor, currency)],
          ["Recommended contracts", String(kill?.recommendedContracts ?? output.contractSize?.values.recommendedContracts ?? 0)],
          ["Gambler", kill?.gamblerDisabled ? "Disabled" : "Hard limits active"],
          ["Manual lock", lockTrigger ? "Server-confirmed" : kill?.manualConfirmationRequired ? "Confirmation required" : "Not active"],
          ...lockReviewRows,
          ["Reset", kill?.resetInstruction ?? "Use configured session/day boundary"],
        ]} />
        {kill?.exactTriggers.map((trigger) => <YdlText key={trigger} role="body" color="text.secondary">• {trigger}</YdlText>)}
        <YdlText role="caption" color="text.secondary">Manual lock requires deliberate server-confirmed activation with a recorded reason and bounded review expiry. It cannot be unlocked from this summary or bypassed by a risk mode.</YdlText>
        <PropPassSessionLockControl accountId={runtime.accountId} active={Boolean(kill?.active)} onActivated={onRefresh} />
      </Detail>
    );
  }
  return <Detail title="Prop Pass" close={close}><YdlButton label="Assign Journal Trades" onPress={onAssignTrades} /></Detail>;
}

function ModeComparison({ output, currency, context, close }: { output: PropPassCalculationPipelineOutput; currency: string; context: "challenge" | "live"; close: React.ReactNode }) { const modes = output.hardRiskRooms ? compareRiskModes(output.hardRiskRooms, context, output.contractSize?.values.totalLossPerContractMinor ?? null) : []; return <Detail title="Calm / Balanced / Gambler" close={close}>{modes.length ? modes.map((mode) => <YdlCard key={mode.mode} variant={output.dailyPlan.values?.mode === mode.mode ? "selected" : "outlined"}><View style={styles.heroTop}><YdlText role="bodyEmphasized">{title(mode.mode)}{mode.highRisk ? " · HIGH RISK" : ""}</YdlText><YdlChip label={mode.enabled ? "Available" : "Disabled by safe room"} disabled={!mode.enabled} /></View><Rows rows={[["Risk / trade", money(mode.riskPerTradeMinor, currency)], ["Maximum daily risk", money(mode.maximumDailyRiskMinor, currency)], ["Maximum trades", String(mode.maximumTrades)], ["Stop after losses", String(mode.stopAfterLosses)], ["Recommended contracts", mode.requiresInstrumentSetup ? "Verify instrument costs" : String(mode.recommendedContracts)], ["Maximum projected damage", money(mode.maximumProjectedDamageMinor, currency)], ["Remaining buffer", money(mode.projectedRemainingBufferMinor, currency)]]} />{mode.requiresConfirmation ? <YdlButton label="Review High Risk consequence" variant="destructive" onPress={() => Alert.alert("High Risk mode", `Maximum projected damage: ${money(mode.maximumProjectedDamageMinor, currency)}. Confirmation never bypasses a hard limit.`, [{ text: "Close" }])} /> : null}</YdlCard>) : <Unavailable label="Complete hard risk rooms before comparing modes." />}</Detail>; }

function CompactRiskStrip({ output, currency }: { output: PropPassCalculationPipelineOutput; currency: string }) { const theme = useYdlTheme("dark"); const status = output.riskMeter.values.status; return <View style={[styles.riskStrip, { backgroundColor: status === "stop_trading" ? theme.colors.status.negativeSoft : status === "danger" ? theme.colors.status.warningSoft : theme.colors.surface.interactive }]} accessibilityRole="summary" testID="prop-pass-sticky-risk-meter"><YdlText role="label">{title(status ?? "needs_input")}</YdlText><YdlText role="bodyEmphasized">{money(output.riskMeter.values.remainingMinor, currency)} remaining</YdlText><YdlText role="caption" color="text.secondary">{output.liveLifecycle?.values.killSwitch?.active ? "Kill Switch active" : "Hard limits active"}</YdlText></View>; }
function RiskProgress({ usedRatio, status, reduceMotion }: { usedRatio: number | null; status: string | null; reduceMotion: boolean }) { const theme = useYdlTheme("dark"); const progress = useSharedValue(0); useEffect(() => { progress.value = withTiming(Math.max(0, Math.min(1, usedRatio ?? 0)), { duration: reduceMotion ? 0 : 350 }); }, [progress, reduceMotion, usedRatio]); const animated = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` })); const color = status === "stop_trading" ? theme.colors.status.negative : status === "danger" || status === "watch" ? theme.colors.status.warning : theme.colors.status.positive; return <View style={[styles.progressTrack, { backgroundColor: theme.colors.surface.interactive }]} accessible accessibilityLabel={usedRatio == null ? "Daily risk usage needs input" : `${Math.round(usedRatio * 100)} percent of daily risk used`}><Animated.View style={[styles.progressFill, { backgroundColor: color }, animated]} /></View>; }
function Detail({ title: heading, children, close }: { title: string; children: React.ReactNode; close: React.ReactNode }) { return <View style={styles.stack} testID="prop-pass-detail-panel" accessibilityViewIsModal><View style={styles.heroTop}><YdlText role="title">{heading}</YdlText>{close}</View>{children}</View>; }
function Action({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) { return <YdlCard variant="interactive" onPress={onPress} accessibilityLabel={`${label}. ${detail}`} style={styles.action}><YdlText role="bodyEmphasized">{label}</YdlText><YdlText role="caption" color="text.secondary">{detail}</YdlText></YdlCard>; }
function Metric({ label, value: display }: { label: string; value: string }) { return <View style={styles.metric}><YdlText role="caption" color="text.secondary">{label}</YdlText><YdlText role="bodyEmphasized">{display}</YdlText></View>; }
function Rows({ rows }: { rows: Array<[string, string]> }) { return <YdlCard>{rows.map(([label, display]) => <View key={`${label}:${display}`} style={styles.row}><YdlText role="caption" color="text.secondary" style={styles.flex}>{label}</YdlText><YdlText role="bodyEmphasized" style={styles.value}>{display}</YdlText></View>)}</YdlCard>; }
function StatusChip({ status, fallback }: { status: string | null; fallback: string }) { const normalized = status ?? fallback; return <YdlChip label={title(normalized)} leadingSymbol={/stop|violation|danger|breach|fail/i.test(normalized) ? "warning" : /safe|healthy|good|pass|active/i.test(normalized) ? "success" : "info"} />; }
function Missing({ values }: { values: string[] }) { return values.length ? <YdlCard><YdlText role="bodyEmphasized">Complete setup</YdlText>{[...new Set(values)].slice(0, 8).map((item) => <YdlText role="body" color="text.secondary" key={item}>• {setupAction(item)}</YdlText>)}</YdlCard> : null; }
function CalculationTrace({ output, stages }: { output: PropPassCalculationPipelineOutput; stages: PropPassCalculationPipelineOutput["calculationTrace"][number]["stage"][] }) { const rows = output.calculationTrace.filter((step) => stages.includes(step.stage)); return <YdlCard><YdlText role="bodyEmphasized">How this was calculated</YdlText>{rows.map((step) => <View key={step.stage} style={styles.trace}><YdlText role="label">{step.order}. {title(step.stage)}</YdlText><YdlText role="caption" color="text.secondary">{title(step.status)} · {step.sourceVersion ?? output.calculationVersion}</YdlText>{step.arithmetic.map((line) => <YdlText role="caption" color="text.secondary" key={line}>{line}</YdlText>)}{step.rounding.map((line) => <YdlText role="caption" color="text.secondary" key={line}>{line}</YdlText>)}</View>)}</YdlCard>; }
function Unavailable({ label }: { label: string }) { return <YdlText role="body" color="text.secondary">{label}</YdlText>; }
function money(minor: number | null | undefined, currency: string): string { if (minor == null || !Number.isSafeInteger(minor)) return "Needs input"; return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100); }
function value(input: number | null | undefined): string { return input == null ? "Needs input" : String(input); }
function title(value: string): string { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function scoreLabel(score: number | null): string { return score == null ? "Needs input" : `${score} / 100`; }
function formatReviewExpiry(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(parsed));
}
function setupAction(code: string): string { return `Set ${title(code).toLowerCase()} in account risk settings.`; }

const styles = StyleSheet.create({ stack: { gap: 12 }, hero: { gap: 14 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, flex: { flex: 1 }, display: { fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] }, progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" }, progressFill: { height: 8, borderRadius: 999 }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, metric: { width: "47%", gap: 3 }, warning: { borderRadius: 12, padding: 12, gap: 4 }, riskStrip: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, action: { width: "48%", minHeight: 94, justifyContent: "space-between" }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingVertical: 3 }, value: { maxWidth: "58%", textAlign: "right" }, trace: { gap: 3, paddingTop: 6 } });
