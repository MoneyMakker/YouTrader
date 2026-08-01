import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
  onReviewUnassigned: () => void;
  onEditPlan: () => void;
};

/**
 * Today's Trading Plan — execution-facing surface over assignment flow.
 * Does not invent plan limits; shows guidance + entry points until plan payload exists.
 */
export function PropPassTodaysPlan({ model, onReviewUnassigned, onEditPlan }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const empty = model.assignedTradeCount === 0;

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
  },
});
