import React from "react";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlText } from "../../ydl/components/YdlText";
import type { PropPassViewModel } from "../types";

export function PropPassDecisionReplay({
  model,
  onOpenTrade,
}: {
  model: PropPassViewModel;
  onOpenTrade?: (tradeId: string) => void;
}) {
  const { t } = useTranslation();
  const breach = model.breachReasons[0];
  if (!breach) {
    return (
      <YdlCard testID="prop-pass-decision-replay">
        <YdlText role="caption" color="text.secondary">
          {t("propPass.replay.none")}
        </YdlText>
      </YdlCard>
    );
  }
  return (
    <YdlCard testID="prop-pass-decision-replay">
      <YdlText role="label">{t("propPass.replay.title")}</YdlText>
      <YdlText role="bodyEmphasized">
        {t("propPass.replay.breach", { rule: breach.code })}
      </YdlText>
      {breach.tradeId && onOpenTrade ? (
        <YdlButton
          label={t("propPass.replay.openTrade")}
          variant="secondary"
          onPress={() => onOpenTrade(breach.tradeId!)}
        />
      ) : null}
    </YdlCard>
  );
}
