import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
import { compareRiskModes, buildDailyRiskCalendar, calendarFactFromPipelineOutput, resolveKillSwitchValues, type PropPassCalculationPipelineOutput } from "../tradingOs/index";
import type { PropPassViewModel } from "../types";
import { PropPassLiveSettingsEditor, PropPassSessionLockControl } from "./PropPassLiveSettingsEditor";

type PanelId = "next_trade" | "plan" | "calculator" | "what_if" | "risk_modes" | "rules" | "readiness" | "timeline" | "replay" | "live_health" | "survival" | "calendar" | "breach" | "session_lock";
type Props = { model: PropPassViewModel; runtime: PersistedRuntimeState | null; runtimeLoading: boolean; runtimeError: "repository_unavailable" | "invalid_state" | null; onRefresh: () => void; onAssignTrades: () => void; onOpenTrade?: (tradeId: string) => void };

export function PropPassSessionCockpit({ model, runtime, runtimeLoading, runtimeError, onRefresh, onAssignTrades, onOpenTrade }: Props) {
  const { t } = useTranslation();
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
            <YdlText role="label" color="text.secondary">{context === "live" ? t("propPass.cockpit.context.liveCapital") : t("propPass.cockpit.context.challengeLabel")}</YdlText>
            <YdlText role="title" numberOfLines={1}>{model.account.displayName}</YdlText>
          </View>
          <StatusChip status={status} fallback={model.account.lifecycleStatus} />
        </View>
        <YdlText role="caption" color="text.secondary">{t("propPass.cockpit.currentEquity")}</YdlText>
        {equityMinor == null ? <Unavailable label={t("propPass.cockpit.unavailable.equity")} /> : <YdlAnimatedNumber value={equityMinor / 100} kind="currency" currency={currency} style={[styles.display, { color: theme.colors.text.primary }]} />}
        <RiskProgress usedRatio={risk?.usedRatio ?? null} status={status} reduceMotion={reduceMotion} t={t} />
        <View style={styles.metricGrid}>
          <Metric label={t("propPass.cockpit.dailyRiskUsed")} value={money(risk?.usedMinor ?? null, currency, t)} />
          <Metric label={t("propPass.cockpit.dailyRiskRemaining")} value={money(risk?.remainingMinor ?? output?.hardRiskRooms?.dailyLossRemainingMinor ?? null, currency, t)} />
          <Metric label={context === "live" ? t("propPass.cockpit.weeklyLossRoom") : t("propPass.cockpit.targetRemaining")} value={money(context === "live" ? output?.hardRiskRooms?.weeklyLossRemainingMinor ?? null : output?.challengeLifecycle?.values.profitRemainingMinor ?? model.progress.profitRemaining?.minor ?? null, currency, t)} />
          <Metric label={t("propPass.commandCenter.drawdownRoom")} value={money(output?.hardRiskRooms?.drawdownRemainingMinor ?? model.buffers.trailingDrawdown?.remainingMinor ?? null, currency, t)} />
          <Metric label={t("propPass.cockpit.tradesUsedAllowed")} value={plan ? t("propPass.cockpit.tradesUsedAllowedValue", { used: output?.journalApplication.appliedTradeIds.length ?? 0, allowed: plan.maximumTrades }) : t("propPass.cockpit.needsPlan")} />
          <Metric label={t("propPass.cockpit.riskMode")} value={plan?.mode ? title(plan.mode) : t("propPass.cockpit.needsPlan")} />
        </View>
        <View style={[styles.warning, { backgroundColor: warning?.blocking ? theme.colors.status.negativeSoft : theme.colors.status.warningSoft }]} accessibilityLiveRegion="polite">
          <YdlText role="label">{warning?.title ?? (output?.missingInputs.length ? t("propPass.cockpit.setupRequired") : t("propPass.cockpit.nextSafeAction"))}</YdlText>
          <YdlText role="body" color="text.secondary">{warning?.recommendedAction ?? (output?.missingInputs[0] ? setupAction(output.missingInputs[0], t) : t("propPass.cockpit.keepInPlan"))}</YdlText>
        </View>
        <YdlButton label={t("propPass.cockpit.checkNextTrade")} fullWidth leadingSymbol="trade" disabled={!output} onPress={() => setPanel("next_trade")} haptic="selection" testID="prop-pass-check-next-trade" />
      </YdlCard>

      {runtimeError ? <YdlCard><YdlText role="bodyEmphasized">{t("propPass.cockpit.runtimeErrorTitle")}</YdlText><YdlText role="body" color="text.secondary">{runtimeError === "invalid_state" ? t("propPass.cockpit.runtimeInvalidBody") : t("propPass.cockpit.runtimeUnavailableBody")}</YdlText><YdlButton label={t("propPass.commandCenter.retry")} variant="secondary" onPress={onRefresh} /></YdlCard> : null}
      {!runtime && !runtimeLoading ? <YdlCard testID="prop-pass-runtime-empty"><YdlText role="bodyEmphasized">{t("propPass.cockpit.finishSetupTitle")}</YdlText><YdlText role="body" color="text.secondary">{t("propPass.cockpit.finishSetupBody")}</YdlText><YdlButton label={t("propPass.cockpit.assignJournalTrades")} onPress={onAssignTrades} /></YdlCard> : null}

      {output ? <CompactRiskStrip output={output} currency={currency} t={t} /> : null}
      <YdlText role="label" color="text.secondary">{t("propPass.cockpit.decisions")}</YdlText>
      <View style={styles.actions}>
        <Action label={t("propPass.plan.title")} detail={plan ? t("propPass.cockpit.perTradeDetail", { amount: money(plan.riskPerTradeMinor, currency, t) }) : t("propPass.cockpit.needsInput")} onPress={() => setPanel("plan")} />
        <Action label={t("propPass.cockpit.contractCalculator")} detail={output?.contractSize?.values.recommendedContracts == null ? t("propPass.cockpit.needsInstrument") : t("propPass.cockpit.contractsCount", { count: output.contractSize.values.recommendedContracts })} onPress={() => setPanel("calculator")} />
        <Action label={t("propPass.cockpit.whatIfSimulator")} detail={output?.whatIf ? title(output.whatIf.status) : t("propPass.cockpit.noSavedScenario")} onPress={() => setPanel("what_if")} />
        <Action label={t("propPass.cockpit.riskModes")} detail={plan?.mode ? title(plan.mode) : t("propPass.cockpit.compare")} onPress={() => setPanel("risk_modes")} />
        <Action label={context === "live" ? t("propPass.cockpit.safeWithdrawal") : t("propPass.cockpit.payoutPlanner")} detail={t("propPass.cockpit.safetyFloorEnforced")} onPress={() => setPanel("readiness")} />
        <Action label={t("propPass.cockpit.riskRules")} detail={runtime?.versions.ruleVersion ?? t("propPass.cockpit.needsVersion")} onPress={() => setPanel("rules")} />
        <Action label={t("propPass.cockpit.timeline")} detail={t("propPass.cockpit.realEventsCount", { count: output?.timeline.length ?? 0 })} onPress={() => setPanel("timeline")} />
        <Action label={t("propPass.cockpit.decisionReplay")} detail={title(output?.decisionReplay.verdict ?? "insufficient_data")} onPress={() => setPanel("replay")} />
        <Action label={context === "live" ? t("propPass.cockpit.capitalPreservation") : t("propPass.commandCenter.title")} detail={context === "live" ? scoreLabel(output?.liveLifecycle?.values.preservation?.score ?? null, t) : t("propPass.cockpit.selectedAccountIsolated")} onPress={() => setPanel("live_health")} />
        <Action label={t("propPass.cockpit.survivalCapacity")} detail={t("propPass.cockpit.staticScenario")} onPress={() => setPanel("survival")} />
        <Action label={t("propPass.cockpit.dailyRiskCalendar")} detail={t("propPass.cockpit.persistedDaysOnly")} onPress={() => setPanel("calendar")} />
        <Action label={t("propPass.cockpit.breachReplay")} detail={output?.breachReplay?.values ? t("propPass.cockpit.recordedBreach") : t("propPass.cockpit.noBreachData")} onPress={() => setPanel("breach")} />
        <Action label={t("propPass.cockpit.sessionLock")} detail={resolveKillSwitchValues(output)?.active ? t("propPass.commandCenter.killSwitchActive") : t("propPass.cockpit.configuredGuardrail")} onPress={() => setPanel("session_lock")} />
      </View>
      <YdlFade visible={panel != null}>{panel && output ? <Panel id={panel} output={output} runtime={runtime!} currency={currency} context={context} onClose={() => setPanel(null)} onRefresh={onRefresh} onAssignTrades={onAssignTrades} onOpenTrade={onOpenTrade} /> : null}</YdlFade>
    </View>
  );
}

