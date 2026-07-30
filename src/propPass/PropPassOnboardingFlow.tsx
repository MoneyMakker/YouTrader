import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, TextInput, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import {
  buildRuleConfirmationSummary,
  listPropOsInternalTemplates,
  type PropOsRuleTemplate,
  type RuleConfirmationSummary,
} from "../propOs/templates/index";
import type { PropOsCommandState } from "../propOs/commands/types";
import { newPropOsClientRequestId } from "../propOs/commands/hash";
import { runPropPassCommand } from "./commandGateway";
import { trackPropPassEvent } from "./analytics";

type Step =
  | "form"
  | "template"
  | "confirm"
  | "submitting"
  | "success"
  | "error";

type Props = {
  userId: string;
  onCompleted: (accountId: string) => void;
  onCancel: () => void;
};

function majorToMinor(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * Internal/staging onboarding: account → template → confirm rules → challenge.
 */
export function PropPassOnboardingFlow({ userId, onCompleted, onCancel }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme();
  const [step, setStep] = useState<Step>("form");
  const [label, setLabel] = useState("");
  const [sizeMajor, setSizeMajor] = useState("50000");
  const [phase, setPhase] = useState<"evaluation" | "funded">("evaluation");
  const [template, setTemplate] = useState<PropOsRuleTemplate | null>(null);
  const [summary, setSummary] = useState<RuleConfirmationSummary | null>(null);
  const [commandState, setCommandState] = useState<PropOsCommandState<unknown>>({
    kind: "idle",
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const labelRef = useRef<TextInput>(null);
  const requestIds = useRef({ account: newPropOsClientRequestId(), challenge: newPropOsClientRequestId() });

  const templates = useMemo(() => listPropOsInternalTemplates(), []);

  useEffect(() => {
    trackPropPassEvent("prop_pass_onboarding_opened", { userId });
  }, [userId]);

  useEffect(() => {
    if (commandState.kind === "validation_error") {
      labelRef.current?.focus();
      void AccessibilityInfo.announceForAccessibility(
        t("propPass.onboarding.validationFocus"),
      );
    }
  }, [commandState, t]);

  async function submitAccountAndChallenge(confirmed: RuleConfirmationSummary) {
    setStep("submitting");
    setCommandState({ kind: "submitting" });

    const sizeMinor = majorToMinor(sizeMajor);
    if (sizeMinor == null) {
      setCommandState({
        kind: "validation_error",
        fieldErrors: { accountSizeMinor: "invalid" },
      });
      setStep("error");
      return;
    }
    if (!label.trim()) {
      setCommandState({
        kind: "validation_error",
        fieldErrors: { label: "required" },
      });
      setStep("error");
      return;
    }

    const accRes = await runPropPassCommand(
      requestIds.current.account,
      userId,
      (svc) =>
        svc.createPropAccount({
          clientRequestId: requestIds.current.account,
          label: label.trim(),
          firmKey: confirmed.ruleSnapshot.firmKey,
          accountSizeMinor: sizeMinor,
          currency: confirmed.currency,
          firmTimezone: confirmed.ruleSnapshot.firmTimezone,
          phaseHint: phase,
        }),
      "prop_pass_account_create_succeeded",
    );

    if (accRes.kind !== "success") {
      trackPropPassEvent("prop_pass_account_create_failed", {
        userId,
        kind: accRes.kind,
      });
      setCommandState(accRes);
      setStep("error");
      requestIds.current.account = newPropOsClientRequestId();
      return;
    }

    const createdAccountId = accRes.value.account.id;
    setAccountId(createdAccountId);

    const chRes = await runPropPassCommand(
      requestIds.current.challenge,
      userId,
      (svc) =>
        svc.createChallengeAttempt({
          clientRequestId: requestIds.current.challenge,
          accountId: createdAccountId,
          templateId: confirmed.templateId,
          templateVersion: confirmed.templateVersion,
          ruleSnapshot: confirmed.ruleSnapshot,
          phase,
        }),
      "prop_pass_challenge_create_succeeded",
    );

    if (chRes.kind !== "success") {
      trackPropPassEvent("prop_pass_challenge_create_failed", {
        userId,
        kind: chRes.kind,
      });
      setCommandState(chRes);
      setStep("error");
      requestIds.current.challenge = newPropOsClientRequestId();
      return;
    }

    await runPropPassCommand(newPropOsClientRequestId(), userId, (svc) =>
      svc.setDefaultAccount({
        clientRequestId: newPropOsClientRequestId(),
        accountId: createdAccountId,
      }),
      "prop_pass_default_account_changed",
    );

    setCommandState({ kind: "success", value: chRes.value });
    setStep("success");
  }

  return (
    <View style={styles.root} testID="prop-pass-onboarding">
      {step === "form" ? (
        <YdlCard>
          <YdlText role="title">{t("propPass.onboarding.title")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.onboarding.body")}
          </YdlText>
          <YdlText role="caption">{t("propPass.onboarding.label")}</YdlText>
          <TextInput
            ref={labelRef}
            value={label}
            onChangeText={setLabel}
            accessibilityLabel={t("propPass.onboarding.label")}
            style={[styles.input, { color: theme.colors.text.primary, borderColor: theme.colors.border.subtle }]}
            testID="prop-pass-onboarding-label"
          />
          <YdlText role="caption">
            {t("propPass.onboarding.accountSize", { currency: "USD" })}
          </YdlText>
          <TextInput
            value={sizeMajor}
            onChangeText={setSizeMajor}
            keyboardType="decimal-pad"
            accessibilityLabel={t("propPass.onboarding.accountSizeA11y", {
              currency: "USD",
            })}
            style={[styles.input, { color: theme.colors.text.primary, borderColor: theme.colors.border.subtle }]}
            testID="prop-pass-onboarding-size"
          />
          <View style={styles.row}>
            <YdlButton
              label={t("propPass.onboarding.phaseEvaluation")}
              variant={phase === "evaluation" ? "primary" : "secondary"}
              onPress={() => setPhase("evaluation")}
            />
            <YdlButton
              label={t("propPass.onboarding.phaseFunded")}
              variant={phase === "funded" ? "primary" : "secondary"}
              onPress={() => setPhase("funded")}
            />
          </View>
          <YdlButton
            label={t("propPass.onboarding.continueTemplates")}
            onPress={() => setStep("template")}
          />
          <YdlButton label={t("propPass.onboarding.cancel")} variant="tertiary" onPress={onCancel} />
        </YdlCard>
      ) : null}

      {step === "template" ? (
        <YdlCard>
          <YdlText role="title">{t("propPass.onboarding.chooseTemplate")}</YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.onboarding.templateCoverageNote")}
          </YdlText>
          {templates.map((tpl) => (
            <YdlButton
              key={tpl.templateId}
              label={`${tpl.displayName} · ${tpl.version}`}
              onPress={() => {
                const sizeMinor = majorToMinor(sizeMajor);
                if (sizeMinor == null) {
                  setCommandState({
                    kind: "validation_error",
                    fieldErrors: { accountSizeMinor: "invalid" },
                  });
                  setStep("error");
                  return;
                }
                try {
                  const conf = buildRuleConfirmationSummary(tpl, sizeMinor);
                  setTemplate(tpl);
                  setSummary(conf);
                  trackPropPassEvent("prop_pass_template_selected", {
                    userId,
                    kind: tpl.templateId,
                  });
                  trackPropPassEvent("prop_pass_rule_confirmation_displayed", {
                    userId,
                    kind: tpl.templateId,
                  });
                  setStep("confirm");
                } catch {
                  setCommandState({
                    kind: "validation_error",
                    fieldErrors: { accountSizeMinor: "unsupported_for_template" },
                  });
                  setStep("error");
                }
              }}
            />
          ))}
          <YdlButton
            label={t("propPass.onboarding.back")}
            variant="tertiary"
            onPress={() => setStep("form")}
          />
        </YdlCard>
      ) : null}

      {step === "confirm" && summary ? (
        <YdlCard testID="prop-pass-rule-confirmation">
          <YdlText role="title">{t("propPass.onboarding.confirmTitle")}</YdlText>
          <YdlText role="body">
            {t("propPass.onboarding.confirmSize", {
              value: summary.accountSizeMinor,
              currency: summary.currency,
            })}
          </YdlText>
          <YdlText role="body">
            {t("propPass.onboarding.confirmTarget", {
              value: summary.profitTargetMinor,
              currency: summary.currency,
            })}
          </YdlText>
          <YdlText role="body">
            {t("propPass.onboarding.confirmDaily", {
              value: summary.dailyLossLimitMinor ?? t("propPass.valueUnavailable"),
              currency: summary.currency,
            })}
          </YdlText>
          <YdlText role="body">
            {t("propPass.onboarding.confirmDrawdown", {
              value: summary.drawdownLimitMinor,
              kind: summary.drawdownKind,
              timing: summary.drawdownTiming,
            })}
          </YdlText>
          <YdlText role="body">
            {t("propPass.onboarding.confirmReset", { value: summary.resetBehavior })}
          </YdlText>
          <YdlText role="body">
            {t("propPass.onboarding.confirmMinDays", {
              value: summary.minimumTradingDays ?? t("propPass.valueUnavailable"),
            })}
          </YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.onboarding.confirmUnsupported", {
              fields: summary.unsupportedFields.join(", ") || "—",
            })}
          </YdlText>
          <YdlText role="caption">
            {t("propPass.onboarding.confirmVersion", {
              id: summary.templateId,
              version: summary.templateVersion,
            })}
          </YdlText>
          <YdlButton
            label={t("propPass.onboarding.confirmCta")}
            onPress={() => void submitAccountAndChallenge(summary)}
          />
          <YdlButton
            label={t("propPass.onboarding.back")}
            variant="tertiary"
            onPress={() => setStep("template")}
          />
        </YdlCard>
      ) : null}

      {step === "submitting" ? (
        <View accessibilityLiveRegion="polite">
          <YdlCard>
            <YdlText role="body">{t("propPass.command.submitting")}</YdlText>
          </YdlCard>
        </View>
      ) : null}

      {step === "success" && accountId ? (
        <YdlCard testID="prop-pass-onboarding-success">
          <YdlText role="title">{t("propPass.onboarding.successTitle")}</YdlText>
          <YdlText role="body">{t("propPass.onboarding.successBody")}</YdlText>
          <YdlButton
            label={t("propPass.onboarding.done")}
            onPress={() => onCompleted(accountId)}
          />
        </YdlCard>
      ) : null}

      {step === "error" ? (
        <YdlCard testID="prop-pass-onboarding-error">
          <YdlText role="title">{t("propPass.command.errorTitle")}</YdlText>
          <YdlText role="body">
            {commandState.kind === "validation_error"
              ? t("propPass.command.validationError")
              : commandState.kind === "conflict"
                ? t("propPass.command.conflict", { code: commandState.reasonCode })
                : commandState.kind === "forbidden"
                  ? t("propPass.command.forbidden")
                  : t("propPass.command.unexpected")}
          </YdlText>
          <YdlButton
            label={t("propPass.onboarding.back")}
            onPress={() => {
              setStep("form");
              setCommandState({ kind: "idle" });
            }}
          />
        </YdlCard>
      ) : null}

      {template ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
});
