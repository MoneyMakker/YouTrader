import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
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
  currentCareerTier,
  missionRewardLabel,
  nextTierLabel,
  pointsToNextTier,
  rankDisplayTitle,
  tierBandProgressPercent,
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

function SectionLabel({ children, accent }: { children: string; accent?: boolean }) {
  return <Text style={[styles.sectionLabel, accent && styles.sectionLabelAccent]}>{children}</Text>;
}

function CareerRoadmap({ score }: { score: number }) {
  const currentIdx = careerTierIndex(score);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roadmapScroll}>
      <View style={styles.roadmapInner}>
        <View style={styles.roadmapNodesRow}>
          {CAREER_TIERS.map((tier, index) => {
            const done = index < currentIdx;
            const current = index === currentIdx;
            const future = index > currentIdx;
            return (
              <React.Fragment key={tier}>
                {index > 0 ? (
                  <View style={[styles.roadmapConnector, (done || current) && styles.roadmapConnectorDone]} />
                ) : null}
                <View
                  style={[
                    styles.roadmapNode,
                    done && styles.roadmapNodeDone,
                    current && styles.roadmapNodeCurrent,
                    future && styles.roadmapNodeFuture,
                  ]}
                >
                  {done ? (
                    <Text style={styles.roadmapNodeCheck}>✓</Text>
                  ) : (
                    <View style={[styles.roadmapNodeDot, current && styles.roadmapNodeDotCurrent]} />
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <View style={styles.roadmapLabelsRow}>
          {CAREER_TIERS.map((tier, index) => (
            <Text
              key={tier}
              style={[
                styles.roadmapLabel,
                index < currentIdx && styles.roadmapLabelDone,
                index === currentIdx && styles.roadmapLabelCurrent,
                index > currentIdx && styles.roadmapLabelFuture,
              ]}
              numberOfLines={1}
            >
              {careerTierLabel(tier)}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

export function TraderStatusDashboard({ achievements, level, trades, selectedDate, isPremium, session, shareStats }: Props) {
  void trades;
  void selectedDate;
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
  const tierBandPct = tierBandProgressPercent(level.score);
  const activeTier = currentCareerTier(level.score);

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
          <SectionLabel accent>{t("currentMissions")}</SectionLabel>
          <View style={styles.compactList}>
            {missions.map((item) => {
              const pct = Math.max(0, Math.min(100, (item.progress / Math.max(1, item.target)) * 100));
              const nearComplete = pct >= 80;
              return (
                <GlassCard
                  key={item.id}
                  compact
                  style={[styles.missionCard, nearComplete && styles.missionCardHot]}
                >
                  <Text style={styles.missionEyebrow}>{t("nextTarget")}</Text>
                  <Text style={styles.missionTitle}>{item.title}</Text>
                  <Text style={styles.missionDesc}>{item.condition}</Text>
                  <View style={styles.missionProgressRow}>
                    <View style={styles.missionTrack}>
                      <View style={[styles.missionFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.missionPct}>{Math.round(pct)}%</Text>
                  </View>
                  <Text style={styles.missionProgressLabel}>{item.progressLabel}</Text>
                  <View style={styles.rewardBox}>
                    <Text style={styles.rewardIcon}>🏆</Text>
                    <View style={styles.rewardCopy}>
                      <Text style={styles.rewardHeading}>{t("rewardHeading")}</Text>
                      <Text style={styles.rewardValue}>{missionRewardLabel(item.id)}</Text>
                    </View>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.milestoneScroll}
          >
            {recent.map((item) => (
              <View key={item.id} style={styles.milestoneChip}>
                <View style={styles.milestoneChipTop}>
                  <View style={styles.milestoneCheck}>
                    <Text style={styles.milestoneCheckText}>✔</Text>
                  </View>
                  <Text style={styles.milestoneEarned}>{t("earnedVerified")}</Text>
                </View>
                <Text style={styles.milestoneTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionLabel>{t("careerProgress")}</SectionLabel>
      <GlassCard style={styles.careerCard} intensity={42}>
        <View style={styles.careerHeader}>
          <View style={styles.careerHeaderCopy}>
            <Text style={styles.careerEyebrow}>{t("currentRank")}</Text>
            <Text style={styles.careerRank}>{careerTierLabel(activeTier)}</Text>
          </View>
          <View style={styles.careerScoreBlock}>
            <Text style={styles.careerScore}>{level.score}</Text>
            <Text style={styles.careerScoreLabel}>{t("tradingScore")}</Text>
          </View>
        </View>

        <View style={styles.careerBandRow}>
          <View style={styles.careerBandTrack}>
            <View style={[styles.careerBandFill, { width: `${tierBandPct}%` }]} />
          </View>
          <Text style={styles.careerBandPct}>{t("tierProgressPercent", { percent: tierBandPct })}</Text>
        </View>

        <CareerRoadmap score={level.score} />

        {nextTier && pointsLeft > 0 ? (
          <View style={styles.careerNext}>
            <Text style={styles.careerNextLabel}>{t("nextRank")}</Text>
            <Text style={styles.careerNextTier}>{nextTier}</Text>
            <Text style={styles.careerNextMeta}>{t("tradingScorePointsRemaining", { points: pointsLeft })}</Text>
          </View>
        ) : (
          <Text style={styles.careerMaxed}>{careerTierLabel(CAREER_TIERS[careerIdx])}</Text>
        )}
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
    marginTop: 20,
    marginBottom: 12,
  },
  sectionLabelAccent: {
    color: C.green,
    fontSize: 13,
    letterSpacing: 1.3,
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
  careerCard: {
    borderRadius: 24,
    padding: 18,
    borderColor: "rgba(163,255,18,0.14)",
    backgroundColor: "rgba(163,255,18,0.03)",
    gap: 16,
  },
  careerHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  careerHeaderCopy: { flex: 1, minWidth: 0, gap: 4 },
  careerEyebrow: { color: C.sub, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  careerRank: {
    color: C.green,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.4,
    textShadowColor: "rgba(163,255,18,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  careerScoreBlock: { alignItems: "flex-end" },
  careerScore: { color: C.text, fontSize: 34, fontWeight: "900", lineHeight: 36 },
  careerScoreLabel: { color: C.sub, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 },
  careerBandRow: { gap: 8 },
  careerBandTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  careerBandFill: { height: 8, borderRadius: 999, backgroundColor: C.green },
  careerBandPct: { color: C.green, fontSize: 13, fontWeight: "800" },
  roadmapScroll: { paddingVertical: 4 },
  roadmapInner: { minWidth: 520, paddingHorizontal: 2 },
  roadmapNodesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roadmapConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 2,
    borderRadius: 999,
  },
  roadmapConnectorDone: { backgroundColor: "rgba(163,255,18,0.55)" },
  roadmapNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  roadmapNodeDone: {
    borderColor: "rgba(163,255,18,0.55)",
    backgroundColor: "rgba(163,255,18,0.12)",
  },
  roadmapNodeCurrent: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: C.green,
    backgroundColor: "rgba(163,255,18,0.18)",
    shadowColor: C.green,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  roadmapNodeFuture: { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" },
  roadmapNodeCheck: { color: C.green, fontSize: 11, fontWeight: "900" },
  roadmapNodeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  roadmapNodeDotCurrent: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  roadmapLabelsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 4 },
  roadmapLabel: { width: 68, fontSize: 9, fontWeight: "700", textAlign: "center", color: C.muted },
  roadmapLabelDone: { color: C.green, fontWeight: "800" },
  roadmapLabelCurrent: { color: C.green, fontWeight: "900", fontSize: 10 },
  roadmapLabelFuture: { color: C.sub },
  careerNext: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 14,
    gap: 4,
  },
  careerNextLabel: { color: C.sub, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  careerNextTier: { color: C.text, fontSize: 18, fontWeight: "900" },
  careerNextMeta: { color: C.green, fontSize: 14, fontWeight: "800", marginTop: 2 },
  careerMaxed: { color: C.green, fontSize: 14, fontWeight: "800", textAlign: "center" },
  compactList: { gap: 12 },
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
  missionCard: {
    borderRadius: 22,
    padding: 16,
    borderColor: "rgba(176,38,255,0.18)",
    backgroundColor: "rgba(176,38,255,0.03)",
    gap: 10,
  },
  missionCardHot: {
    borderColor: "rgba(163,255,18,0.35)",
    backgroundColor: "rgba(163,255,18,0.04)",
    shadowColor: C.green,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  missionEyebrow: { color: C.purple, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  missionTitle: { color: C.text, fontSize: 19, fontWeight: "900", lineHeight: 24, letterSpacing: -0.3 },
  missionDesc: { color: C.sub, fontSize: 13, lineHeight: 19 },
  missionProgressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  missionTrack: {
    flex: 1,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  missionFill: { height: 9, borderRadius: 999, backgroundColor: C.green },
  missionPct: { color: C.green, fontSize: 15, fontWeight: "900", minWidth: 42, textAlign: "right" },
  missionProgressLabel: { color: C.text, fontSize: 14, fontWeight: "800" },
  rewardBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  rewardIcon: { fontSize: 22 },
  rewardCopy: { flex: 1, gap: 2 },
  rewardHeading: { color: C.sub, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  rewardValue: { color: C.green, fontSize: 15, fontWeight: "900" },
  milestoneScroll: { gap: 10, paddingRight: 4 },
  milestoneChip: {
    width: 168,
    minHeight: 88,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.28)",
    backgroundColor: "rgba(163,255,18,0.06)",
    shadowColor: C.green,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 10,
  },
  milestoneChipTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  milestoneCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,255,18,0.16)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.35)",
  },
  milestoneCheckText: { color: C.green, fontSize: 11, fontWeight: "900" },
  milestoneEarned: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  milestoneTitle: { color: C.text, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  empty: { color: C.sub, fontSize: 13, marginTop: 8 },
  limitNote: { color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 16 },
});
