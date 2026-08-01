import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { newPropOsClientRequestId } from "../propOs/commands/hash";
import { trackPropPassEvent } from "./analytics";
import { BufferHealthSection } from "./BufferHealthSection";
import { runPropPassCommand } from "./commandGateway";
import { PropPassOnboardingFlow } from "./PropPassOnboardingFlow";
import { PropPassAssignmentFlow } from "./PropPassAssignmentFlow";
import { PerformanceIntelligenceInternalPanel } from "./PerformanceIntelligenceInternalPanel";
import { usePropPassAvailability } from "./usePropPassAvailability";
import { PropPassAccountMenu } from "./ui/PropPassAccountMenu";
import { PropPassAccountSwitcher } from "./ui/PropPassAccountSwitcher";
import { PropPassChallengeHero } from "./ui/PropPassChallengeHero";
import { PropPassInsightsCard } from "./ui/PropPassInsightsCard";
import { PropPassRecentActivity } from "./ui/PropPassRecentActivity";
import { PropPassTargetProgress } from "./ui/PropPassTargetProgress";
import { PropPassTodaysPlan } from "./ui/PropPassTodaysPlan";
import type {
  ChallengeSummary,
  PropPassInsightsPresentation,
  PropPassTodaysPlanView,
  PropPassUiState,
  PropPassViewModel,
} from "./types";
import type { Trade } from "../app/types";
import {
  createMemoryIntelligenceStore,
  createSupabaseIntelligenceReadStore,
  type MemoryIntelligenceStore,
} from "../propOs/intelligence";
import { supabase } from "../config/appConfig";

type Props = {
  userId: string | null | undefined;
  accountId?: string | null;
  /** Optional — omitted for primary-tab presentation. */
  onClose?: () => void;
  /** `tab` = primary product home; `modal` = legacy Settings preview. */
  presentation?: "tab" | "modal";
  uiStateOverride?: PropPassUiState;
  /** Optional execution plan presentation (staging fixture or future server plan). */
  todaysPlan?: PropPassTodaysPlanView | null;
  insightsPresentation?: PropPassInsightsPresentation;
  developerMode?: boolean;
  /** Journal trades for assignment (optional; empty → empty assignable list). */
  trades?: Trade[];
  /** Optional PI memory store for QA injection; falls back to empty in-memory store. */
  intelligenceStore?: MemoryIntelligenceStore;
};

