import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { newPropOsClientRequestId } from "../propOs/commands/hash";
import { trackPropPassEvent } from "./analytics";
import { runPropPassCommand } from "./commandGateway";
import { formatPropMoney } from "./formatMoney";
import { PropPassOnboardingFlow } from "./PropPassOnboardingFlow";
import { PropPassAssignmentFlow } from "./PropPassAssignmentFlow";
import { usePropPassAvailability } from "./usePropPassAvailability";
import { PropPassAccountMenu } from "./ui/PropPassAccountMenu";
import { PropPassAccountSwitcher } from "./ui/PropPassAccountSwitcher";
import { PropPassSessionCockpit } from "./ui/PropPassSessionCockpit";
import type {
  ChallengeSummary,
  PropPassInsightsPresentation,
  PropPassTerminalModel,
  PropPassTodaysPlanView,
  PropPassUiState,
  PropPassViewModel,
} from "./types";
import type { Trade } from "../app/types";
import { GENERATED_APP_ENV } from "../config/buildFingerprint.generated";
import { resolveEntitledPropPassUiState } from "./productState";

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
  onOpenTrade?: (tradeId: string) => void;
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
  onOpenTrade,
}: Props) {
  const { t } = useTranslation();
  void developerMode;
  const theme = useYdlTheme("dark");
  const controller = usePropPassAvailability({ userId, accountId });
  const gatewayUiState = uiStateOverride ?? controller.uiState;
  const uiState = resolveEntitledPropPassUiState({
    appEnvironment: GENERATED_APP_ENV,
    uiState: gatewayUiState,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
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
      <View style={[styles.header, presentation === "tab" && styles.tabHeader]}>
        <YdlText role={presentation === "tab" ? "label" : "title"}>
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
      ) : null}
      {commandMessage ? (
        <View accessibilityLiveRegion="polite">
          <YdlText role="caption" color="text.secondary">
            {commandMessage}
          </YdlText>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.body}
        accessibilityRole="scrollbar"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {showOnboarding && userId ? (
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
          (uiState.kind === "available" ||
            (uiState.kind === "no_shadow_snapshot" && uiState.assignmentContext)) ? (
          <PropPassAssignmentFlow
            userId={userId}
            accountId={
              uiState.kind === "available"
                ? uiState.model.account.id
                : uiState.assignmentContext!.accountId
            }
            challengeId={
              uiState.kind === "available"
                ? uiState.model.challenge.id
                : uiState.assignmentContext!.challengeId
            }
            challengeStatus={
              uiState.kind === "available"
                ? uiState.model.challenge.status
                : uiState.assignmentContext!.challengeStatus
            }
            accountStatus={
              uiState.kind === "available"
                ? uiState.model.account.lifecycleStatus
                : uiState.assignmentContext!.accountStatus
            }
            challengeStartedAt={
              uiState.kind === "available"
                ? uiState.model.challenge.startedAt ?? new Date().toISOString()
                : uiState.assignmentContext!.challengeStartedAt
            }
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
            showAccountMenu,
            setShowAccountMenu,
            userId: userId ?? null,
            setCommandMessage,
            t,
            todaysPlan,
            insightsPresentation,
            onOpenTrade,
          })
        )}
      </ScrollView>
    </View>
  );
}

type Actions = {
  onStartOnboarding: () => void;
  onStartAssignment: () => void;
  showAccountMenu: boolean;
  setShowAccountMenu: (v: boolean) => void;
  userId: string | null;
  setCommandMessage: (msg: string | null) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  todaysPlan: PropPassTodaysPlanView | null;
  insightsPresentation: PropPassInsightsPresentation;
  onOpenTrade?: (tradeId: string) => void;
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
    case "challenge_passed":
      return (
        <TerminalChallengeCard
          model={state.model}
          passed
          t={t}
          onStart={actions.onStartOnboarding}
          onArchive={() => archiveTerminalAccount(state.model.account.id, actions, controller)}
        />
      );
    case "challenge_failed":
      return (
        <TerminalChallengeCard
          model={state.model}
          passed={false}
          t={t}
          onStart={actions.onStartOnboarding}
          onReview={actions.onStartAssignment}
          onArchive={() => archiveTerminalAccount(state.model.account.id, actions, controller)}
        />
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
      return (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.state.noShadow")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.state.noShadowBody")}
          </YdlText>
          <YdlButton
            label={t("propPass.assignment.openCta")}
            onPress={actions.onStartAssignment}
          />
        </YdlCard>
      );
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
          todaysPlan={actions.todaysPlan}
          insightsPresentation={actions.insightsPresentation}
          onArchived={() => {
            actions.setCommandMessage(t("propPass.archive.success"));
            controller.refresh();
          }}
          onMessage={actions.setCommandMessage}
          onRefresh={() => controller.refresh()}
          onAssignTrades={actions.onStartAssignment}
          onOpenTrade={actions.onOpenTrade}
          runtimeState={controller.runtimeState}
          runtimeLoading={controller.runtimeLoading}
          runtimeError={controller.runtimeError}
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

