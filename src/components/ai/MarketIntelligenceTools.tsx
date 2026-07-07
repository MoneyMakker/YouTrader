import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import {
  fetchMarketNarrative,
  fetchNoiseFilter,
  fetchOpportunityScanner,
  fetchPreMarketBrief,
  fetchVolatilityRadar,
  fetchWatchlistRisk,
  fetchWhyMarketMoving,
} from "../../api/marketIntelligence";
import { t } from "../../i18n";
import { AI_DAILY_LIMIT_MESSAGE } from "../../config/monetization";
import { C } from "../../theme/colors";
import { AiAnalysisLoading } from "./AiAnalysisLoading";
import { GlassCard } from "../ui/GlassCard";
import { lightHaptic } from "../ui/haptics";

function ToolCard({
  title,
  subtitle,
  busy,
  onRun,
  children,
}: {
  title: string;
  subtitle: string;
  busy: boolean;
  onRun: () => void;
  children?: React.ReactNode;
}) {
  return (
    <GlassCard compact style={styles.toolCard}>
      <Text style={styles.toolTitle}>{title}</Text>
      <Text style={styles.toolSub}>{subtitle}</Text>
      {children}
      {busy ? <AiAnalysisLoading compact style={styles.toolLoading} /> : null}
      <Pressable disabled={busy} onPress={onRun} style={[styles.toolBtn, busy && styles.toolBtnDisabled]}>
        <Text style={styles.toolBtnText}>{busy ? t("analyzing") : t("generate")}</Text>
      </Pressable>
    </GlassCard>
  );
}

