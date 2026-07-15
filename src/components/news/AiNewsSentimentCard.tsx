import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { fetchMarketSentiment, type MarketSentimentResult } from "../../api/marketIntelligence";
import { t } from "../../i18n";
import { AI_DAILY_LIMIT_MESSAGE } from "../../config/monetization";
import { C } from "../../theme/colors";
import { AiAnalysisLoading } from "../ai/AiAnalysisLoading";
import { GlassCard } from "../ui/GlassCard";
import { lightHaptic } from "../ui/haptics";
import { hashLocalAiInput, localAiCacheKey, readLocalAiResponse, writeLocalAiResponse } from "../../utils/localAiResponseCache";

const NEWS_SENTIMENT_CACHE_TTL_MS = 30 * 60 * 1000;

type Props = {
  isPremium: boolean;
  onUpgrade: () => void;
  userId: string | null;
  headlines?: {
    title: string;
    summary?: string;
    source?: string;
    time?: string;
    impact?: string;
    symbols?: string[];
  }[];
};

function hashHeadlines(headlines: NonNullable<Props["headlines"]>) {
  return hashLocalAiInput(headlines.map((item) => ({ title: item.title, source: item.source || "", timestamp: item.time || "" })));
}

export function AiNewsSentimentCard({ isPremium, onUpgrade, userId, headlines = [] }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MarketSentimentResult | null>(null);
  const [lastHash, setLastHash] = useState("");
  const visibleHeadlines = headlines.slice(0, 8);
  const headlineHash = hashHeadlines(visibleHeadlines);

  const run = async () => {
    if (!isPremium) {
      onUpgrade();
      return;
    }
    if (result && lastHash === headlineHash) return;
    lightHaptic();
    setBusy(true);
    try {
      const cacheKey = localAiCacheKey("news-sentiment", userId, headlineHash);
      const cached = await readLocalAiResponse<MarketSentimentResult>(cacheKey);
      if (cached) {
        setResult(cached);
        setLastHash(headlineHash);
        return;
      }
      const response = await fetchMarketSentiment("NQ", visibleHeadlines, headlineHash);
      if (response.message?.includes("limit")) {
        Alert.alert(t("premiumAccess"), AI_DAILY_LIMIT_MESSAGE);
        return;
      }
      setResult(response.data);
      setLastHash(headlineHash);
      if (!response.usedFallback) {
        await writeLocalAiResponse(cacheKey, response.data, NEWS_SENTIMENT_CACHE_TTL_MS);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard style={styles.card} intensity={44}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI News Sentiment</Text>
          <Text style={styles.sub}>Uses visible headlines.</Text>
        </View>
      </View>

      {result ? (
        <View style={styles.result}>
          <Text style={styles.sectionLabel}>Market Sentiment</Text>
          <Text style={styles.bias}>{result.marketSentiment}</Text>
          <Text style={styles.meta}>Confidence · {result.confidence} · {result.inputHeadlineCount} headlines</Text>
          <Text style={styles.sectionLabel}>Drivers</Text>
          {result.drivers.map((driver) => (
            <Text key={driver} style={styles.driver}>• {driver}</Text>
          ))}
          {result.symbolBiases.length ? (
            <>
              <Text style={styles.sectionLabel}>Symbol Biases</Text>
              {result.symbolBiases.slice(0, 4).map((item) => (
                <Text key={`${item.symbol}-${item.bias}`} style={styles.driver}>• {item.symbol}: {item.bias} — {item.reason}</Text>
              ))}
            </>
          ) : null}
          <Text style={styles.sectionLabel}>Risk Suggestion</Text>
          <Text style={styles.suggestion}>{result.riskSuggestion}</Text>
          <Text style={styles.meta}>Updated · {new Date(result.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
          <Text style={styles.disclaimer}>{result.disclaimer}</Text>
        </View>
      ) : null}

      {busy ? <AiAnalysisLoading compact style={styles.loadingCard} /> : null}

      <Pressable disabled={busy} onPress={() => void run()} style={[styles.btn, busy && styles.btnDisabled]}>
        <Sparkles size={16} color={C.bg} strokeWidth={2.4} />
        <Text style={styles.btnText}>{busy ? t("analyzing") : "Analyze Market Sentiment"}</Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 16, borderColor: "rgba(176,38,255,0.2)", gap: 10, marginBottom: 12 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { color: C.text, fontSize: 18, fontWeight: "900" },
  sub: { color: C.sub, fontSize: 11, lineHeight: 15, marginTop: 2 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: C.green,
    paddingVertical: 14,
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: C.bg, fontSize: 14, fontWeight: "900" },
  loadingCard: { marginBottom: 0 },
  result: { gap: 6 },
  sectionLabel: { color: C.sub, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 6 },
  bias: { color: C.green, fontSize: 28, fontWeight: "900" },
  meta: { color: C.text, fontSize: 13, fontWeight: "700" },
  driver: { color: C.sub, fontSize: 13, lineHeight: 18 },
  suggestion: { color: C.text, fontSize: 14, lineHeight: 20 },
  disclaimer: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
