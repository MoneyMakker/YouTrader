import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlChip } from "../ydl/components/YdlChip";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme, ydlLayout, ydlSpace, ydlTypographyRoles } from "../ydl/tokens";
import {
  listPropOsInternalTemplates,
  type PropOsRuleTemplate,
} from "../propOs/templates/index";
import type { PropOsCommandState } from "../propOs/commands/types";
import { newPropOsClientRequestId } from "../propOs/commands/hash";
import { runPropPassCommand } from "./commandGateway";
import { trackPropPassEvent } from "./analytics";
import {
  AUTOPILOT_NEEDS_INPUT_FIELDS,
  AUTOPILOT_PERSISTED_FIELDS,
  buildAutopilotRuleSnapshot,
  draftFromTemplate,
  minorToMajorText,
  parseMajorToMinor,
  type AutopilotAccountType,
  type AutopilotRiskMode,
  type AutopilotRuleDraft,
} from "./challengeAutopilotSetup";

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type FlowState = "editing" | "submitting" | "success" | "error";
type Props = {
  userId: string;
  onCompleted: (accountId: string) => void;
  onCancel: () => void;
};

const STEP_KEYS = [
  "accountType",
  "accountDetails",
  "objective",
  "lossRules",
  "tradingLimits",
  "payout",
  "riskMode",
  "review",
] as const;