function Panel({ id, output, runtime, currency, context, onClose, onRefresh, onAssignTrades, onOpenTrade }: { id: PanelId; output: PropPassCalculationPipelineOutput; runtime: PersistedRuntimeState; currency: string; context: "challenge" | "live"; onClose: () => void; onRefresh: () => void; onAssignTrades: () => void; onOpenTrade?: (id: string) => void }) {
  const { t } = useTranslation();
  const plan = output.dailyPlan.values;
  const close = <YdlButton label={t("propPass.close")} variant="tertiary" onPress={onClose} />;
  if (id === "next_trade") return <Detail title={t("propPass.cockpit.checkNextTrade")} close={close}><StatusChip status={output.preTrade?.status ?? output.status} fallback={t("propPass.cockpit.needsInput")} /><Rows rows={[[t("propPass.cockpit.row.allowedRisk"), money(output.allowedRisk.values.allowedRiskMinor, currency, t)], [t("propPass.cockpit.row.plannedRisk"), money(output.preTrade?.values.totalPlannedRiskMinor ?? null, currency, t)], [t("propPass.cockpit.row.recommendedContracts"), value(output.contractSize?.values.recommendedContracts, t)], [t("propPass.cockpit.row.decision"), title(output.preTrade?.status ?? "needs_input")]]} /><Missing values={output.preTrade?.missingInputs ?? output.missingInputs} t={t} /><CalculationTrace output={output} stages={["hard_risk_rooms", "mode_limits", "pre_trade", "contract_size"]} t={t} /></Detail>;
  if (id === "plan") return <Detail title={t("propPass.cockpit.panel.immutablePlan")} close={close}>{plan ? <Rows rows={[[t("propPass.cockpit.row.tradingDay"), plan.tradingDay], [t("propPass.commandCenter.mode"), title(plan.mode)], [t("propPass.cockpit.row.riskPerTrade"), money(plan.riskPerTradeMinor, currency, t)], [t("propPass.cockpit.row.maximumRisk"), money(plan.maximumRiskTodayMinor, currency, t)], [t("propPass.liveSettings.maximumTrades"), String(plan.maximumTrades)], [t("propPass.riskMode.stopAfterLosses"), value(plan.stopAfterLosses, t)], [t("propPass.plan.instrument"), plan.preferredInstrument ?? t("propPass.cockpit.needsSetup")], [t("propPass.plan.session"), plan.allowedSessionId ?? t("propPass.cockpit.needsSetup")], [t("propPass.cockpit.row.calculation"), plan.calculationVersion]]} /> : <Unavailable label={t("propPass.cockpit.unavailable.plan")} />}{close}</Detail>;
  if (id === "calculator") return <Detail title={t("propPass.cockpit.panel.contractCalculator")} close={close}><Rows rows={[[t("propPass.cockpit.row.allowedRisk"), money(output.allowedRisk.values.allowedRiskMinor, currency, t)], [t("propPass.cockpit.row.lossPerContract"), money(output.contractSize?.values.totalLossPerContractMinor ?? null, currency, t)], [t("propPass.cockpit.row.recommendedContracts"), value(output.contractSize?.values.recommendedContracts, t)], [t("propPass.cockpit.row.actualPlannedRisk"), money(output.contractSize?.values.actualRiskMinor ?? null, currency, t)], [t("propPass.cockpit.row.unusedRisk"), money(output.contractSize?.values.unusedRiskMinor ?? null, currency, t)], [t("propPass.cockpit.row.rounding"), t("propPass.cockpit.contractsRoundDown")]]} /><Missing values={output.contractSize?.missingInputs ?? []} t={t} /><CalculationTrace output={output} stages={["instrument", "contract_size"]} t={t} /></Detail>;
  if (id === "what_if") { const scenario = output.whatIf; return <Detail title={t("propPass.cockpit.whatIfSimulator")} close={close}>{scenario ? <><Rows rows={[[t("propPass.cockpit.row.projectedEquity"), money(scenario.values.projectedEquityMinor, currency, t)], [t("propPass.cockpit.row.projectedBalance"), money(scenario.values.projectedBalanceMinor, currency, t)], [t("propPass.cockpit.row.dailyRoom"), money(scenario.values.projectedDailyRoomMinor, currency, t)], [t("propPass.cockpit.row.drawdownRoom"), money(scenario.values.projectedDrawdownRoomMinor, currency, t)], [t("propPass.cockpit.row.weeklyRoom"), money(scenario.values.projectedWeeklyRoomMinor, currency, t)], [t("propPass.cockpit.row.anotherTradePermitted"), scenario.values.anotherTradePermitted == null ? t("propPass.cockpit.needsInput") : scenario.values.anotherTradePermitted ? t("propPass.cockpit.yes") : t("propPass.cockpit.no")]]} /><Missing values={scenario.missingInputs} t={t} /></> : <Unavailable label={t("propPass.cockpit.unavailable.whatIf")} />}</Detail>; }
  if (id === "risk_modes") return <ModeComparison output={output} currency={currency} context={context} close={close} />;
  if (id === "rules") return <Detail title={t("propPass.cockpit.panel.riskRules")} close={close}><Rows rows={[[t("propPass.cockpit.row.ruleVersion"), runtime.versions.ruleVersion], [t("propPass.cockpit.row.instrumentVersion"), runtime.versions.instrumentVersion ?? t("propPass.cockpit.needsVerifiedInstrument")], [t("propPass.cockpit.row.calculationVersion"), runtime.versions.calculationVersion], [t("propPass.cockpit.row.dailyRoom"), money(output.hardRiskRooms?.dailyLossRemainingMinor ?? null, currency, t)], [t("propPass.cockpit.row.maximumLossRoom"), money(output.hardRiskRooms?.maximumLossRemainingMinor ?? null, currency, t)], [t("propPass.cockpit.row.drawdownRoom"), money(output.hardRiskRooms?.drawdownRemainingMinor ?? null, currency, t)], [t("propPass.cockpit.row.weeklyRoom"), money(output.hardRiskRooms?.weeklyLossRemainingMinor ?? null, currency, t)]]} /><YdlText role="caption" color="text.secondary">{t("propPass.autopilot.warning")}</YdlText>{context === "live" ? <PropPassLiveSettingsEditor accountId={runtime.accountId} onSaved={onRefresh} /> : null}<CalculationTrace output={output} stages={["rules", "trading_day", "instrument", "hard_risk_rooms"]} t={t} /></Detail>;
  if (id === "readiness") { const result = context === "live" ? output.withdrawalReadiness : output.payoutReadiness; const amount = context === "live" ? output.withdrawalReadiness?.values.recommendedMaximumWithdrawalMinor : output.payoutReadiness?.values.recommendedMaximumPayoutMinor; return <Detail title={context === "live" ? t("propPass.cockpit.safeWithdrawal") : t("propPass.cockpit.payoutPlanner")} close={close}><Rows rows={[[t("propPass.commandCenter.readiness"), title(result?.status ?? "needs_input")], [t("propPass.cockpit.row.recommendedMaximum"), money(amount ?? null, currency, t)], [t("propPass.cockpit.row.safetyFloor"), money(context === "live" ? output.withdrawalReadiness?.values.safetyFloorMinor ?? null : output.payoutReadiness?.values.safetyFloorMinor ?? null, currency, t)], [t("propPass.cockpit.row.reserve"), money(context === "live" ? output.withdrawalReadiness?.values.reserveMinor ?? null : output.payoutReadiness?.values.postPayoutReserveMinor ?? null, currency, t)]]} /><Missing values={result?.missingInputs ?? []} t={t} />{context === "challenge" && output.payoutPlanner ? <Rows rows={output.payoutPlanner.values.scenarios.map((scenario) => [money(scenario.amountMinor, currency, t), scenario.permitted ? t("propPass.cockpit.withinSafeLimit") : title(scenario.blocker ?? "blocked")])} /> : null}<YdlText role="caption" color="text.secondary">{t("propPass.cockpit.planningOnlyDisclaimer")}</YdlText></Detail>; }
  if (id === "timeline") return <Detail title={t("propPass.cockpit.panel.accountTimeline")} close={close}>{output.timeline.length ? output.timeline.map((event) => <YdlCard key={`${event.type}:${event.occurredAt}`}><YdlText role="bodyEmphasized">{title(event.type)}</YdlText><YdlText role="caption" color="text.secondary">{event.occurredAt}</YdlText><YdlText role="body">{event.explanation}</YdlText></YdlCard>) : <Unavailable label={t("propPass.cockpit.unavailable.timeline")} />}</Detail>;
  if (id === "replay") { const replay = output.decisionReplay; return <Detail title={t("propPass.cockpit.decisionReplay")} close={close}><StatusChip status={replay.verdict} fallback={t("propPass.cockpit.insufficientData")} /><YdlText role="bodyEmphasized">{replay.reason}</YdlText><YdlText role="body" color="text.secondary">{replay.mathematicalConsequence}</YdlText><YdlText role="body">{t("propPass.commandCenter.nextAction", { action: replay.nextAction })}</YdlText>{replay.relatedTradeId && onOpenTrade ? <YdlButton label={t("propPass.cockpit.openJournalTrade")} variant="secondary" onPress={() => onOpenTrade(replay.relatedTradeId!)} /> : null}</Detail>; }
  if (id === "live_health") { const live = output.liveLifecycle?.values; return <Detail title={context === "live" ? t("propPass.cockpit.capitalPreservation") : t("propPass.commandCenter.title")} close={close}>{context === "live" ? <><Rows rows={[[t("propPass.cockpit.row.state"), title(live?.state ?? "needs_input")], [t("propPass.cockpit.row.preservationScore"), scoreLabel(live?.preservation?.score ?? null, t)], [t("propPass.cockpit.row.recoveryMode"), live?.recovery?.active == null ? t("propPass.cockpit.needsInput") : live.recovery.active ? t("propPass.cockpit.active") : t("propPass.cockpit.normal")], [t("propPass.cockpit.row.killSwitch"), live?.killSwitch?.active == null ? t("propPass.cockpit.needsInput") : live.killSwitch.active ? t("propPass.commandCenter.killSwitchActive") : t("propPass.cockpit.clear")], [t("propPass.cockpit.weeklyLossRoom"), money(live?.weeklyLossRoomMinor ?? null, currency, t)], [t("propPass.cockpit.row.nextImprovement"), live?.preservation?.primaryImprovementAction ?? t("propPass.cockpit.completeRiskSetup")]]} /></> : <><Rows rows={[[t("propPass.cockpit.row.selectedAccount"), runtime.accountId], [t("propPass.cockpit.row.lifecycle"), title(output.challengeLifecycle?.values.state ?? "needs_input")], [t("propPass.cockpit.row.riskState"), title(output.riskMeter.values.status ?? "needs_input")], [t("propPass.cockpit.row.nextAction"), output.interventions[0]?.recommendedAction ?? t("propPass.cockpit.keepAccountInPlan")]]} /><YdlText role="caption" color="text.secondary">{t("propPass.cockpit.accountIsolationNote")}</YdlText></>}</Detail>; }
  if (id === "survival") return <Detail title={t("propPass.cockpit.panel.survivalCapacity")} close={close}><YdlText role="caption" color="text.secondary">{t("propPass.cockpit.survivalDisclaimer")}</YdlText><Rows rows={output.survival.values.modes.map((mode) => [title(mode.mode), mode.maximumRiskLossesRemaining == null ? t("propPass.cockpit.needsInput") : t("propPass.cockpit.maximumRiskLossesRemaining", { count: mode.maximumRiskLossesRemaining })])} /><Rows rows={[[t("propPass.cockpit.row.hardRoom"), money(output.survival.values.hardRoomMinor, currency, t)], [t("propPass.cockpit.row.dailyCapacity"), value(output.survival.values.dailyCapacity, t)], [t("propPass.cockpit.row.drawdownCapacity"), value(output.survival.values.drawdownCapacity, t)]]} /></Detail>;
  if (id === "calendar") {
    const fact = calendarFactFromPipelineOutput(output);
    const days = fact ? buildDailyRiskCalendar([fact]) : [];
    return (
      <Detail title={t("propPass.cockpit.dailyRiskCalendar")} close={close}>
        {days.length ? days.map((day) => (
          <YdlCard key={day.tradingDayId} testID={`prop-pass-calendar-day-${day.tradingDayId}`}>
            <View style={styles.heroTop}>
              <YdlText role="bodyEmphasized">{day.tradingDayId}</YdlText>
              <YdlChip label={title(day.semanticState)} />
            </View>
            <Rows rows={[
              [t("propPass.cockpit.row.riskUsed"), money(day.riskUsedMinor, currency, t)],
              [t("propPass.cockpit.row.riskRemaining"), money(day.riskRemainingMinor, currency, t)],
              [t("propPass.cockpit.row.health"), title(day.health ?? "needs_input")],
              [t("propPass.cockpit.row.trades"), String(day.tradeIds.length)],
              [t("propPass.cockpit.row.interventions"), String(day.interventions.length)],
              [t("propPass.cockpit.row.markers"), day.markers.length ? day.markers.map(title).join(", ") : t("propPass.cockpit.none")],
            ]} />
          </YdlCard>
        )) : <Unavailable label={t("propPass.cockpit.unavailable.calendar")} />}
        <YdlText role="caption" color="text.secondary">{t("propPass.cockpit.calendarPersistedNote")}</YdlText>
      </Detail>
    );
  }
  if (id === "breach") { const breach = output.breachReplay.values; return <Detail title={t("propPass.cockpit.breachReplay")} close={close}>{breach ? <><YdlText role="bodyEmphasized">{t("propPass.cockpit.accountFailedHere")}</YdlText><Rows rows={[[t("propPass.cockpit.row.trade"), breach.triggeringTradeId], [t("propPass.cockpit.row.rule"), breach.ruleId], [t("propPass.cockpit.row.bufferBefore"), money(breach.bufferBeforeMinor, currency, t)], [t("propPass.cockpit.row.plannedRisk"), money(breach.plannedRiskMinor, currency, t)], [t("propPass.cockpit.row.actualRisk"), money(breach.actualRiskMinor, currency, t)], [t("propPass.cockpit.row.breachAmount"), money(breach.breachAmountMinor, currency, t)], [t("propPass.cockpit.row.recommendedContracts"), String(breach.counterfactual.contracts)], [t("propPass.cockpit.row.projectedRemainingBuffer"), money(breach.counterfactual.projectedRemainingBufferMinor, currency, t)]]} /><YdlText role="caption" color="text.secondary">{t("propPass.cockpit.counterfactualNote")}</YdlText></> : <Unavailable label={t("propPass.cockpit.unavailable.breach")} />}</Detail>; }
  if (id === "session_lock") {
    const kill = resolveKillSwitchValues(output);
    const lockTrigger = kill?.exactTriggers.find((trigger) => /manual session lock/i.test(trigger)) ?? null;
    const lockReviewRows: Array<[string, string]> = [];
    if (kill?.manualSessionLockReason) lockReviewRows.push([t("propPass.sessionLock.reasonLabel"), kill.manualSessionLockReason]);
    if (kill?.manualSessionLockExpiresAt) lockReviewRows.push([t("propPass.cockpit.row.reviewExpires"), formatReviewExpiry(kill.manualSessionLockExpiresAt)]);
    return (
      <Detail title={t("propPass.cockpit.panel.sessionLock")} close={close}>
        <Rows rows={[
          [t("propPass.cockpit.row.state"), kill?.active ? t("propPass.commandCenter.killSwitchActive") : t("propPass.cockpit.ready")],
          [t("propPass.cockpit.row.recommendedRisk"), money(kill?.recommendedRiskMinor ?? output.allowedRisk.values.allowedRiskMinor, currency, t)],
          [t("propPass.cockpit.row.recommendedContracts"), String(kill?.recommendedContracts ?? output.contractSize?.values.recommendedContracts ?? 0)],
          [t("propPass.cockpit.row.gambler"), kill?.gamblerDisabled ? t("propPass.cockpit.disabled") : t("propPass.cockpit.hardLimitsActive")],
          [t("propPass.cockpit.row.manualLock"), lockTrigger ? t("propPass.cockpit.serverConfirmed") : kill?.manualConfirmationRequired ? t("propPass.cockpit.confirmationRequired") : t("propPass.cockpit.notActive")],
          ...lockReviewRows,
          [t("propPass.cockpit.row.reset"), kill?.resetInstruction ?? t("propPass.cockpit.useSessionBoundary")],
        ]} />
        {kill?.exactTriggers.map((trigger) => <YdlText key={trigger} role="body" color="text.secondary">• {trigger}</YdlText>)}
        <YdlText role="caption" color="text.secondary">{t("propPass.cockpit.sessionLockNote")}</YdlText>
        <PropPassSessionLockControl accountId={runtime.accountId} active={Boolean(kill?.active)} onActivated={onRefresh} />
      </Detail>
    );
  }
  return <Detail title={t("propPass.productTitle")} close={close}><YdlButton label={t("propPass.cockpit.assignJournalTrades")} onPress={onAssignTrades} /></Detail>;
}