export function PropPassInternalScreen({
  userId,
  accountId,
  onClose,
  presentation = "modal",
  uiStateOverride,
  todaysPlan = null,
  insightsPresentation = "from_model",
  developerMode = typeof __DEV__ !== "undefined" && __DEV__,
  trades = [],
  intelligenceStore: intelligenceStoreProp,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const controller = usePropPassAvailability({ userId, accountId });
  const uiState = uiStateOverride ?? controller.uiState;
  const fallbackIntelligenceStore = useMemo(() => createMemoryIntelligenceStore(), []);
  const intelligenceStore = intelligenceStoreProp ?? fallbackIntelligenceStore;
  const remoteIntelligenceStore = useMemo(() => {
    if (!userId || !supabase) return null;
    return createSupabaseIntelligenceReadStore(supabase, userId);
  }, [userId]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);

  useEffect(() => {
    trackPropPassEvent("prop_pass_opened", {
      mode: presentation === "tab" ? "primary_tab" : controller.entryVisible ? "internal" : "off",
      userId,
    });
    return () => {
      trackPropPassEvent("prop_pass_internal_preview_closed", { userId });
    };
  }, [controller.entryVisible, presentation, userId]);

  return (
    <View
      style={[styles.root, { backgroundColor: theme.colors.background.primary }]}
      testID={presentation === "tab" ? "prop-pass-primary-screen" : "prop-pass-internal-screen"}
    >
      <View style={styles.header}>
        <YdlText role="title">
          {t(presentation === "tab" ? "propPass.productTitle" : "propPass.title")}
        </YdlText>
        {presentation === "modal" && onClose ? (
          <YdlButton
            label={t("propPass.close")}
            variant="tertiary"
            onPress={onClose}
          />
        ) : null}
      </View>
      {presentation === "modal" ? (
        <YdlText role="caption" color="text.secondary">
          {t("propPass.internalBanner")}
        </YdlText>
      ) : (
        <YdlText role="caption" color="text.secondary">
          {t("propPass.productBanner")}
        </YdlText>
      )}
      {commandMessage ? (
        <View accessibilityLiveRegion="polite">
          <YdlText role="caption" color="text.secondary">
            {commandMessage}
          </YdlText>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.body} accessibilityRole="scrollbar">
        {showIntelligence && userId && uiState.kind === "available" ? (
          <PerformanceIntelligenceInternalPanel
            userId={userId}
            accountId={uiState.model.account.id}
            challengeId={uiState.model.challenge.id}
            store={remoteIntelligenceStore ? undefined : intelligenceStore}
            readStoreOverride={remoteIntelligenceStore ?? undefined}
            runLocalTrustedCalc={!remoteIntelligenceStore}
            assignmentRevision={intelligenceStore.assignmentRevision}
            onClose={() => setShowIntelligence(false)}
          />
        ) : showOnboarding && userId ? (
          <PropPassOnboardingFlow
            userId={userId}
            onCancel={() => setShowOnboarding(false)}
            onCompleted={() => {
              setShowOnboarding(false);
              setCommandMessage(t("propPass.onboarding.successBody"));
              controller.refresh();
            }}
          />
        ) : showAssignment &&
          userId &&
          uiState.kind === "available" ? (
          <PropPassAssignmentFlow
            userId={userId}
            accountId={uiState.model.account.id}
            challengeId={uiState.model.challenge.id}
            challengeStatus={uiState.model.challenge.status}
            accountStatus={uiState.model.account.lifecycleStatus}
            challengeStartedAt={uiState.model.challenge.startedAt ?? new Date().toISOString()}
            trades={trades}
            onClose={() => setShowAssignment(false)}
            onCompleted={() => {
              setShowAssignment(false);
              setCommandMessage(t("propPass.assignment.successTitle"));
              controller.refresh();
            }}
          />
        ) : (
          renderState(uiState, t, controller, {
            onStartOnboarding: () => setShowOnboarding(true),
            onStartAssignment: () => {
              trackPropPassEvent("prop_pass_assignment_flow_opened", { userId });
              setShowAssignment(true);
            },
            onOpenIntelligence: () => setShowIntelligence(true),
            showAccountMenu,
            setShowAccountMenu,
            showHistory,
            setShowHistory,
            userId: userId ?? null,
            setCommandMessage,
            todaysPlan,
            insightsPresentation,
          })
        )}
      </ScrollView>
    </View>
  );
}

type Actions = {
  onStartOnboarding: () => void;
  onStartAssignment: () => void;
  onOpenIntelligence: () => void;
  showAccountMenu: boolean;
  setShowAccountMenu: (v: boolean) => void;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  userId: string | null;
  setCommandMessage: (msg: string | null) => void;
  todaysPlan: PropPassTodaysPlanView | null;
  insightsPresentation: PropPassInsightsPresentation;
};

function renderState(
  state: PropPassUiState,
  t: (key: string, opts?: Record<string, unknown>) => string,
  controller: ReturnType<typeof usePropPassAvailability>,
  actions: Actions,
): React.ReactNode {
  switch (state.kind) {
    case "disabled":
      return <StateCard title={t("propPass.state.disabled")} body={t("propPass.state.disabledBody")} />;
    case "loading":
      return (
        <View style={styles.skeleton} testID="prop-pass-loading" accessibilityLabel={t("propPass.state.loading")}>
          <View style={[styles.skelBlock, { height: 72 }]} />
          <View style={[styles.skelBlock, { height: 140 }]} />
          <View style={[styles.skelBlock, { height: 96 }]} />
          <YdlText role="caption" color="text.secondary">
            {t("propPass.state.loadingBody")}
          </YdlText>
        </View>
      );
    case "no_account":
      return (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.state.noAccount")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.state.noAccountBody")}
          </YdlText>
          <YdlButton
            label={t("propPass.onboarding.startCta")}
            onPress={actions.onStartOnboarding}
          />
        </YdlCard>
      );
    case "no_active_challenge":
      return (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.state.noActiveChallenge")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.state.noActiveChallengeBody")}
          </YdlText>
          <YdlButton
            label={t("propPass.onboarding.startCta")}
            variant="secondary"
            onPress={actions.onStartOnboarding}
          />
        </YdlCard>
      );
    case "challenge_selection_required":
      return (
        <ChallengeResolverCard
          challenges={state.challenges}
          accountId={state.accountId}
          userId={actions.userId}
          t={t}
          onPreview={(id) => controller.selectChallengePreview(id)}
          onDone={(msg) => {
            actions.setCommandMessage(msg);
            controller.refresh();
          }}
        />
      );
    case "missing_rule_snapshot":
      return <StateCard title={t("propPass.state.missingRule")} body={t("propPass.state.missingRuleBody")} />;
    case "no_shadow_snapshot":
      return <StateCard title={t("propPass.state.noShadow")} body={t("propPass.state.noShadowBody")} />;
    case "stale_snapshot":
      return (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.state.stale")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.state.staleBody")}
          </YdlText>
          <YdlButton label={t("propPass.refreshCta")} onPress={() => controller.refresh()} />
        </YdlCard>
      );
    case "incomplete_data":
      return (
        <StateCard
          title={t("propPass.state.incomplete")}
          body={t("propPass.state.incompleteBody", { reasons: state.reasonCodes.join(", ") })}
        />
      );
    case "unsupported":
      return (
        <StateCard
          title={t("propPass.state.unsupported")}
          body={t("propPass.state.unsupportedBody", { reasons: state.reasonCodes.join(", ") })}
        />
      );
    case "integrity_error":
      return <StateCard title={t("propPass.state.integrity")} body={t("propPass.state.integrityBody")} />;
    case "repository_unavailable":
      return (
        <StateCard
          title={t("propPass.state.repository")}
          body={t("propPass.state.repositoryBody")}
          a11yLive
        />
      );
    case "available":
      return (
        <AvailableView
          model={state.model}
          t={t}
          userId={actions.userId}
          showAccountMenu={actions.showAccountMenu}
          setShowAccountMenu={actions.setShowAccountMenu}
          showHistory={actions.showHistory}
          setShowHistory={actions.setShowHistory}
          todaysPlan={actions.todaysPlan}
          insightsPresentation={actions.insightsPresentation}
          onArchived={() => {
            actions.setCommandMessage(t("propPass.archive.success"));
            controller.refresh();
          }}
          onMessage={actions.setCommandMessage}
          onRefresh={() => controller.refresh()}
          onAssignTrades={actions.onStartAssignment}
          onOpenIntelligence={actions.onOpenIntelligence}
        />
      );
    default:
      return <StateCard title={t("propPass.state.disabled")} body={t("propPass.state.disabledBody")} />;
  }
}

