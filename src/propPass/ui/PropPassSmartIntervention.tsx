import React from "react";
import { useTranslation } from "react-i18next";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import type { BufferViewModel, PropPassViewModel } from "../types";

const RISK_BUFFERS: Array<keyof PropPassViewModel["buffers"]> = [
  "dailyLoss",
  "trailingDrawdown",
  "totalLoss",
];

export function PropPassSmartIntervention({ model }: { model: PropPassViewModel }) {
  const { t } = useTranslation();
  const buffer = RISK_BUFFERS.map((key) => model.buffers[key]).find(isRiskBuffer);
  const breached = model.challenge.status === "active" && model.breachReasons.length > 0;
  if (!buffer && !breached) return null;

  const action =
    buffer?.id === "daily_loss"
      ? t("propPass.intervention.dailyLossAction")
      : buffer
        ? t("propPass.intervention.drawdownAction")
        : t("propPass.intervention.breachAction");
  return (
    <YdlCard testID="prop-pass-risk-alert">
      <YdlText role="label">{t("propPass.intervention.title")}</YdlText>
      <YdlText role="bodyEmphasized">{t("propPass.intervention.riskAlert")}</YdlText>
      <YdlText role="body" color="text.secondary">{action}</YdlText>
    </YdlCard>
  );
}

function isRiskBuffer(buffer: BufferViewModel | undefined): buffer is BufferViewModel {
  return buffer?.status === "warn" || buffer?.status === "hard";
}