function ModeComparison({ output, currency, context, close }: { output: PropPassCalculationPipelineOutput; currency: string; context: "challenge" | "live"; close: React.ReactNode }) {
  const { t } = useTranslation();
  const modes = output.hardRiskRooms ? compareRiskModes(output.hardRiskRooms, context, output.contractSize?.values.totalLossPerContractMinor ?? null) : [];
  return (
    <Detail title={t("propPass.cockpit.panel.riskModes")} close={close}>
      {modes.length ? modes.map((mode) => (
        <YdlCard key={mode.mode} variant={output.dailyPlan.values?.mode === mode.mode ? "selected" : "outlined"}>
          <View style={styles.heroTop}>
            <YdlText role="bodyEmphasized">{title(mode.mode)}{mode.highRisk ? ` · ${t("propPass.cockpit.highRiskBadge")}` : ""}</YdlText>
            <YdlChip label={mode.enabled ? t("propPass.cockpit.available") : t("propPass.cockpit.disabledBySafeRoom")} disabled={!mode.enabled} />
          </View>
          <Rows rows={[[t("propPass.cockpit.row.riskPerTrade"), money(mode.riskPerTradeMinor, currency, t)], [t("propPass.cockpit.row.maximumDailyRisk"), money(mode.maximumDailyRiskMinor, currency, t)], [t("propPass.liveSettings.maximumTrades"), String(mode.maximumTrades)], [t("propPass.riskMode.stopAfterLosses"), String(mode.stopAfterLosses)], [t("propPass.cockpit.row.recommendedContracts"), mode.requiresInstrumentSetup ? t("propPass.cockpit.verifyInstrumentCosts") : String(mode.recommendedContracts)], [t("propPass.cockpit.row.maximumProjectedDamage"), money(mode.maximumProjectedDamageMinor, currency, t)], [t("propPass.cockpit.row.remainingBuffer"), money(mode.projectedRemainingBufferMinor, currency, t)]]} />
          {mode.requiresConfirmation ? <YdlButton label={t("propPass.cockpit.reviewHighRiskConsequence")} variant="destructive" onPress={() => Alert.alert(t("propPass.cockpit.highRiskModeTitle"), t("propPass.cockpit.highRiskModeBody", { amount: money(mode.maximumProjectedDamageMinor, currency, t) }), [{ text: t("propPass.close") }])} /> : null}
        </YdlCard>
      )) : <Unavailable label={t("propPass.cockpit.unavailable.modes")} />}
    </Detail>
  );
}

