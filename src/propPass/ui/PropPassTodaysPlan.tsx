import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import type { PropPassViewModel, PropPassTodaysPlanView } from "../types";

type Props = {
  model: PropPassViewModel;
  plan?: PropPassTodaysPlanView | null;
  onReviewUnassigned: () => void;
  onEditPlan: () => void;
};

/**
 * Today's Trading Plan — execution-facing surface over assignment flow.
 */
export function PropPassTodaysPlan({
  model,
  plan,
  onReviewUnassigned,
  onEditPlan,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const empty = !plan && model.assignedTradeCount === 0;

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.colors.surface.card }]}
      testID="prop-pass-todays-plan"
      accessibilityRole="summary"
      accessibilityLabel={t("propPass.plan.sectionA11y")}
    >
      <YdlText role="label">{t("propPass.plan.title")}</YdlText>
      {empty ? (
        <YdlText role="body" color="text.secondary">
          {t("propPass.plan.emptyBody")}
        </YdlText>
      ) : plan ? (
        <>
          <Metric label={t("propPass.plan.maxTrades")} value={String(plan.maxTrades)} />
          <Metric label={t("propPass.plan.dailyStop")} value={plan.dailyStopDisplay} />
          <Metric label={t("propPass.plan.profitLock")} value={plan.profitLockDisplay} />
          <Metric label={t("propPass.plan.instrument")} value={plan.instrument} />
          <Metric label={t("propPass.plan.session")} value={plan.session} />
          <YdlText role="bodyEmphasized">{t("propPass.plan.focusTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {plan.focus}
          </YdlText>
          <YdlText role="body" color="text.secondary">
            {plan.behavioralRule}
          </YdlText>
        </>
      ) : (
        <>
          <Metric label={t("propPass.plan.assigned")} value={String(model.assignedTradeCount)} />
          <YdlText role="bodyEmphasized">{t("propPass.plan.focusTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.plan.focusBody")}
          </YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.plan.ruleBody")}
          </YdlText>
        </>
      )}
      <YdlButton
        label={t("propPass.plan.reviewUnassigned")}
        onPress={onReviewUnassigned}
        testID="prop-pass-review-unassigned"
      />
      <YdlButton
        label={t("propPass.plan.editPlan")}
        variant="secondary"
        onPress={onEditPlan}
        testID="prop-pass-edit-plan"
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <YdlText role="caption" color="text.secondary">
        {label}
      </YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  metric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 28,
  },
});
