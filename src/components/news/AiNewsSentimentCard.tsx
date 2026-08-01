import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { fetchMarketSentiment, type MarketSentimentResult } from "../../api/marketIntelligence";
import { t } from "../../i18n";
import { AI_DAILY_LIMIT_MESSAGE } from "../../config/monetization";
import { C } from "../../theme/colors";
import { ydlRadius } from "../../ydl/radius";
import { ydlSpace } from "../../ydl/space";
import { ydlTypography } from "../../ydl/typography";
import { ydlTouchTarget } from "../../ydl/interaction";
import { AiAnalysisLoading } from "../ai/AiAnalysisLoading";
import { GlassCard } from "../ui/GlassCard";
import { lightHaptic } from "../ui/haptics";
import { hashLocalAiInput, localAiCacheKey, readLocalAiResponse, writeLocalAiResponse } from "../../utils/localAiResponseCache";
import {
  AiCoachActionLine,
  AiCoachProse,
  AiCoachSectionLabel,
  AiCoachSupport,
} from "../../app/ai/coachRead";

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
    <GlassCard style={styles.card} intensity={22}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.2}>Market read</Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>News Sentiment</Text>
          <Text style={styles.sub} maxFontSizeMultiplier={1.25}>Uses visible headlines.</Text>
        </View>
      </View>

      {result ? (
        <View
          style={styles.result}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Market Sentiment ${result.marketSentiment}. ${result.riskSuggestion}`}
        >
          <AiCoachSectionLabel>Market Sentiment</AiCoachSectionLabel>
          <Text style={styles.bias} maxFontSizeMultiplier={1.35}>{result.marketSentiment}</Text>
          <AiCoachSupport>
            Confidence · {result.confidence} · {result.inputHeadlineCount} headlines
          </AiCoachSupport>
          <AiCoachSectionLabel>Drivers</AiCoachSectionLabel>
          {result.drivers.map((driver) => (
            <AiCoachProse key={driver}>{driver}</AiCoachProse>
          ))}
          {result.symbolBiases.length ? (
            <>
              <AiCoachSectionLabel>Symbol Biases</AiCoachSectionLabel>
              {result.symbolBiases.slice(0, 4).map((item) => (
                <AiCoachSupport key={`${item.symbol}-${item.bias}`}>
                  {item.symbol}: {item.bias} — {item.reason}
                </AiCoachSupport>
              ))}
            </>
          ) : null}
          <AiCoachSectionLabel>Risk Suggestion</AiCoachSectionLabel>
          <AiCoachActionLine>{result.riskSuggestion}</AiCoachActionLine>
          <AiCoachSupport>
            Updated · {new Date(result.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </AiCoachSupport>
          <Text style={styles.disclaimer} maxFontSizeMultiplier={1.25}>{result.disclaimer}</Text>
        </View>
      ) : null}

      {busy ? <AiAnalysisLoading compact style={styles.loadingCard} /> : null}

      <Pressable
        disabled={busy}
        onPress={() => void run()}
        style={[styles.btn, busy && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel={busy ? t("analyzing") : "Analyze Market Sentiment"}
      >
        <Sparkles size={16} color={C.bg} strokeWidth={2.4} />
        <Text style={styles.btnText}>{busy ? t("analyzing") : "Analyze Market Sentiment"}</Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ydlRadius.cardCompact,
    padding: ydlSpace.md,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "transparent",
    gap: ydlSpace.sm,
    marginBottom: ydlSpace.md,
  },
  header: { flexDirection: "row", gap: ydlSpace.sm, alignItems: "flex-start" },
  kicker: {
    ...ydlTypography.label,
    color: C.muted,
    textTransform: "uppercase",
    marginBottom: ydlSpace.xxs,
  },
  title: { ...ydlTypography.headline, color: C.text, fontWeight: "700" },
  sub: { ...ydlTypography.caption, color: C.muted, marginTop: ydlSpace.xxs },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ydlSpace.xs,
    minHeight: ydlTouchTarget.min,
    borderRadius: ydlRadius.pill,
    backgroundColor: C.green,
    paddingVertical: ydlSpace.sm,
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { ...ydlTypography.callout, color: C.bg, fontWeight: "700" },
  loadingCard: { marginBottom: 0 },
  result: { gap: ydlSpace.sm },
  bias: { ...ydlTypography.largeTitle, color: C.text },
  disclaimer: { ...ydlTypography.caption, color: C.muted, marginTop: ydlSpace.xxs },
});
