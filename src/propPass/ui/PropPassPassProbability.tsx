import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import type { PropPassViewModel } from "../types";
import { mapReadinessLabel } from "../presentation";

export function PropPassPassProbability({ model }: { model: PropPassViewModel }) {
  const { t } = useTranslation();
  const unavailable =
    model.readiness.score == null ||
    model.assignedTradeCount < 5 ||
    model.readiness.lifecycleOverride;
  const band = mapReadinessLabel(model);
  const bandLabel =
    band === "high"
      ? t("propPass.readiness.bandHigh")
      : band === "moderate"
        ? t("propPass.readiness.bandModerate")
        : band === "low"
          ? t("propPass.readiness.bandLow")
          : t("propPass.readiness.notEnoughData");

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
          <YdlText role="bodyEmphasized" testID="prop-pass-readiness-combined">
            {t("propPass.readiness.combined", {
              score: model.readiness.score,
              band: bandLabel,
            })}
          </YdlText>
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
