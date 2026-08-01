import { t } from "../../i18n";
import { calcStats } from "../../app/utils/stats";

export type TradingRadarAxis = {
  key: string;
  label: string;
  value: string;
  score: number;
  target: string;
  explanation: string;
};

export const RADAR_PRO_ONLY_KEYS = new Set(["consistency", "recovery", "profitFactor"]);

export function buildTradingRadarAxes(
  stats: ReturnType<typeof calcStats>,
  consistency: number,
  recoveryFactor: number,
  drawdownControl: number,
): TradingRadarAxis[] {
  return [
    { key: "winRate", label: t("winRate"), value: `${stats.wr.toFixed(0)}%`, score: Math.min(100, stats.wr), target: "55%+", explanation: t("radarWinRateExpShort") },
    { key: "riskCtrl", label: t("riskCtrl"), value: `${drawdownControl.toFixed(0)}%`, score: drawdownControl, target: "70%+", explanation: t("radarRiskCtrlExp") },
    { key: "consistency", label: t("consistency"), value: `${consistency.toFixed(0)}%`, score: consistency, target: "70%+", explanation: t("radarConsistencyExpShort") },
    { key: "recovery", label: t("recovery"), value: recoveryFactor ? recoveryFactor.toFixed(1) : "—", score: Math.min(100, (recoveryFactor / 4) * 100), target: "3.0+", explanation: t("radarRecoveryExp") },
    { key: "profitFactor", label: t("profitFactor"), value: stats.pf ? stats.pf.toFixed(2) : "—", score: Math.min(100, (stats.pf / 2.5) * 100), target: "1.5+", explanation: t("radarProfitFactorExp") },
    { key: "rewardRisk", label: t("rewardRiskLabel"), value: stats.avgWinLoss ? stats.avgWinLoss.toFixed(2) : "—", score: Math.min(100, (stats.avgWinLoss / 2.5) * 100), target: "1.5+", explanation: t("radarRewardRiskExp") },
  ];
}