function CompactRiskStrip({ output, currency, t }: { output: PropPassCalculationPipelineOutput; currency: string; t: TFunction }) {
  const theme = useYdlTheme("dark");
  const status = output.riskMeter.values.status;
  return (
    <View style={[styles.riskStrip, { backgroundColor: status === "stop_trading" ? theme.colors.status.negativeSoft : status === "danger" ? theme.colors.status.warningSoft : theme.colors.surface.interactive }]} accessibilityRole="summary" testID="prop-pass-sticky-risk-meter">
      <YdlText role="label">{title(status ?? "needs_input")}</YdlText>
      <YdlText role="bodyEmphasized">{t("propPass.cockpit.remainingAmount", { amount: money(output.riskMeter.values.remainingMinor, currency, t) })}</YdlText>
      <YdlText role="caption" color="text.secondary">{resolveKillSwitchValues(output)?.active ? t("propPass.cockpit.killSwitchActiveLabel") : t("propPass.cockpit.hardLimitsActive")}</YdlText>
    </View>
  );
}

function RiskProgress({ usedRatio, status, reduceMotion, t }: { usedRatio: number | null; status: string | null; reduceMotion: boolean; t: TFunction }) {
  const theme = useYdlTheme("dark");
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withTiming(Math.max(0, Math.min(1, usedRatio ?? 0)), { duration: reduceMotion ? 0 : 350 }); }, [progress, reduceMotion, usedRatio]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const color = status === "stop_trading" ? theme.colors.status.negative : status === "danger" || status === "watch" ? theme.colors.status.warning : theme.colors.status.positive;
  return (
    <View
      style={[styles.progressTrack, { backgroundColor: theme.colors.surface.interactive }]}
      accessible
      accessibilityLabel={usedRatio == null ? t("propPass.cockpit.riskUsageNeedsInput") : t("propPass.cockpit.riskUsagePercent", { percent: Math.round(usedRatio * 100) })}
    >
      <Animated.View style={[styles.progressFill, { backgroundColor: color }, animated]} />
    </View>
  );
}

