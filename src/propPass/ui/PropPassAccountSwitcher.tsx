import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import {
  formatRelativeUpdated,
  humanAccountTitle,
  sanitizeDisplayLabel,
} from "../presentation";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
  onOpenMenu?: () => void;
};

export function PropPassAccountSwitcher({ model, onOpenMenu }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const title = humanAccountTitle(model);
  const updated = formatRelativeUpdated(model.freshness.calculatedAt);
  const firm = sanitizeDisplayLabel(model.account.firmName);

  return (
    <View
      style={[styles.wrap, { borderBottomColor: theme.colors.border.subtle }]}
      accessibilityRole="header"
      accessibilityLabel={`${title}. ${updated ?? ""}`}
      testID="prop-pass-account-switcher"
    >
      <View style={styles.textCol}>
        <YdlText role="bodyEmphasized" numberOfLines={1}>
          {title}
        </YdlText>
        <YdlText role="caption" color="text.secondary">
          {updated ?? t("propPass.freshness.unknown")}
          {firm ? ` · ${firm}` : ""}
        </YdlText>
      </View>
      {onOpenMenu ? (
        <Pressable
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel={t("propPass.account.menuA11y")}
          hitSlop={12}
          style={[styles.menuBtn, { backgroundColor: theme.colors.surface.interactive }]}
          testID="prop-pass-account-menu"
        >
          <YdlText role="caption" color="text.secondary">
            {t("propPass.account.menu")}
          </YdlText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textCol: { flex: 1, gap: 2 },
  menuBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