export function PropPassOnboardingFlow({ userId, onCompleted, onCancel }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const templates = useMemo(() => listPropOsInternalTemplates(), []);
  const firstTemplate = templates[0]!;
  const firstSize = firstTemplate.supportedAccountSizesMinor[0]!;
  const initialDraft = draftFromTemplate(firstTemplate, firstSize)!;
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [flowState, setFlowState] = useState<FlowState>("editing");
  const [accountType, setAccountType] = useState<AutopilotAccountType>("challenge");
  const [label, setLabel] = useState("");
  const [accountSize, setAccountSize] = useState(minorToMajorText(firstSize));
  const [template, setTemplate] = useState<PropOsRuleTemplate>(firstTemplate);
  const [ruleDraft, setRuleDraft] = useState<AutopilotRuleDraft>(initialDraft);
  const [preferredInstrument, setPreferredInstrument] = useState("");
  const [consistency, setConsistency] = useState("");
  const [allowedSession, setAllowedSession] = useState("");
  const [stopAfterLosses, setStopAfterLosses] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [payoutThreshold, setPayoutThreshold] = useState("");
  const [payoutMinimumDays, setPayoutMinimumDays] = useState("");
  const [reserve, setReserve] = useState("");
  const [riskMode, setRiskMode] = useState<AutopilotRiskMode>("balanced");
  const [commandState, setCommandState] = useState<PropOsCommandState<unknown>>({ kind: "idle" });
  const [accountId, setAccountId] = useState<string | null>(null);
  const firstInputRef = useRef<TextInput>(null);
  const requestIds = useRef({
    account: newPropOsClientRequestId(),
    challenge: newPropOsClientRequestId(),
  });

  useEffect(() => {
    trackPropPassEvent("prop_pass_onboarding_opened", { userId });
  }, [userId]);

  useEffect(() => {
    if (flowState !== "editing") return;
    void AccessibilityInfo.announceForAccessibility(
      t("propPass.autopilot.stepAnnouncement", {
        current: wizardStep + 1,
        total: STEP_KEYS.length,
        title: t(`propPass.autopilot.step.${STEP_KEYS[wizardStep]}`),
      }),
    );
  }, [flowState, t, wizardStep]);

  const updateRule = <K extends keyof AutopilotRuleDraft>(
    key: K,
    value: AutopilotRuleDraft[K],
  ) => setRuleDraft((current) => ({ ...current, [key]: value }));

  const selectTemplate = (next: PropOsRuleTemplate) => {
    const currentSize = parseMajorToMinor(accountSize);
    const supportedSize =
      currentSize != null && next.supportedAccountSizesMinor.includes(currentSize)
        ? currentSize
        : next.supportedAccountSizesMinor[0]!;
    const nextDraft = draftFromTemplate(next, supportedSize);
    if (!nextDraft) return;
    setTemplate(next);
    setAccountSize(minorToMajorText(supportedSize));
    setRuleDraft(nextDraft);
    trackPropPassEvent("prop_pass_template_selected", { userId, kind: next.templateId });
  };

  const validationKey = (): string | null => {
    if (wizardStep === 1 && !label.trim()) return "propPass.autopilot.error.name";
    if (wizardStep === 1 && parseMajorToMinor(accountSize) == null) {
      return "propPass.autopilot.error.balance";
    }
    if (wizardStep >= 2) {
      const result = buildAutopilotRuleSnapshot({ template, accountSize, draft: ruleDraft });
      if (!result.ok) return "propPass.autopilot.error.rules";
    }
    return null;
  };

  const next = () => {
    const errorKey = validationKey();
    if (errorKey) {
      void AccessibilityInfo.announceForAccessibility(t(errorKey));
      firstInputRef.current?.focus();
      return;
    }
    setWizardStep((Math.min(7, wizardStep + 1)) as WizardStep);
  };

  async function submit() {
    const built = buildAutopilotRuleSnapshot({ template, accountSize, draft: ruleDraft });
    if (!built.ok || !label.trim() || accountType === "live") {
      void AccessibilityInfo.announceForAccessibility(t("propPass.autopilot.error.rules"));
      return;
    }
    setFlowState("submitting");
    setCommandState({ kind: "submitting" });
    const phase = accountType === "challenge" ? "evaluation" : "funded";
    const accRes = await runPropPassCommand(
      requestIds.current.account,
      userId,
      (svc) =>
        svc.createPropAccount({
          clientRequestId: requestIds.current.account,
          label: label.trim(),
          firmKey: template.firmKey,
          accountSizeMinor: built.accountSizeMinor,
          currency: template.currency,
          firmTimezone: built.ruleSnapshot.firmTimezone,
          phaseHint: phase,
        }),
      "prop_pass_account_create_succeeded",
    );
    if (accRes.kind !== "success") {
      setCommandState(accRes);
      setFlowState("error");
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
          templateId: template.templateId,
          templateVersion: template.version,
          ruleSnapshot: built.ruleSnapshot,
          phase,
        }),
      "prop_pass_challenge_create_succeeded",
    );
    if (chRes.kind !== "success") {
      setCommandState(chRes);
      setFlowState("error");
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
    setFlowState("success");
  }

  if (flowState === "submitting") {
    return <LiveCard text={t("propPass.command.submitting")} />;
  }
  if (flowState === "success" && accountId) {
    return (
      <YdlCard testID="prop-pass-onboarding-success">
        <YdlText role="title">{t("propPass.autopilot.successTitle")}</YdlText>
        <YdlText role="body" color="text.secondary">{t("propPass.autopilot.successBody")}</YdlText>
        <YdlButton label={t("propPass.onboarding.done")} onPress={() => onCompleted(accountId)} />
      </YdlCard>
    );
  }
  if (flowState === "error") {
    return (
      <YdlCard testID="prop-pass-onboarding-error">
        <YdlText role="title">{t("propPass.command.errorTitle")}</YdlText>
        <YdlText role="body">{commandError(commandState, t)}</YdlText>
        <YdlButton label={t("propPass.autopilot.retry")} onPress={() => setFlowState("editing")} />
      </YdlCard>
    );
  }

  return (
    <View style={{ gap: theme.space[12] }} testID="prop-pass-onboarding">
      <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 8, now: wizardStep + 1 }}>
        {STEP_KEYS.map((key, index) => (
          <View
            key={key}
            style={[
              styles.progressSegment,
              {
                backgroundColor:
                  index <= wizardStep
                    ? theme.colors.action.primary
                    : theme.colors.surface.interactive,
                borderRadius: theme.radius.chip,
              },
            ]}
          />
        ))}
      </View>
      <YdlCard>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.autopilot.progress", { current: wizardStep + 1, total: 8 })}
        </YdlText>
        <YdlText role="title">{t(`propPass.autopilot.step.${STEP_KEYS[wizardStep]}`)}</YdlText>
        <YdlText role="body" color="text.secondary">
          {t(`propPass.autopilot.body.${STEP_KEYS[wizardStep]}`)}
        </YdlText>
        <View style={{ gap: theme.space[12] }}>{renderStep()}</View>
      </YdlCard>
      <View style={[styles.navigation, { gap: theme.space[8] }]}>
        {wizardStep > 0 ? (
          <YdlButton
            label={t("propPass.onboarding.back")}
            variant="secondary"
            style={styles.navButton}
            onPress={() => setWizardStep((wizardStep - 1) as WizardStep)}
          />
        ) : (
          <YdlButton label={t("propPass.onboarding.cancel")} variant="tertiary" style={styles.navButton} onPress={onCancel} />
        )}
        {wizardStep < 7 ? (
          <YdlButton label={t("propPass.autopilot.next")} style={styles.navButton} onPress={next} />
        ) : (
          <YdlButton
            label={t("propPass.autopilot.save")}
            disabled={accountType === "live"}
            style={styles.navButton}
            onPress={() => void submit()}
            testID="prop-pass-autopilot-save"
          />
        )}
      </View>
    </View>
  );

  function renderStep() {
    if (wizardStep === 0) {
      return (
        <>
          <ChoiceGroup<AutopilotAccountType>
            values={["challenge", "funded", "live"]}
            selected={accountType}
            label={(value) => t(`propPass.autopilot.accountType.${value}`)}
            onSelect={(value: AutopilotAccountType) => setAccountType(value)}
          />
          {accountType === "live" ? (
            <NeedsInput text={t("propPass.autopilot.liveUnsupported")} />
          ) : null}
        </>
      );
    }
    if (wizardStep === 1) {
      return (
        <>
          <Field ref={firstInputRef} label={t("propPass.autopilot.accountName")} value={label} onChange={setLabel} />
          <Field label={t("propPass.autopilot.startingBalance")} value={accountSize} onChange={setAccountSize} keyboardType="decimal-pad" />
          <Field label={t("propPass.autopilot.timezone")} value={ruleDraft.timezone} onChange={(value) => updateRule("timezone", value)} autoCapitalize="none" />
          <Field label={t("propPass.autopilot.preferredInstrument")} value={preferredInstrument} onChange={setPreferredInstrument} unsupported />
          <YdlText role="label">{t("propPass.autopilot.verifiedTemplate")}</YdlText>
          <View style={styles.wrapRow}>
            {templates.map((item) => (
              <YdlChip
                key={item.templateId}
                label={item.displayName}
                selected={item.templateId === template.templateId}
                onPress={() => selectTemplate(item)}
              />
            ))}
          </View>
        </>
      );
    }
    if (wizardStep === 2) {
      return (
        <>
          <Field ref={firstInputRef} label={t("propPass.autopilot.profitTarget")} value={ruleDraft.profitTarget} onChange={(value) => updateRule("profitTarget", value)} keyboardType="decimal-pad" />
          <Field label={t("propPass.autopilot.minimumDays")} value={ruleDraft.minimumTradingDays} onChange={(value) => updateRule("minimumTradingDays", value)} keyboardType="number-pad" />
          <Field label={t("propPass.autopilot.consistency")} value={consistency} onChange={setConsistency} unsupported />
        </>
      );
    }
    if (wizardStep === 3) {
      return (
        <>
          <Field ref={firstInputRef} label={t("propPass.autopilot.dailyLoss")} value={ruleDraft.dailyLossLimit} onChange={(value) => updateRule("dailyLossLimit", value)} keyboardType="decimal-pad" />
          <Field label={t("propPass.autopilot.maximumLoss")} value={ruleDraft.maximumLossLimit} onChange={(value) => updateRule("maximumLossLimit", value)} keyboardType="decimal-pad" />
          <ChoiceGroup
            values={["static", "trailingEndOfDay", "trailingIntraday"] as const}
            selected={ruleDraft.drawdownKind}
            label={(value) => t(`propPass.autopilot.drawdown.${value}`)}
            onSelect={(value) => updateRule("drawdownKind", value)}
          />
        </>
      );
    }
    if (wizardStep === 4) {
      return (
        <>
          <Field ref={firstInputRef} label={t("propPass.autopilot.allowedSession")} value={allowedSession} onChange={setAllowedSession} unsupported />
          <Field label={t("propPass.autopilot.maximumContracts")} value={ruleDraft.maximumContracts} onChange={(value) => updateRule("maximumContracts", value)} keyboardType="number-pad" optional />
          <Field label={t("propPass.autopilot.stopAfterLosses")} value={stopAfterLosses} onChange={setStopAfterLosses} keyboardType="number-pad" unsupported />
          <Field label={t("propPass.autopilot.cutoff")} value={cutoff} onChange={setCutoff} unsupported />
        </>
      );
    }
    if (wizardStep === 5) {
      return (
        <>
          <Field ref={firstInputRef} label={t("propPass.autopilot.payoutThreshold")} value={payoutThreshold} onChange={setPayoutThreshold} keyboardType="decimal-pad" unsupported />
          <Field label={t("propPass.autopilot.payoutMinimumDays")} value={payoutMinimumDays} onChange={setPayoutMinimumDays} keyboardType="number-pad" unsupported />
          <Field label={t("propPass.autopilot.reserve")} value={reserve} onChange={setReserve} keyboardType="decimal-pad" unsupported />
        </>
      );
    }
    if (wizardStep === 6) {
      return (
        <>
          <ChoiceGroup<AutopilotRiskMode> values={["calm", "balanced", "gambler"]} selected={riskMode} label={(value) => t(`propPass.riskMode.${value}`)} onSelect={(value) => setRiskMode(value)} />
          <NeedsInput text={t("propPass.autopilot.modeNeedsInput")} />
          {riskMode === "gambler" ? <NeedsInput text={t("propPass.autopilot.gamblerWarning")} /> : null}
        </>
      );
    }
    return (
      <>
        <YdlText role="bodyEmphasized">{t("propPass.autopilot.warning")}</YdlText>
        <ReviewRow label={t("propPass.autopilot.accountTypeLabel")} value={t(`propPass.autopilot.accountType.${accountType}`)} />
        <ReviewRow label={t("propPass.autopilot.accountName")} value={label || t("propPass.valueUnavailable")} />
        <ReviewRow label={t("propPass.autopilot.startingBalance")} value={`${accountSize} ${template.currency}`} />
        <ReviewRow label={t("propPass.autopilot.verifiedTemplate")} value={`${template.displayName} · ${template.version}`} />
        <YdlText role="label">{t("propPass.autopilot.willSave")}</YdlText>
        <YdlText role="caption" color="text.secondary">{AUTOPILOT_PERSISTED_FIELDS.map((field) => t(`propPass.autopilot.field.${field}`)).join(" · ")}</YdlText>
        <YdlText role="label">{t("propPass.autopilot.notSaved")}</YdlText>
        <YdlText role="caption" color="text.secondary">{AUTOPILOT_NEEDS_INPUT_FIELDS.map((field) => t(`propPass.autopilot.field.${field}`)).join(" · ")}</YdlText>
        {accountType === "live" ? <NeedsInput text={t("propPass.autopilot.liveSaveBlocked")} /> : null}
      </>
    );
  }
}