function ChallengeResolverCard({
  challenges,
  accountId,
  userId,
  t,
  onPreview,
  onDone,
}: {
  challenges: ChallengeSummary[];
  accountId: string | null;
  userId: string | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onPreview: (id: string) => void;
  onDone: (msg: string) => void;
}) {
  return (
    <YdlCard>
      <YdlText role="bodyEmphasized">{t("propPass.state.selectionRequired")}</YdlText>
      <YdlText role="caption" color="text.secondary">
        {t("propPass.state.selectionRequiredBody")}
      </YdlText>
      {challenges.map((c) => (
        <View key={c.id} style={styles.resolverRow}>
          <YdlButton
            label={`${c.status} · ${c.startedAt.slice(0, 10)}`}
            variant="secondary"
            onPress={() => onPreview(c.id)}
          />
          <YdlButton
            label={t("propPass.resolver.persistSelect", { id: c.startedAt.slice(0, 10) })}
            onPress={() => {
              if (!userId || !accountId) {
                onDone(t("propPass.resolver.needAccountId"));
                return;
              }
              const req = newPropOsClientRequestId();
              void runPropPassCommand(
                req,
                userId,
                (svc) =>
                  svc.selectActiveChallenge({
                    clientRequestId: req,
                    accountId,
                    challengeId: c.id,
                  }),
                "prop_pass_challenge_selection_changed",
              ).then((res) => {
                onDone(
                  res.kind === "success"
                    ? t("propPass.resolver.saved")
                    : t("propPass.command.unexpected"),
                );
              });
            }}
          />
        </View>
      ))}
      <YdlButton
        label={t("propPass.resolver.clear")}
        variant="tertiary"
        onPress={() => {
          if (!userId || !accountId) {
            onDone(t("propPass.resolver.needAccountId"));
            return;
          }
          const req = newPropOsClientRequestId();
          void runPropPassCommand(req, userId, (svc) =>
            svc.clearActiveChallengeSelection({
              clientRequestId: req,
              accountId,
            }),
          ).then(() => onDone(t("propPass.resolver.cleared")));
        }}
      />
    </YdlCard>
  );
}

