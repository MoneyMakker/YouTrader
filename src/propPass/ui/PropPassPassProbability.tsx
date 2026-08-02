import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import type { PropPassViewModel } from "../types";

export function PropPassPassProbability({ model }: { model: PropPassViewModel }) {
  const { t } = useTranslation();
  const unavailable =
    model.readiness.score == null ||
    model.assignedTradeCount < 5 ||
    model.readiness.lifecycleOverride;

  return (
    <YdlCard testID="prop-pass-readiness">
      <YdlText role="label">{t("propPass.readiness.cardTitle")}</YdlText>
      {unavailable ? (
        <>
          <YdlText role="bodyEmphasized">{t("propPass.readiness.notEnoughData")}</YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.readiness.needFiveTrades")}
          </YdlText>
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <YdlText role="bodyEmphasized">{t("propPass.readiness.label")}</YdlText>
            <YdlText role="bodyEmphasized">{model.readiness.score}</YdlText>
          </View>
          {model.readinessDelta != null ? (
            <YdlText role="caption" color="text.secondary">
              {t("propPass.readiness.delta", { delta: model.readinessDelta })}
            </YdlText>
          ) : null}
          {model.readinessPrimaryDriver ? (
            <YdlText role="caption" color="text.secondary">
              {t("propPass.readiness.primaryDriver", {
                driver: model.readinessPrimaryDriver.label,
                contribution: model.readinessPrimaryDriver.contribution ?? "—",
              })}
            </YdlText>
          ) : null}
        </>
      )}
    </YdlCard>
  );
}