function InputField({
  label,
  value,
  onChange,
  keyboardType = "default",
  unsupported = false,
  optional = false,
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  unsupported?: boolean;
  optional?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}, ref: React.ForwardedRef<TextInput>) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  return (
    <View style={{ gap: theme.space[6] }}>
      <View style={styles.fieldLabel}>
        <YdlText role="caption" color="text.secondary">{label}</YdlText>
        {unsupported ? <YdlText role="caption" color="text.secondary">{t("propPass.autopilot.needsInputBadge")}</YdlText> : null}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        placeholder={t(optional ? "propPass.autopilot.optional" : "propPass.autopilot.enterValue")}
        placeholderTextColor={theme.colors.text.secondary}
        returnKeyType="done"
        style={[
          styles.input,
          {
            color: theme.colors.text.primary,
            backgroundColor: theme.colors.surface.interactive,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.control,
            paddingHorizontal: theme.space[12],
            paddingVertical: theme.space[12],
          },
        ]}
      />
    </View>
  );
}
const Field = React.forwardRef(InputField);

function ChoiceGroup<T extends string>({ values, selected, label, onSelect }: {
  values: readonly T[];
  selected: T;
  label: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.wrapRow} accessibilityRole="radiogroup">
      {values.map((value) => (
        <YdlChip key={value} label={label(value)} selected={selected === value} onPress={() => onSelect(value)} />
      ))}
    </View>
  );
}

