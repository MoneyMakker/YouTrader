import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StatusSpinner } from "../../components/ui/premium";
import {
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  FileText,
  ImagePlus,
  Mic,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react-native";
import type { PatternDetectionResult } from "../../analytics/patternDetector";
import type { TradeAnalysisResult } from "../../api/tradeAnalysis";
import type {
  AIDailyChallenge,
  AIDailyPlan,
  AIJournalSummary,
  AIProviderStatus,
  AIResponse,
  AIRiskPredictor,
  AIWeeklyCoach,
} from "../../api/aiCoach";
import type { AiOperatingSystem } from "../../ai/aiInsightEngine";
import { lightHaptic } from "../../components/ui/haptics";
import { t } from "../../i18n";
import { C } from "../theme";
import { styles } from "../styles";
import type { Trade } from "../types";
import { moneyCompact } from "../utils/format";
import { moodLabel } from "../utils/mood";
import { calcStats } from "../utils/stats";
import { AiIntelligencePulse } from "./animations";
import { AiOsTextBlock, TerminalGlassCard } from "./sharedUi";

export function ProviderBadge({ status }: { status: AIProviderStatus }) {
  const label =
    status === "openrouter"
      ? "OPENROUTER"
      : status === "gemini"
        ? "GEMINI"
        : status === "anthropic"
          ? "CLAUDE"
          : status === "nvidia"
            ? "NVIDIA"
            : status === "quota_exceeded"
              ? "LIMIT"
              : status === "free_preview"
                ? "PREVIEW"
                : "LOCAL";
  const color = ["openrouter", "gemini", "anthropic", "nvidia"].includes(status) ? C.green : status === "quota_exceeded" ? C.yellow : C.purple;
  return (
    <View style={[styles.aiProviderBadge, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[styles.aiProviderBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

export type AIResultMap = {
  dailyPlan: AIResponse<AIDailyPlan> | null;
  riskPredictor: AIResponse<AIRiskPredictor> | null;
  weeklyCoach: AIResponse<AIWeeklyCoach> | null;
  journalSummary: AIResponse<AIJournalSummary> | null;
  dailyChallenge: AIResponse<AIDailyChallenge> | null;
};

export type AiTradingAssistantToolId =
  | "daily_plan"
  | "market_sentiment"
  | "risk_predictor"
  | "journal_summary"
  | "pattern_leaks"
  | "trading_dna"
  | "growth_check"
  | "monthly_review";

export function AiTradingAssistantBlock({
  operatingSystem,
  patterns,
  stats,
  trades,
  tradeAnalysis,
  tradeAnalysisBusy,
  tradeAnalysisError,
  aiResults,
  aiBusy,
  onRunCoachFeature,
  onRunTradeAnalysis,
  onOpenNews,
}: {
  operatingSystem: AiOperatingSystem;
  patterns: PatternDetectionResult;
  stats: ReturnType<typeof calcStats>;
  trades: Trade[];
  tradeAnalysis: TradeAnalysisResult | null;
  tradeAnalysisBusy: boolean;
  tradeAnalysisError: string;
  aiResults: AIResultMap;
  aiBusy: Record<keyof AIResultMap, boolean>;
  onRunCoachFeature: (key: keyof AIResultMap) => void;
  onRunTradeAnalysis: () => void;
  onOpenNews?: () => void;
}) {
  const [activeTool, setActiveTool] = useState<AiTradingAssistantToolId | null>(null);
  const [lastTool, setLastTool] = useState<AiTradingAssistantToolId | null>(null);
  const dna = operatingSystem.tradingDna.profile;
  const growth = operatingSystem.growth.recommendation;
  const tiles: {
    id: AiTradingAssistantToolId;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    title: string;
    summary: string;
    action: string;
    accent: string;
    status: "Review" | "Instant" | "Live";
    busy?: boolean;
    run?: () => void;
  }[] = [
    { id: "pattern_leaks", icon: Target, title: "Review Trade", summary: patterns.risks[0]?.title || "Inspect repeat mistakes", action: tradeAnalysis ? "Open" : "Analyze", accent: "#E95BFF", status: "Review", busy: tradeAnalysisBusy, run: onRunTradeAnalysis },
    { id: "daily_plan", icon: CalendarDays, title: "Plan Today", summary: operatingSystem.today.mission?.title || "Build today's plan", action: aiResults.dailyPlan ? "Open" : "Generate", accent: "#69B7FF", status: "Review", busy: aiBusy.dailyPlan, run: () => onRunCoachFeature("dailyPlan") },
    { id: "risk_predictor", icon: ShieldCheck, title: "Check Risk", summary: "Read behavior and risk pressure", action: aiResults.riskPredictor ? "Open" : "Generate", accent: C.red, status: "Review", busy: aiBusy.riskPredictor, run: () => onRunCoachFeature("riskPredictor") },
    { id: "market_sentiment", icon: Newspaper, title: "Analyze News", summary: "Use currently visible headlines", action: "Open", accent: "#55D8E8", status: "Live" },
    { id: "journal_summary", icon: FileText, title: "Review Journal", summary: "Summarize recent journal patterns", action: aiResults.journalSummary ? "Open" : "Generate", accent: "#FFAD5C", status: "Review", busy: aiBusy.journalSummary, run: () => onRunCoachFeature("journalSummary") },
    { id: "monthly_review", icon: BrainCircuit, title: "Monthly Review", summary: "One premium review moment", action: aiResults.weeklyCoach ? "Open" : "Generate", accent: "#F0C75E", status: "Review", busy: aiBusy.weeklyCoach, run: () => onRunCoachFeature("weeklyCoach") },
    { id: "trading_dna", icon: Sparkles, title: "Trading DNA", summary: dna?.traderType || "Who you are becoming", action: "Show", accent: C.purple, status: "Instant" },
    { id: "growth_check", icon: TrendingUp, title: "Growth", summary: growth?.title || "Compare improvement signals", action: "Show", accent: C.green, status: "Instant" },
  ];

  const openTool = (tool: typeof tiles[number]) => {
    lightHaptic();
    setLastTool(tool.id);
    setActiveTool((prev) => (prev === tool.id ? null : tool.id));
    if (tool.run && !tool.busy && !(
      (tool.id === "daily_plan" && aiResults.dailyPlan) ||
      (tool.id === "risk_predictor" && aiResults.riskPredictor) ||
      (tool.id === "journal_summary" && aiResults.journalSummary) ||
      (tool.id === "monthly_review" && aiResults.weeklyCoach) ||
      (tool.id === "pattern_leaks" && tradeAnalysis)
    )) {
      tool.run();
    }
  };

  const primaryTile = tiles.find((tile) => tile.id === "pattern_leaks")!;
  const secondaryTiles = tiles.filter((tile) => tile.id !== "pattern_leaks");
  const lastOpenedTool = lastTool ? tiles.find((tile) => tile.id === lastTool) || null : null;

  const renderToolTile = (tile: (typeof tiles)[number], primary = false) => {
    const Icon = tile.icon;
    const active = activeTool === tile.id;
    return (
      <Pressable
        key={tile.id}
        onPress={() => openTool(tile)}
        disabled={tile.busy}
        accessibilityRole="button"
        accessibilityLabel={`${tile.title}. ${tile.summary}. ${tile.busy ? "Loading" : tile.action}`}
        accessibilityState={{ selected: active, disabled: !!tile.busy }}
        style={({ pressed }) => [
          styles.analyticsToolTile,
          primary && styles.analyticsToolTilePrimary,
          active && styles.analyticsToolTileActive,
          pressed && styles.analyticsToolTilePressed,
          tile.busy && styles.disabledBtn,
        ]}
      >
        <View style={[styles.analyticsToolTileIcon, primary && { borderColor: C.green, backgroundColor: C.greenSoft }]}>
          {tile.busy ? (
            <StatusSpinner size="sm" color={primary ? C.green : tile.accent} accessibilityLabel="Loading" style={{ marginVertical: 0 }} />
          ) : (
            <Icon size={primary ? 20 : 16} color={active || primary ? C.green : C.sub} strokeWidth={2.3} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {primary ? (
            <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>Start here</Text>
          ) : (
            <Text style={[styles.analyticsToolStatus, { color: C.muted }]} maxFontSizeMultiplier={1.2}>{tile.status}</Text>
          )}
          <Text style={primary ? styles.analyticsToolTileTitlePrimary : styles.analyticsToolTileTitle} maxFontSizeMultiplier={1.25}>
            {tile.title}
          </Text>
          <Text style={styles.analyticsToolTileSummary} numberOfLines={primary ? 2 : 1} maxFontSizeMultiplier={1.2}>
            {tile.summary}
          </Text>
        </View>
        <Text
          style={[
            styles.tradeMetaChip,
            primary || active
              ? { color: C.green, borderColor: C.green, backgroundColor: C.greenSoft }
              : { color: C.muted, borderColor: C.border, backgroundColor: "transparent" },
          ]}
          maxFontSizeMultiplier={1.2}
        >
          {tile.busy ? "..." : tile.action}
        </Text>
      </Pressable>
    );
  };

  const renderActiveResult = () => {
    if (!activeTool) return null;
    if (activeTool === "daily_plan") {
      const result = aiResults.dailyPlan;
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.terminalSmallLabel}>DAILY PLAN</Text>
          {result ? <ProviderBadge status={result.providerStatus} /> : null}
          <Text style={styles.coachCompactValue}>{result?.data.dailyFocus || operatingSystem.today.mission?.title || "Trade only planned setups."}</Text>
          <AiOsTextBlock
            title="Rules"
            items={result?.data.tradeRules || operatingSystem.today.mission?.checklist.map((item) => item.text) || [
              operatingSystem.today.recommendation?.action || "Trade only planned setups.",
            ]}
          />
        </View>
      );
    }
    if (activeTool === "market_sentiment") {
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.terminalSmallLabel}>MARKET SENTIMENT</Text>
          <Text style={styles.coachCompactValue}>Use the News tab to analyze the currently visible headlines.</Text>
          <Text style={styles.coachCompactSub}>This avoids stale generic sentiment and keeps the result tied to real loaded news.</Text>
          {onOpenNews ? (
            <Pressable
              onPress={onOpenNews}
              style={styles.coachPrimaryCta}
              accessibilityRole="button"
              accessibilityLabel={t("openNews")}
            >
              <Text style={styles.coachPrimaryCtaText}>{t("openNews")}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    if (activeTool === "risk_predictor") {
      const result = aiResults.riskPredictor;
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.terminalSmallLabel}>RISK PREDICTOR</Text>
          {result ? <ProviderBadge status={result.providerStatus} /> : null}
          <Text style={styles.coachCompactValue}>{result ? `${result.data.riskLevel.toUpperCase()} · ${result.data.riskScore}/100` : "Generating risk read..."}</Text>
          <AiOsTextBlock title="Warning Signs" items={result?.data.warningSigns || patterns.risks.map((risk) => risk.title)} />
        </View>
      );
    }
    if (activeTool === "journal_summary") {
      const result = aiResults.journalSummary;
      const recentTrade = trades[0] || null;
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.terminalSmallLabel}>JOURNAL SUMMARY</Text>
          {result ? <ProviderBadge status={result.providerStatus} /> : null}
          <Text style={styles.coachCompactValue}>{result?.data.summary || `${stats.count} trades · ${Math.round(stats.wr)}% win rate · ${stats.pf.toFixed(2)} PF`}</Text>
          {recentTrade ? (
            <View style={styles.aiJournalTimeline}>
              <View style={styles.aiJournalTimelineItem}>
                <View style={styles.aiJournalTimelineIcon}><Target size={15} color={C.purple} strokeWidth={2.4} /></View>
                <View style={{ flex: 1 }}><Text style={styles.terminalSmallLabel}>TRADE</Text><Text style={styles.coachCompactValue}>{recentTrade.symbol} · {recentTrade.direction}</Text></View>
              </View>
              {recentTrade.voiceUri || recentTrade.voiceCloudUri ? <View style={styles.aiJournalTimelineItem}><View style={styles.aiJournalTimelineIcon}><Mic size={15} color="#69B7FF" strokeWidth={2.4} /></View><View style={{ flex: 1 }}><Text style={styles.terminalSmallLabel}>VOICE NOTE</Text><Text style={styles.coachCompactSub}>Attached to this trade</Text></View></View> : null}
              {recentTrade.photoUri || recentTrade.photoCloudUri ? <View style={styles.aiJournalTimelineItem}><View style={styles.aiJournalTimelineIcon}><ImagePlus size={15} color="#FFAD5C" strokeWidth={2.4} /></View><View style={{ flex: 1 }}><Text style={styles.terminalSmallLabel}>SCREENSHOT</Text><Text style={styles.coachCompactSub}>Chart evidence attached</Text></View></View> : null}
              <View style={styles.aiJournalTimelineItem}>
                <View style={styles.aiJournalTimelineIcon}><BrainCircuit size={15} color={C.purple} strokeWidth={2.4} /></View>
                <View style={{ flex: 1 }}><Text style={styles.terminalSmallLabel}>EMOTION</Text><Text style={styles.coachCompactSub}>{moodLabel(recentTrade.mood)}</Text></View>
              </View>
              <View style={[styles.aiJournalTimelineItem, styles.aiJournalTimelineLast]}>
                <View style={styles.aiJournalTimelineIcon}><Trophy size={15} color={recentTrade.pnl >= 0 ? C.green : C.red} strokeWidth={2.4} /></View>
                <View style={{ flex: 1 }}><Text style={styles.terminalSmallLabel}>OUTCOME</Text><Text style={[styles.coachCompactValue, { color: recentTrade.pnl >= 0 ? C.green : C.red }]}>{moneyCompact(recentTrade.pnl)}</Text></View>
              </View>
            </View>
          ) : null}
          <AiOsTextBlock title="Improvement Plan" items={result?.data.improvementPlan || [operatingSystem.coach.nextImprovement?.action || "Fix one repeat leak before adding size."]} />
        </View>
      );
    }
    if (activeTool === "pattern_leaks") {
      const blindTitle =
        typeof tradeAnalysis?.mainBlindSpot === "string"
          ? tradeAnalysis.mainBlindSpot
          : tradeAnalysis?.mainBlindSpot?.title || patterns.risks[0]?.title || "No strong leak found yet.";
      const why =
        typeof tradeAnalysis?.mainBlindSpot === "object" && tradeAnalysis?.mainBlindSpot
          ? tradeAnalysis.mainBlindSpot.whyItMatters
          : null;
      const next =
        tradeAnalysis?.nextTradingRule ||
        tradeAnalysis?.recommendations?.[0]?.action ||
        operatingSystem.coach.nextImprovement?.action ||
        null;
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.workflowNextLabel}>REVIEW TRADE</Text>
          {tradeAnalysisBusy ? <StatusSpinner size="sm" accessibilityLabel="Loading" /> : null}
          <Text style={styles.coachCompactValue}>{blindTitle}</Text>
          {why ? <Text style={styles.coachCompactSub}>{why}</Text> : null}
          {next ? (
            <>
              <Text style={styles.workflowNextLabel}>NEXT IMPROVEMENT</Text>
              <Text style={[styles.coachCompactValue, { color: C.green }]}>{next}</Text>
            </>
          ) : null}
          {tradeAnalysisError ? <Text style={styles.coachCompactSub}>{tradeAnalysisError}</Text> : null}
          {!tradeAnalysis ? (
            <AiOsTextBlock title="Mistakes" items={patterns.risks.map((risk) => risk.title)} />
          ) : null}
        </View>
      );
    }
    if (activeTool === "trading_dna") {
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.terminalSmallLabel}>TRADING DNA</Text>
          <Text style={styles.coachCompactValue}>{dna?.traderType || "Not enough journal history yet."}</Text>
          <AiOsTextBlock title="Edge / Weakness" items={[dna?.strengths[0] || "Build more sample size.", dna?.weaknesses[0] || "Keep journaling setup and emotion."]} />
        </View>
      );
    }
    if (activeTool === "growth_check") {
      return (
        <View style={styles.coachConsoleReveal}>
          <Text style={styles.terminalSmallLabel}>GROWTH CHECK</Text>
          <Text style={styles.coachCompactValue}>{growth?.title || operatingSystem.growth.emptyState?.title || "More history needed."}</Text>
          <AiOsTextBlock title="Next Signal" items={[growth?.action || operatingSystem.growth.emptyState?.message || "Keep journaling clean trades."]} />
        </View>
      );
    }
    const result = aiResults.weeklyCoach;
    return (
      <View style={styles.coachConsoleReveal}>
        <Text style={styles.terminalSmallLabel}>MONTHLY REVIEW</Text>
        {result ? <ProviderBadge status={result.providerStatus} /> : null}
        <Text style={styles.coachCompactValue}>{result?.data.summary || "Generate one high-value review instead of reading every metric."}</Text>
        <AiOsTextBlock title="Focus" items={result?.data.nextWeekFocus || [operatingSystem.coach.nextImprovement?.title || "Protect execution quality."]} />
      </View>
    );
  };

  return (
    <TerminalGlassCard style={styles.analyticsToolMenuCard}>
      <View style={styles.assistantHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>Review Hub</Text>
          <Text style={styles.terminalSectionTitle} maxFontSizeMultiplier={1.3}>Trading Assistant</Text>
        </View>
        <AiIntelligencePulse tone={C.muted} />
      </View>
      {renderToolTile(primaryTile, true)}
      <Text style={styles.aiHubSecondaryLabel} maxFontSizeMultiplier={1.2}>More coaching tools</Text>
      <View style={styles.analyticsToolGrid}>
        {secondaryTiles.map((tile) => renderToolTile(tile, false))}
      </View>
      {!activeTool && lastOpenedTool ? (
        <Pressable
          onPress={() => openTool(lastOpenedTool)}
          style={styles.aiMemoryStrip}
          accessibilityRole="button"
          accessibilityLabel={`Continue ${lastOpenedTool.title}`}
        >
          <View style={[styles.analyticsToolTileIcon, { borderColor: C.border, backgroundColor: C.card2 }]}>
            <BrainCircuit size={17} color={C.sub} strokeWidth={2.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.workflowNextLabel} maxFontSizeMultiplier={1.2}>Continue</Text>
            <Text style={styles.coachCompactValue} maxFontSizeMultiplier={1.25}>{lastOpenedTool.title}</Text>
          </View>
          <ChevronRight size={17} color={C.muted} strokeWidth={2.3} />
        </Pressable>
      ) : null}
      {renderActiveResult()}
    </TerminalGlassCard>
  );
}
