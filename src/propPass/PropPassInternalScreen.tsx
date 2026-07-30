import React, { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { trackPropPassEvent } from "./analytics";
import { BufferHealthSection } from "./BufferHealthSection";
import { usePropPassAvailability } from "./usePropPassAvailability";
import type { PropPassUiState, PropPassViewModel } from "./types";

type Props = {
  userId: string | null | undefined;
  accountId?: string | null;
  onClose: () => void;
  /** Injected controller for tests — skips hook when provided. */
  uiStateOverride?: PropPassUiState;
  developerMode?: boolean;
};

/**
 * Internal / staging Prop Pass foundation (read-only).
 * Temporary challenge preview selection is non-persistent.
 */
export function PropPassInternalScreen({
  userId,
  accountId,
  onClose,
  uiStateOverride,
  developerMode = typeof __DEV__ !== "undefined" && __DEV__,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme();
  const controller = usePropPassAvailability({ userId, accountId });
  const uiState = uiStateOverride ?? controller.uiState;

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
      <ScrollView contentContainerStyle={styles.body} accessibilityRole="scrollbar">
        {renderState(uiState, t, controller, developerMode)}
      </ScrollView>
    </View>
  );
}

function renderState(
  state: PropPassUiState,
  t: (key: string, opts?: Record<string, unknown>) => string,
  controller: ReturnType<typeof usePropPassAvailability>,
  developerMode: boolean,
): React.ReactNode {
  switch (state.kind) {
    case "disabled":
      return <StateCard title={t("propPass.state.disabled")} body={t("propPass.state.disabledBody")} />;
    case "loading":
      return (
        <StateCard
          title={t("propPass.state.loading")}
          body={t("propPass.state.loadingBody")}
          a11yLive
        />
      );
    case "no_account":
      return <StateCard title={t("propPass.state.noAccount")} body={t("propPass.state.noAccountBody")} />;
    case "no_active_challenge":
      return (
        <StateCard
          title={t("propPass.state.noActiveChallenge")}
          body={t("propPass.state.noActiveChallengeBody")}
        />
      );
    case "challenge_selection_required":
      return (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.state.selectionRequired")}</YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.state.selectionRequiredBody")}
          </YdlText>
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.state.selectionPreviewNote")}
          </YdlText>
          {state.challenges.map((c) => (
            <YdlButton
              key={c.id}
              label={`${c.status} · ${c.id.slice(0, 8)}`}
              variant="secondary"
              onPress={() => controller.selectChallengePreview(c.id)}
            />
          ))}
        </YdlCard>
      );
    case "missing_rule_snapshot":
      return (
        <StateCard
          title={t("propPass.state.missingRule")}
          body={t("propPass.state.missingRuleBody")}
        />
      );
    case "no_shadow_snapshot":
      return (
        <StateCard
          title={t("propPass.state.noShadow")}
          body={t("propPass.state.noShadowBody")}
        />
      );
    case "stale_snapshot":
      return (
        <StateCard
          title={t("propPass.state.stale")}
          body={t("propPass.state.staleBody", {
            reasons: state.reasonCodes.join(", "),
          })}
        />
      );
    case "incomplete_data":
      return (
        <StateCard
          title={t("propPass.state.incomplete")}
          body={t("propPass.state.incompleteBody", {
            reasons: state.reasonCodes.join(", "),
          })}
        />
      );
    case "unsupported":
      return (
        <StateCard
          title={t("propPass.state.unsupported")}
          body={t("propPass.state.unsupportedBody", {
            reasons: state.reasonCodes.join(", "),
          })}
        />
      );
    case "integrity_error":
      return (
        <StateCard
          title={t("propPass.state.integrity")}
          body={t("propPass.state.integrityBody")}
        />
      );
    case "repository_unavailable":
      return (
        <StateCard
          title={t("propPass.state.repository")}
          body={t("propPass.state.repositoryBody")}
          a11yLive
        />
      );
    case "available":
      return <AvailableView model={state.model} t={t} developerMode={developerMode} />;
    default:
      return <StateCard title={t("propPass.state.disabled")} body={t("propPass.state.disabledBody")} />;
  }
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
}: {
  model: PropPassViewModel;
  t: (key: string, opts?: Record<string, unknown>) => string;
  developerMode: boolean;
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
        <YdlText
          role="bodyEmphasized"
          accessibilityLabel={
            model.readiness.lifecycleOverride
              ? t("propPass.readiness.lifecycleOverrideA11y", {
                  status: model.challenge.status,
                })
              : scoreLabel
          }
        >
          {model.readiness.lifecycleOverride
            ? t("propPass.readiness.lifecycleOverride", {
                status: model.challenge.status,
              })
            : scoreLabel}
        </YdlText>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.readiness.confidence", {
            level: model.readiness.confidence,
          })}
        </YdlText>
        {model.readiness.reasonCodes.length ? (
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.readiness.reasons", {
              codes: model.readiness.reasonCodes.slice(0, 6).join(", "),
            })}
          </YdlText>
        ) : null}
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
        {model.dataQuality.limitations.length ? (
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.quality.limitations", {
              items: model.dataQuality.limitations.slice(0, 4).join(", "),
            })}
          </YdlText>
        ) : null}
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
});