function archiveTerminalAccount(
  accountId: string,
  actions: Actions,
  controller: ReturnType<typeof usePropPassAvailability>,
) {
  if (!actions.userId) {
    actions.setCommandMessage(actions.t("propPass.resolver.needAccountId"));
    return;
  }
  const req = newPropOsClientRequestId();
  void runPropPassCommand(
    req,
    actions.userId,
    (svc) => svc.archivePropAccount({ clientRequestId: req, accountId, confirmActive: true }),
    "prop_pass_account_archived",
  ).then((res) => {
    actions.setCommandMessage(
      res.kind === "success"
        ? actions.t("propPass.archive.success")
        : actions.t("propPass.command.unexpected"),
    );
    if (res.kind === "success") controller.refresh();
  });
}

function TerminalChallengeCard({
  model,
  passed,
  t,
  onStart,
  onReview,
  onArchive,
}: {
  model: PropPassTerminalModel;
  passed: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onStart: () => void;
  onReview?: () => void;
  onArchive: () => void;
}) {
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const reason = model.breachReasons[0];
  return (
    <YdlCard>
      <YdlText role="bodyEmphasized">
        {t(passed ? "propPass.terminal.passedTitle" : "propPass.terminal.failedTitle")}
      </YdlText>
      <YdlText role="body" color="text.secondary">
        {t(passed ? "propPass.terminal.passedBody" : "propPass.terminal.failedBody", {
          status: reason?.code ?? model.challenge.status,
          date: (model.challenge.endedAt ?? model.challenge.startedAt).slice(0, 10),
        })}
      </YdlText>
      {model.metrics ? (
        <YdlText role="caption" color="text.secondary">
          {t("propPass.terminal.metrics", {
            equity: formatPropMoney(model.metrics.equityMinor, {
              currency: model.metrics.currency,
            }),
            remaining: formatPropMoney(model.metrics.profitRemainingMinor, {
              currency: model.metrics.currency,
            }),
          })}
        </YdlText>
      ) : null}
      {!passed && onReview ? (
        <YdlButton label={t("propPass.terminal.reviewTrades")} variant="secondary" onPress={onReview} />
      ) : null}
      {archiveConfirm ? (
        <>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.archive.confirmBody")}
          </YdlText>
          <YdlButton label={t("propPass.archive.confirmCta")} variant="destructive" onPress={onArchive} />
          <YdlButton label={t("propPass.archive.cancel")} variant="tertiary" onPress={() => setArchiveConfirm(false)} />
        </>
      ) : (
        <YdlButton label={t("propPass.archive.cta")} variant="secondary" onPress={() => setArchiveConfirm(true)} />
      )}
      <YdlButton label={t("propPass.terminal.startAnother")} onPress={onStart} />
    </YdlCard>
  );
}

function AvailableView({
  model,
  t,
  userId,
  showAccountMenu,
  setShowAccountMenu,
  todaysPlan,
  insightsPresentation,
  onArchived,
  onMessage,
  onRefresh,
  onAssignTrades,
  onOpenTrade,
  runtimeState,
  runtimeLoading,
  runtimeError,
}: {
  model: PropPassViewModel;
  t: (key: string, opts?: Record<string, unknown>) => string;
  userId: string | null;
  showAccountMenu: boolean;
  setShowAccountMenu: (v: boolean) => void;
  todaysPlan: PropPassTodaysPlanView | null;
  insightsPresentation: PropPassInsightsPresentation;
  onArchived: () => void;
  onMessage: (msg: string | null) => void;
  onRefresh: () => void;
  onAssignTrades: () => void;
  onOpenTrade?: (tradeId: string) => void;
  runtimeState: ReturnType<typeof usePropPassAvailability>["runtimeState"];
  runtimeLoading: boolean;
  runtimeError: ReturnType<typeof usePropPassAvailability>["runtimeError"];
}) {
  // Kept as accepted staging fixture inputs for backwards-compatible QA routes;
  // production recommendations come only from the persisted Build 117 runtime.
  void todaysPlan;
  void insightsPresentation;

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
      <PropPassSessionCockpit
        model={model}
        runtime={runtimeState}
        runtimeLoading={runtimeLoading}
        runtimeError={runtimeError}
        onRefresh={onRefresh}
        onAssignTrades={onAssignTrades}
        onOpenTrade={onOpenTrade}
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
  tabHeader: { minHeight: 32, alignItems: "center" },
  body: { gap: 12, paddingBottom: 32, paddingTop: 8 },
  available: { gap: 14 },
  resolverRow: { gap: 6, marginTop: 6 },
  skeleton: { gap: 12 },
  skelBlock: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  offlineBanner: { gap: 8 },
});
