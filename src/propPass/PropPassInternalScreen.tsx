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
import type { ChallengeSummary, PropPassUiState, PropPassViewModel } from "./types";
import type { Trade } from "../app/types";
import {
  createMemoryIntelligenceStore,
  type MemoryIntelligenceStore,
} from "../propOs/intelligence";

type Props = {
  userId: string | null | undefined;
  accountId?: string | null;
  onClose: () => void;
  uiStateOverride?: PropPassUiState;
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
  uiStateOverride,
  developerMode = typeof __DEV__ !== "undefined" && __DEV__,
  trades = [],
  intelligenceStore: intelligenceStoreProp,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme();
  const controller = usePropPassAvailability({ userId, accountId });
  const uiState = uiStateOverride ?? controller.uiState;
  const fallbackIntelligenceStore = useMemo(() => createMemoryIntelligenceStore(), []);
  const intelligenceStore = intelligenceStoreProp ?? fallbackIntelligenceStore;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);

  useEffect(() => {
    trackPropPassEvent("prop_pass_opened", {
      mode: controller.entryVisible ? "internal" : "off",
      userId,
    });
    return () => {
      trackPropPassEvent("prop_pass_internal_preview_closed", { userId });
    };
  }, [controller.entryVisible, userId]);

  return (
    <View
      style={[styles.root, { backgroundColor: theme.colors.background.primary }]}
      testID="prop-pass-internal-screen"
    >
      <View style={styles.header}>
        <YdlText role="title">{t("propPass.title")}</YdlText>
        <YdlButton
          label={t("propPass.close")}
          variant="tertiary"
          onPress={onClose}
        />
      </View>
      <YdlText role="caption" color="text.secondary">
        {t("propPass.internalBanner")}
      </YdlText>
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
            store={intelligenceStore}
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
          renderState(uiState, t, controller, developerMode, {
            onStartOnboarding: () => setShowOnboarding(true),
            onStartAssignment: () => {
              trackPropPassEvent("prop_pass_assignment_flow_opened", { userId });
              setShowAssignment(true);
            },
            onOpenIntelligence: () => setShowIntelligence(true),
            archiveConfirm,
            setArchiveConfirm,
            userId: userId ?? null,
            setCommandMessage,
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
  archiveConfirm: boolean;
  setArchiveConfirm: (v: boolean) => void;
  userId: string | null;
  setCommandMessage: (msg: string | null) => void;
};

function renderState(
  state: PropPassUiState,
  t: (key: string, opts?: Record<string, unknown>) => string,
  controller: ReturnType<typeof usePropPassAvailability>,
  developerMode: boolean,
  actions: Actions,
): React.ReactNode {
  switch (state.kind) {
    case "disabled":
      return <StateCard title={t("propPass.state.disabled")} body={t("propPass.state.disabledBody")} />;
    case "loading":
      return (
        <StateCard title={t("propPass.state.loading")} body={t("propPass.state.loadingBody")} a11yLive />
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
        <StateCard
          title={t("propPass.state.stale")}
          body={t("propPass.state.staleBody", { reasons: state.reasonCodes.join(", ") })}
        />
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
          developerMode={developerMode}
          userId={actions.userId}
          archiveConfirm={actions.archiveConfirm}
          setArchiveConfirm={actions.setArchiveConfirm}
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
            label={`${c.status} · ${c.id.slice(0, 8)}`}
            variant="secondary"
            onPress={() => onPreview(c.id)}
          />
          <YdlButton
            label={t("propPass.resolver.persistSelect", { id: c.id.slice(0, 8) })}
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
  developerMode,
  userId,
  archiveConfirm,
  setArchiveConfirm,
  onArchived,
  onMessage,
  onRefresh,
  onAssignTrades,
  onOpenIntelligence,
}: {
  model: PropPassViewModel;
  t: (key: string, opts?: Record<string, unknown>) => string;
  developerMode: boolean;
  userId: string | null;
  archiveConfirm: boolean;
  setArchiveConfirm: (v: boolean) => void;
  onArchived: () => void;
  onMessage: (msg: string | null) => void;
  onRefresh: () => void;
  onAssignTrades: () => void;
  onOpenIntelligence: () => void;
}) {
  const scoreLabel =
    model.readiness.score == null
      ? t("propPass.readiness.unavailable")
      : t("propPass.readiness.score", { score: model.readiness.score });

  return (
    <View style={styles.available}>
      <YdlCard>
        <YdlText role="bodyEmphasized">{model.account.displayName}</YdlText>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.header.lifecycle", {
            account: model.account.lifecycleStatus,
            challenge: model.challenge.status,
            attempt: model.challenge.attemptNumber,
          })}
        </YdlText>
        {model.account.firmName ? (
          <YdlText role="caption" color="text.tertiary">
            {model.account.firmName}
          </YdlText>
        ) : null}
        <YdlButton
          label={t("propPass.assignment.openCta")}
          onPress={onAssignTrades}
        />
        <YdlButton
          label={t("propPass.intelligence.openCta")}
          variant="secondary"
          onPress={() => {
            trackPropPassEvent("prop_pass_intelligence_opened", { userId });
            onOpenIntelligence();
          }}
        />
        <YdlButton
          label={t("propPass.account.setDefault")}
          variant="secondary"
          onPress={() => {
            if (!userId) return;
            const req = newPropOsClientRequestId();
            void runPropPassCommand(
              req,
              userId,
              (svc) =>
                svc.setDefaultAccount({
                  clientRequestId: req,
                  accountId: model.account.id,
                }),
              "prop_pass_default_account_changed",
            ).then((res) => {
              onMessage(
                res.kind === "success"
                  ? t("propPass.account.defaultSaved")
                  : t("propPass.command.unexpected"),
              );
              onRefresh();
            });
          }}
        />
      </YdlCard>

      <YdlCard>
        <YdlText role="label">{t("propPass.progress.title")}</YdlText>
        <YdlText role="body">
          {model.progress.currentBalance
            ? t("propPass.progress.balance", {
                value: model.progress.currentBalance.minor,
                currency: model.progress.currentBalance.currency,
              })
            : t("propPass.valueUnavailable")}
        </YdlText>
        <YdlText role="caption" color="text.secondary">
          {model.progress.profitTarget
            ? t("propPass.progress.target", {
                value: model.progress.profitTarget.minor,
                currency: model.progress.profitTarget.currency,
              })
            : t("propPass.valueUnavailable")}
        </YdlText>
        <YdlText role="caption" color="text.secondary">
          {model.progress.profitRemaining != null
            ? t("propPass.progress.remaining", {
                value: model.progress.profitRemaining.minor,
                currency: model.progress.profitRemaining.currency,
              })
            : t("propPass.valueUnavailable")}
        </YdlText>
      </YdlCard>

      <YdlCard>
        <BufferHealthSection buffers={model.buffers} />
      </YdlCard>

      <YdlCard>
        <YdlText role="label">{t("propPass.readiness.title")}</YdlText>
        <YdlText role="bodyEmphasized" accessibilityLabel={scoreLabel}>
          {model.readiness.lifecycleOverride
            ? t("propPass.readiness.lifecycleOverride", { status: model.challenge.status })
            : scoreLabel}
        </YdlText>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.readiness.confidence", { level: model.readiness.confidence })}
        </YdlText>
      </YdlCard>

      <YdlCard>
        <YdlText role="label">{t("propPass.quality.title")}</YdlText>
        <YdlText role="body">
          {t("propPass.quality.status", { status: model.dataQuality.status })}
        </YdlText>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.freshness.status", {
            status: model.freshness.status,
            at: model.freshness.calculatedAt ?? "—",
          })}
        </YdlText>
      </YdlCard>

      <YdlCard>
        <YdlText role="label">{t("propPass.archive.title")}</YdlText>
        {!archiveConfirm ? (
          <YdlButton
            label={t("propPass.archive.cta")}
            variant="destructive"
            onPress={() => setArchiveConfirm(true)}
          />
        ) : (
          <View>
            <YdlText role="body" color="text.secondary">
              {t("propPass.archive.confirmBody")}
            </YdlText>
            <YdlButton
              label={t("propPass.archive.confirmCta")}
              variant="destructive"
              onPress={() => {
                if (!userId) return;
                const req = newPropOsClientRequestId();
                void runPropPassCommand(
                  req,
                  userId,
                  (svc) =>
                    svc.archivePropAccount({
                      clientRequestId: req,
                      accountId: model.account.id,
                      confirmActive: true,
                    }),
                  "prop_pass_account_archived",
                ).then((res) => {
                  if (res.kind === "success") onArchived();
                  else onMessage(t("propPass.command.unexpected"));
                  setArchiveConfirm(false);
                });
              }}
            />
            <YdlButton
              label={t("propPass.archive.cancel")}
              variant="tertiary"
              onPress={() => setArchiveConfirm(false)}
            />
          </View>
        )}
      </YdlCard>

      {developerMode ? (
        <YdlCard>
          <YdlText role="label">{t("propPass.diagnostics.title")}</YdlText>
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.diagnostics.body", {
              accountId: model.account.id.slice(0, 8),
              challengeId: model.challenge.id.slice(0, 8),
            })}
          </YdlText>
        </YdlCard>
      ) : null}
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
  available: { gap: 12 },
  resolverRow: { gap: 6, marginTop: 6 },
});