function StateCard({
  title,
  body,
  a11yLive,
}: {
  title: string;
  body: string;
  a11yLive?: boolean;
}) {
  return (
    <YdlCard>
      <View
        accessibilityLiveRegion={a11yLive ? "polite" : undefined}
        accessibilityRole="text"
        accessibilityLabel={`${title}. ${body}`}
      >
        <YdlText role="bodyEmphasized">{title}</YdlText>
        <YdlText role="body" color="text.secondary">
          {body}
        </YdlText>
      </View>
    </YdlCard>
  );
}

function AvailableView({
  model,
  t,
  userId,
  showAccountMenu,
  setShowAccountMenu,
  showHistory,
  setShowHistory,
  todaysPlan,
  insightsPresentation,
  onArchived,
  onMessage,
  onRefresh,
  onAssignTrades,
  onOpenIntelligence,
}: {
  model: PropPassViewModel;
  t: (key: string, opts?: Record<string, unknown>) => string;
  userId: string | null;
  showAccountMenu: boolean;
  setShowAccountMenu: (v: boolean) => void;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  todaysPlan: PropPassTodaysPlanView | null;
  insightsPresentation: PropPassInsightsPresentation;
  onArchived: () => void;
  onMessage: (msg: string | null) => void;
  onRefresh: () => void;
  onAssignTrades: () => void;
  onOpenIntelligence: () => void;
}) {
  const currency =
    model.progress.profitTarget?.currency ??
    model.account.accountSize?.currency ??
    "USD";

  if (showHistory) {
    return (
      <View style={styles.available} testID="prop-pass-history-screen">
        <YdlText role="title">{t("propPass.activity.viewHistory")}</YdlText>
        {model.historicalAttempts.length === 0 ? (
          <YdlText role="caption" color="text.secondary">
            {t("propPass.history.empty")}
          </YdlText>
        ) : (
          model.historicalAttempts.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <YdlText role="bodyEmphasized">{h.startedAt.slice(0, 10)}</YdlText>
              <YdlText role="caption" color="text.secondary">
                {t("propPass.activity.row", { status: h.status })}
              </YdlText>
            </View>
          ))
        )}
        <YdlText role="caption" color="text.secondary">
          {t("propPass.assignment.assignedCount", { count: model.assignedTradeCount })}
        </YdlText>
        <YdlButton
          label={t("propPass.account.closeMenu")}
          variant="secondary"
          onPress={() => setShowHistory(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.available}>
      {model.freshness.status === "stale" ? (
        <View style={styles.offlineBanner} testID="prop-pass-offline-banner">
          <YdlText role="caption" color="text.secondary">
            {t("propPass.offlineCachedBanner")}
          </YdlText>
          <YdlButton label={t("propPass.refreshCta")} variant="secondary" onPress={onRefresh} />
        </View>
      ) : null}
      <PropPassAccountSwitcher
        model={model}
        onOpenMenu={() => setShowAccountMenu(true)}
      />
      <PropPassAccountMenu
        model={model}
        userId={userId}
        open={showAccountMenu}
        onClose={() => setShowAccountMenu(false)}
        onRefresh={onRefresh}
        onMessage={onMessage}
        onArchived={onArchived}
      />
      <PropPassChallengeHero model={model} />
      <PropPassTargetProgress model={model} />
      <BufferHealthSection buffers={model.buffers} currency={currency} />
      <PropPassTodaysPlan
        model={model}
        plan={todaysPlan}
        onReviewUnassigned={onAssignTrades}
        onEditPlan={onAssignTrades}
      />
      <PropPassInsightsCard
        model={model}
        insightsMode={insightsPresentation}
        onOpenDetail={() => {
          trackPropPassEvent("prop_pass_intelligence_opened", { userId });
          onOpenIntelligence();
        }}
        onRetry={() => {
          trackPropPassEvent("prop_pass_intelligence_opened", { userId });
          onOpenIntelligence();
        }}
      />
      <PropPassRecentActivity
        model={model}
        onViewHistory={() => setShowHistory(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: { gap: 12, paddingBottom: 40, paddingTop: 8 },
  available: { gap: 14 },
  resolverRow: { gap: 6, marginTop: 6 },
  historyRow: { gap: 2, paddingVertical: 6 },
  skeleton: { gap: 12 },
  skelBlock: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  offlineBanner: { gap: 8 },
});
