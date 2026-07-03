import React from "react";
import { EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";
import { CardTemplateShell, OverlayLabelValue, OverlayValue } from "./CardTemplateShell";
import { CARD_LAYOUT } from "./cardTemplate";
import { formatMetric, money, pnlCompact, traderTier } from "./formatters";

export type TraderShareCardData = {
  periodLabel: string;
  netPnl: number;
  monthPnl?: number;
  winRate: number;
  profitFactor: number;
  avgWinLoss?: number;
  consistency?: number;
  maxDrawdown?: number;
  riskControl?: number;
  bestSession?: string;
  weekPnl?: number;
  trades: number;
  tradingScore?: number;
  dateLabel?: string;
  dailyBuffer?: string;
  propStatus?: string;
};

export function TraderShareCard({ data }: { data: TraderShareCardData }) {
  const hasTrades = data.trades > 0;
  const score = hasTrades && data.tradingScore != null ? Math.round(data.tradingScore) : null;
  const tier = hasTrades ? traderTier(score) : "ROOKIE";
  const monthPnl = data.monthPnl ?? data.netPnl;
  const stats = CARD_LAYOUT.stats;

  return (
    <CardTemplateShell>
      <OverlayValue slot={CARD_LAYOUT.score} value={score != null ? String(score) : "--"} tone="white" size={52} />
      <OverlayValue slot={CARD_LAYOUT.trdLabel} value="TRD" tone="white" size={14} />
      <OverlayValue slot={CARD_LAYOUT.tier} value={tier} tone="purple" size={16} />
      {data.dateLabel ? <OverlayValue slot={CARD_LAYOUT.date} value={data.dateLabel} tone="white" size={11} /> : null}

      {!hasTrades ? (
        <OverlayValue
          slot={CARD_LAYOUT.emptyMessage}
          value="Start logging trades to unlock your trader card"
          tone="white"
          size={16}
          lines={2}
        />
      ) : null}

      <OverlayValue
        slot={stats[0]}
        value={hasTrades ? `${data.winRate.toFixed(0)}%` : "N/A"}
        tone={hasTrades && data.winRate >= 50 ? "green" : "white"}
        size={34}
      />
      <OverlayValue
        slot={stats[1]}
        value={hasTrades ? pnlCompact(monthPnl) : "N/A"}
        tone={hasTrades ? (monthPnl >= 0 ? "green" : "red") : "white"}
        size={30}
      />
      <OverlayValue
        slot={stats[2]}
        value={hasTrades && data.profitFactor ? data.profitFactor.toFixed(2) : "N/A"}
        tone="white"
        size={34}
      />
      <OverlayValue
        slot={stats[3]}
        value={hasTrades && data.avgWinLoss ? data.avgWinLoss.toFixed(2) : "N/A"}
        tone="green"
        size={34}
      />
      <OverlayValue
        slot={stats[4]}
        value={hasTrades && data.consistency != null ? `${data.consistency.toFixed(0)}%` : "N/A"}
        tone="green"
        size={34}
      />
      <OverlayValue
        slot={stats[5]}
        value={hasTrades ? money(data.maxDrawdown || 0, 0) : "N/A"}
        tone={hasTrades && (data.maxDrawdown || 0) < 0 ? "purple" : "green"}
        size={30}
      />
    </CardTemplateShell>
  );
}

export const TRADER_SHARE_CARD_WIDTH = EXPORT_CARD_WIDTH;
export const TRADER_SHARE_CARD_HEIGHT = EXPORT_CARD_HEIGHT;