export function MarketIntelligenceTools() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState("NVDA, AAPL, TSLA, AMD");
  const [moveSymbol, setMoveSymbol] = useState("NQ");
  const [narrative, setNarrative] = useState<string[]>([]);
  const [watchlistResult, setWatchlistResult] = useState<{ symbol: string; risk: string; explanation: string }[]>([]);
  const [volatility, setVolatility] = useState<{ level: string; suggestion: string; drivers: string[] } | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [noise, setNoise] = useState<{ title: string; whyItMatters: string }[]>([]);
  const [sectors, setSectors] = useState<{ name: string; direction: string; note: string }[]>([]);
  const [whyMoving, setWhyMoving] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ message?: string }>) => {
    lightHaptic();
    setBusyKey(key);
    try {
      const response = await fn();
      if (response.message?.toLowerCase().includes("limit")) {
        Alert.alert(t("premiumAccess"), AI_DAILY_LIMIT_MESSAGE);
      }
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.headerRow}>
        <Sparkles size={18} color={C.green} strokeWidth={2.2} />
        <Text style={styles.headerTitle}>{t("marketIntelHeader")}</Text>
      </View>
      <Text style={styles.headerSub}>{t("marketIntelSub")}</Text>

      <ToolCard
        title={t("marketNarrative")}
        subtitle={t("marketNarrativeSub")}
        busy={busyKey === "narrative"}
        onRun={() =>
          void run("narrative", async () => {
            const res = await fetchMarketNarrative();
            setNarrative(res.data.bullets);
            return res;
          })
        }
      >
        {narrative.length ? narrative.map((item) => <Text key={item} style={styles.line}>• {item}</Text>) : null}
      </ToolCard>

      <ToolCard
        title={t("watchlistRiskScanner")}
        subtitle={t("watchlistRiskScannerSub")}
        busy={busyKey === "watchlist"}
        onRun={() =>
          void run("watchlist", async () => {
            const res = await fetchWatchlistRisk(watchlist);
            setWatchlistResult(res.data.symbols);
            return res;
          })
        }
      >
        <TextInput
          value={watchlist}
          onChangeText={setWatchlist}
          placeholder={t("watchlistPlaceholder")}
          placeholderTextColor={C.muted}
          style={styles.input}
          autoCapitalize="characters"
        />
        {watchlistResult.map((row) => (
          <Text key={row.symbol} style={styles.line}>{row.symbol} · {row.risk} — {row.explanation}</Text>
        ))}
      </ToolCard>

      <ToolCard
        title={t("marketVolatilityRadar")}
        subtitle={t("marketVolatilityRadarSub")}
        busy={busyKey === "volatility"}
        onRun={() =>
          void run("volatility", async () => {
            const res = await fetchVolatilityRadar();
            setVolatility({ level: res.data.volatility, suggestion: res.data.behaviorSuggestion, drivers: res.data.drivers });
            return res;
          })
        }
      >
        {volatility ? (
          <>
            <Text style={styles.metric}>{t("todaysVolatility")} · {volatility.level}</Text>
            <Text style={styles.line}>{volatility.suggestion}</Text>
          </>
        ) : null}
      </ToolCard>

      <ToolCard
        title={t("preMarketBrief")}
        subtitle={t("preMarketBriefSub")}
        busy={busyKey === "brief"}
        onRun={() =>
          void run("brief", async () => {
            const res = await fetchPreMarketBrief();
            setBrief(`${res.data.mission}\n\n${res.data.riskSuggestion}`);
            return res;
          })
        }
      >
        {brief ? <Text style={styles.line}>{brief}</Text> : null}
      </ToolCard>

      <ToolCard
        title={t("marketNoiseFilter")}
        subtitle={t("marketNoiseFilterSub")}
        busy={busyKey === "noise"}
        onRun={() =>
          void run("noise", async () => {
            const res = await fetchNoiseFilter();
            setNoise(res.data.stories);
            return res;
          })
        }
      >
        {noise.map((story) => (
          <Text key={story.title} style={styles.line}>• {story.title} — {story.whyItMatters}</Text>
        ))}
      </ToolCard>

      <ToolCard
        title={t("aiOpportunityScanner")}
        subtitle={t("aiOpportunityScannerSub")}
        busy={busyKey === "sectors"}
        onRun={() =>
          void run("sectors", async () => {
            const res = await fetchOpportunityScanner();
            setSectors(res.data.sectors);
            return res;
          })
        }
      >
        {sectors.map((sector) => (
          <Text key={sector.name} style={styles.line}>{sector.name} {sector.direction === "Up" ? "↑" : sector.direction === "Down" ? "↓" : "—"} · {sector.note}</Text>
        ))}
      </ToolCard>

      <ToolCard
        title={t("whyMarketMoving")}
        subtitle={t("whyMarketMovingSub")}
        busy={busyKey === "why"}
        onRun={() =>
          void run("why", async () => {
            const res = await fetchWhyMarketMoving(moveSymbol.trim() || "NQ");
            setWhyMoving(res.data.explanation);
            return res;
          })
        }
      >
        <TextInput
          value={moveSymbol}
          onChangeText={setMoveSymbol}
          placeholder="NQ"
          placeholderTextColor={C.muted}
          style={styles.input}
          autoCapitalize="characters"
        />
        {whyMoving ? <Text style={styles.line}>{whyMoving}</Text> : null}
      </ToolCard>

      <Text style={styles.disclaimer}>This is not financial advice. Use alongside your own trading plan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  headerSub: { color: C.sub, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  toolCard: { borderRadius: 20, padding: 14, borderColor: "rgba(176,38,255,0.16)", gap: 8 },
  toolTitle: { color: C.text, fontSize: 15, fontWeight: "900" },
  toolSub: { color: C.sub, fontSize: 12, lineHeight: 17 },
  toolLoading: { marginTop: 2 },
  toolBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: C.purple,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 96,
    alignItems: "center",
  },
  toolBtnDisabled: { opacity: 0.6 },
  toolBtnText: { color: C.text, fontSize: 12, fontWeight: "900" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
  },
  line: { color: C.sub, fontSize: 13, lineHeight: 18 },
  metric: { color: C.green, fontSize: 16, fontWeight: "900" },
  disclaimer: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 8 },
});