function Detail({ title: heading, children, close }: { title: string; children: React.ReactNode; close: React.ReactNode }) { return <View style={styles.stack} testID="prop-pass-detail-panel" accessibilityViewIsModal><View style={styles.heroTop}><YdlText role="title">{heading}</YdlText>{close}</View>{children}</View>; }
function Action({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) { return <YdlCard variant="interactive" onPress={onPress} accessibilityLabel={`${label}. ${detail}`} style={styles.action}><YdlText role="bodyEmphasized">{label}</YdlText><YdlText role="caption" color="text.secondary">{detail}</YdlText></YdlCard>; }
function Metric({ label, value: display }: { label: string; value: string }) { return <View style={styles.metric}><YdlText role="caption" color="text.secondary">{label}</YdlText><YdlText role="bodyEmphasized">{display}</YdlText></View>; }
function Rows({ rows }: { rows: Array<[string, string]> }) { return <YdlCard>{rows.map(([label, display]) => <View key={`${label}:${display}`} style={styles.row}><YdlText role="caption" color="text.secondary" style={styles.flex}>{label}</YdlText><YdlText role="bodyEmphasized" style={styles.value}>{display}</YdlText></View>)}</YdlCard>; }
function StatusChip({ status, fallback }: { status: string | null; fallback: string }) { const normalized = status ?? fallback; return <YdlChip label={title(normalized)} leadingSymbol={/stop|violation|danger|breach|fail/i.test(normalized) ? "warning" : /safe|healthy|good|pass|active/i.test(normalized) ? "success" : "info"} />; }
function Missing({ values, t }: { values: string[]; t: TFunction }) { return values.length ? <YdlCard><YdlText role="bodyEmphasized">{t("propPass.cockpit.completeSetup")}</YdlText>{[...new Set(values)].slice(0, 8).map((item) => <YdlText role="body" color="text.secondary" key={item}>• {setupAction(item, t)}</YdlText>)}</YdlCard> : null; }
function CalculationTrace({ output, stages, t }: { output: PropPassCalculationPipelineOutput; stages: PropPassCalculationPipelineOutput["calculationTrace"][number]["stage"][]; t: TFunction }) { const rows = output.calculationTrace.filter((step) => stages.includes(step.stage)); return <YdlCard><YdlText role="bodyEmphasized">{t("propPass.cockpit.calculationTrace")}</YdlText>{rows.map((step) => <View key={step.stage} style={styles.trace}><YdlText role="label">{step.order}. {title(step.stage)}</YdlText><YdlText role="caption" color="text.secondary">{title(step.status)} · {step.sourceVersion ?? output.calculationVersion}</YdlText>{step.arithmetic.map((line) => <YdlText role="caption" color="text.secondary" key={line}>{line}</YdlText>)}{step.rounding.map((line) => <YdlText role="caption" color="text.secondary" key={line}>{line}</YdlText>)}</View>)}</YdlCard>; }
function Unavailable({ label }: { label: string }) { return <YdlText role="body" color="text.secondary">{label}</YdlText>; }
function money(minor: number | null | undefined, currency: string, t: TFunction): string { if (minor == null || !Number.isSafeInteger(minor)) return t("propPass.cockpit.needsInput"); return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100); }
function value(input: number | null | undefined, t: TFunction): string { return input == null ? t("propPass.cockpit.needsInput") : String(input); }
function title(value: string): string { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function scoreLabel(score: number | null, t: TFunction): string { return score == null ? t("propPass.cockpit.needsInput") : t("propPass.cockpit.scoreValue", { score }); }
function formatReviewExpiry(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(parsed));
}
function setupAction(code: string, t: TFunction): string { return t("propPass.cockpit.setupAction", { field: title(code).toLowerCase() }); }

const styles = StyleSheet.create({ stack: { gap: 12 }, hero: { gap: 14 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, flex: { flex: 1 }, display: { fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] }, progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" }, progressFill: { height: 8, borderRadius: 999 }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, metric: { width: "47%", gap: 3 }, warning: { borderRadius: 12, padding: 12, gap: 4 }, riskStrip: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, action: { width: "48%", minHeight: 94, justifyContent: "space-between" }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingVertical: 3 }, value: { maxWidth: "58%", textAlign: "right" }, trace: { gap: 3, paddingTop: 6 } });
