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

type Props = {
  isPremium: boolean;
  onUpgrade: () => void;
};

export function AiNewsSentimentCard({ isPremium, onUpgrade }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MarketSentimentResult | null>(null);

  const run = async () => {
    if (!isPremium) {
      onUpgrade();
      return;
    }
    lightHaptic();
    setBusy(true);
    try {
      const response = await fetchMarketSentiment("NQ");
      if (response.message?.includes("limit")) {
        Alert.alert(t("premiumAccess"), AI_DAILY_LIMIT_MESSAGE);
        return;
      }
      setResult(response.data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard style={styles.card} intensity={44}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI News Sentiment Guide</Text>
          <Text style={styles.sub}>Top market-moving headlines summarized for your session.</Text>
        </View>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      {result ? (
        <View style={styles.result}>
          <Text style={styles.sectionLabel}>Market Sentiment</Text>
          <Text style={styles.bias}>
            {result.biasPercent}% {result.overallBias}
          </Text>
          <Text style={styles.meta}>Confidence · {result.confidence}</Text>
          <Text style={styles.sectionLabel}>Drivers</Text>
          {result.drivers.map((driver) => (
            <Text key={driver} style={styles.driver}>• {driver}</Text>
          ))}
          <Text style={styles.sectionLabel}>Risk Suggestion</Text>
          <Text style={styles.suggestion}>{result.riskSuggestion}</Text>
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
  card: { borderRadius: 24, padding: 18, borderColor: "rgba(176,38,255,0.2)", gap: 14, marginBottom: 14 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { color: C.text, fontSize: 18, fontWeight: "900" },
  sub: { color: C.sub, fontSize: 13, lineHeight: 18, marginTop: 4 },
  proBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(163,255,18,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.28)",
  },
  proBadgeText: { color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
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