function NeedsInput({ text }: { text: string }) {
  return <YdlText role="caption" color="text.secondary">{text}</YdlText>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <YdlText role="caption" color="text.secondary">{label}</YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

function LiveCard({ text }: { text: string }) {
  return (
    <View accessibilityLiveRegion="polite">
      <YdlCard><YdlText role="body">{text}</YdlText></YdlCard>
    </View>
  );
}

function commandError(state: PropOsCommandState<unknown>, t: (key: string, options?: Record<string, unknown>) => string) {
  if (state.kind === "validation_error") return t("propPass.command.validationError");
  if (state.kind === "conflict") return t("propPass.command.conflict", { code: state.reasonCode });
  if (state.kind === "forbidden") return t("propPass.command.forbidden");
  return t("propPass.command.unexpected");
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", gap: ydlSpace[4] },
  progressSegment: { flex: 1, height: ydlSpace[4] },
  navigation: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  navButton: { flex: 1 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: ydlLayout.chipGap },
  fieldLabel: { flexDirection: "row", justifyContent: "space-between", gap: ydlSpace[8] },
  input: {
    minHeight: ydlLayout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    ...ydlTypographyRoles.body,
    fontVariant: ["tabular-nums"],
  },
  reviewRow: { gap: ydlSpace[4] },
});
