import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { Session } from "@supabase/supabase-js";
import { t } from "../../i18n";
import type { Achievement, TraderLevel } from "../../analytics/achievements";
import { FEATURE_LIMIT_MESSAGES, FREE_LIMITS, PRO_LIMITS } from "../../config/featureLimits";
import { peekShareCardExportAllowed, recordShareCardExportSuccess } from "../../config/usageLimits";
import { C } from "../../theme/colors";
import { GlassCard } from "../ui/GlassCard";
import { lightHaptic } from "../ui/haptics";
import {
  achievementIcon,
  CAREER_TIERS,
  careerTierIndex,
  careerTierLabel,
  missionRewardLabel,
  nextTierLabel,
  pointsToNextTier,
  rankDisplayTitle,
} from "./careerProgress";

type TradeLike = { date?: string; pnl?: number; createdAt?: number };

type Props = {
  achievements: Achievement[];
  level: TraderLevel;
  trades: TradeLike[];
  selectedDate: string;
  isPremium: boolean;
  session: Session | null;
  shareStats: import("../insights/shareCard").AchievementShareStats;
};

const RING_SIZE = 118;
const RING_STROKE = 9;

function ScoreRing({ score, label, topLabel }: { score: number; label: string; topLabel: string }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringGraphic}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFillObject}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={C.green}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference - (circumference * clamped) / 100}
            rotation="-90"
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <View style={styles.ringCenterCol}>
          <Text style={styles.ringScore} maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1}>
            {score}
          </Text>
          <Text style={styles.ringLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.ringTop} maxFontSizeMultiplier={1.2} numberOfLines={1}>
            {topLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function TraderStatusDashboard({ achievements, level, trades, selectedDate, isPremium, session, shareStats }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 560, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [fade]);

  const allUnlocked = useMemo(() => achievements.filter((item) => item.unlocked), [achievements]);
  const freeUnlockLimitReached = !isPremium && allUnlocked.length > 5;
  const unlocked = isPremium ? allUnlocked : allUnlocked.slice(0, 5);
  const missions = useMemo(
    () => achievements.filter((item) => !item.unlocked && (item.status === "next_target" || item.status === "locked")).slice(0, 4),
    [achievements],
  );
  const recent = useMemo(() => unlocked.slice(-3).reverse(), [unlocked]);
  const careerIdx = careerTierIndex(level.score);
  const nextTier = nextTierLabel(level.score);
  const pointsLeft = pointsToNextTier(level.score);

  const exportAchievement = async (item: Achievement, action: "share" | "save") => {
    if (!item.unlocked) return;
    const allowed = await peekShareCardExportAllowed(isPremium, session?.user.id || null);
    if (!allowed.allowed) {
      Alert.alert(t("shareCardLimitReached"), allowed.message || FEATURE_LIMIT_MESSAGES.shareCardMonthlyLimit);
      return;
    }
    try {
      setShareBusy(true);
      const { shareAchievementCardFromData, saveAchievementCardFromDataToPhotos } = await import("../insights/shareExport");
      if (action === "share") await shareAchievementCardFromData(item, shareStats);
      else {
        await saveAchievementCardFromDataToPhotos(item, shareStats);
        Alert.alert(t("savedTitle"), t("achievementCardSaved"));
      }
      await recordShareCardExportSuccess(session?.user.id || null, isPremium);
    } catch {
      Alert.alert(action === "share" ? t("shareFailed") : t("saveFailed"), t("shareCardExportFailed"));
    } finally {
      setShareBusy(false);
    }
  };

  const promptShare = (item: Achievement) => {
    lightHaptic();
    Alert.alert(item.title, t("exportAchievementCard"), [
      { text: t("sharePnlCard"), onPress: () => void exportAchievement(item, "share") },
      { text: t("saveImage"), onPress: () => void exportAchievement(item, "save") },
      { text: t("cancel"), style: "cancel" },
    ]);
  };

  return (
    <Animated.View style={{ opacity: fade, marginTop: 8 }}>
      <GlassCard style={styles.heroCard} intensity={50}>
        <Text style={styles.heroEyebrow}>{t("currentRank")}</Text>
        <Text style={styles.heroRank}>{rankDisplayTitle(level.titleKey)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroPhrase}>{level.phrase}</Text>
            {nextTier && pointsLeft > 0 ? (
              <Text style={styles.heroProgress}>
                {t("progressToTier", { tier: nextTier, points: pointsLeft })}
              </Text>
            ) : null}
          </View>
          <ScoreRing score={level.score} label={t("tradingScore")} topLabel={level.topLabel || t("building")} />
        </View>
      </GlassCard>

      {unlocked.length ? (
        <>
          <SectionLabel>{t("unlockedAchievements")}</SectionLabel>
          <View style={styles.compactList}>
            {unlocked.map((item) => (
              <GlassCard key={item.id} compact style={styles.badgeCard}>
                <View style={styles.badgeTop}>
                  <Text style={styles.badgeIcon}>{achievementIcon(item.category, true)}</Text>
                  <View style={styles.badgeBody}>
                    <Text style={styles.badgeTitle}>{item.title}</Text>
                    <Text style={styles.badgeWhy}>{item.condition}</Text>
                    <Text style={styles.badgeDate}>{t("earnedVerified")}</Text>
                  </View>
                </View>
                <Pressable onPress={() => promptShare(item)} style={styles.shareBtn}>
                  <Text style={styles.shareBtnText}>{t("share")}</Text>
                </Pressable>
              </GlassCard>
            ))}
          </View>
          {freeUnlockLimitReached ? (
            <Text style={styles.limitNote}>
              {t("shareCardLimitNote", { free: FREE_LIMITS.shareCardsPerMonth, pro: PRO_LIMITS.shareCardsPerMonth })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>{t("keepLoggingAchievement")}</Text>
      )}

      {missions.length ? (
        <>
          <SectionLabel>{t("currentMissions")}</SectionLabel>
          <View style={styles.compactList}>
            {missions.map((item) => {
              const pct = Math.max(0, Math.min(100, (item.progress / Math.max(1, item.target)) * 100));
              return (
                <GlassCard key={item.id} compact style={styles.missionCard}>
                  <Text style={styles.missionEyebrow}>{t("nextTarget")}</Text>
                  <Text style={styles.missionTitle}>{item.title}</Text>
                  <Text style={styles.missionDesc}>{item.condition}</Text>
                  <View style={styles.missionTrack}>
                    <View style={[styles.missionFill, { width: `${pct}%` }]} />
                  </View>
                  <View style={styles.missionFooter}>
                    <Text style={styles.missionProgress}>{item.progressLabel}</Text>
                    <Text style={styles.missionReward}>{t("rewardLabel", { label: missionRewardLabel(item.id) })}</Text>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </>
      ) : null}

      {recent.length ? (
        <>
          <SectionLabel>{t("recentMilestones")}</SectionLabel>
          <View style={styles.milestoneRow}>
            {recent.map((item) => (
              <View key={item.id} style={styles.milestonePill}>
                <Text style={styles.milestoneText}>{item.title}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionLabel>{t("careerProgress")}</SectionLabel>
      <GlassCard style={styles.careerCard} intensity={38}>
        <View style={styles.careerTrack}>
          <View style={[styles.careerFill, { width: `${(careerIdx / (CAREER_TIERS.length - 1)) * 100}%` }]} />
        </View>
        <View style={styles.careerLabels}>
          {CAREER_TIERS.map((tier, index) => (
            <Text
              key={tier}
              style={[styles.careerTier, index === careerIdx && styles.careerTierActive, index > careerIdx && styles.careerTierFuture]}
              numberOfLines={1}
            >
              {careerTierLabel(tier)}
            </Text>
          ))}
        </View>
      </GlassCard>

      {shareBusy ? <ActivityIndicator color={C.green} style={{ marginVertical: 10 }} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 10,
  },
  heroCard: {
    borderRadius: 26,
    padding: 20,
    borderColor: "rgba(176,38,255,0.22)",
    backgroundColor: "rgba(176,38,255,0.04)",
  },
  heroEyebrow: { color: C.sub, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  heroRank: { color: C.text, fontSize: 28, fontWeight: "900", marginTop: 8, letterSpacing: -0.5 },
  heroRow: { flexDirection: "row", gap: 14, marginTop: 16, alignItems: "center" },
  heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  heroPhrase: { color: C.sub, fontSize: 14, lineHeight: 20 },
  heroProgress: { color: C.green, fontSize: 13, fontWeight: "800" },
  ringWrap: { flexShrink: 0, alignItems: "center", width: 124 },
  ringGraphic: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenterCol: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    maxWidth: RING_SIZE - RING_STROKE * 2,
    gap: 1,
  },
  ringScore: { color: C.green, fontSize: 30, fontWeight: "900", lineHeight: 32, textAlign: "center" },
  ringLabel: {
    color: C.sub,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  ringTop: { color: C.text, fontSize: 9, fontWeight: "800", textAlign: "center" },
  careerCard: { borderRadius: 22, padding: 16 },
  careerTrack: { height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  careerFill: { height: 6, borderRadius: 999, backgroundColor: C.green },
  careerLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 2 },
  careerTier: { flex: 1, color: C.muted, fontSize: 8, fontWeight: "700", textAlign: "center" },
  careerTierActive: { color: C.green, fontWeight: "900" },
  careerTierFuture: { color: C.sub },
  compactList: { gap: 10 },
  badgeCard: { borderRadius: 20, padding: 14, borderColor: "rgba(163,255,18,0.18)", gap: 12 },
  badgeTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  badgeIcon: { color: C.green, fontSize: 18, fontWeight: "900", width: 24, textAlign: "center" },
  badgeBody: { flex: 1, minWidth: 0, gap: 4 },
  badgeTitle: { color: C.text, fontSize: 15, fontWeight: "900" },
  badgeWhy: { color: C.sub, fontSize: 12, lineHeight: 17 },
  badgeDate: { color: C.muted, fontSize: 11, fontWeight: "700" },
  shareBtn: {
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.35)",
    backgroundColor: "rgba(176,38,255,0.08)",
  },
  shareBtnText: { color: C.purple, fontSize: 12, fontWeight: "900" },
  missionCard: { borderRadius: 20, padding: 14, borderColor: "rgba(176,38,255,0.16)", gap: 8 },
  missionEyebrow: { color: C.purple, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  missionTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  missionDesc: { color: C.sub, fontSize: 12, lineHeight: 17 },
  missionTrack: { height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden", marginTop: 4 },
  missionFill: { height: 5, borderRadius: 999, backgroundColor: C.purple },
  missionFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  missionProgress: { color: C.text, fontSize: 12, fontWeight: "800" },
  missionReward: { color: C.green, fontSize: 11, fontWeight: "800" },
  milestoneRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  milestonePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(163,255,18,0.08)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.16)",
  },
  milestoneText: { color: C.green, fontSize: 11, fontWeight: "800" },
  empty: { color: C.sub, fontSize: 13, marginTop: 8 },
  limitNote: { color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 16 },
});
