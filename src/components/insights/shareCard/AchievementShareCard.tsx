import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Achievement, TraderLevel } from "../../../analytics/achievements";
import {
  achievementTitleFontSize,
  buildAchievementRewardOverlay,
  type AchievementShareStats,
} from "./achievementHelpers";
import {
  ACHIEVEMENT_EXPORT_HEIGHT,
  ACHIEVEMENT_EXPORT_WIDTH,
  ACHIEVEMENT_GALAXY_TEMPLATE,
  achievementRewardOverlayStyle,
  achievementScaledFont,
  achievementTemplateImageStyle,
} from "./achievementTemplateLayout";

export type { AchievementShareStats };

const TEXT = {
  kicker: "#B8FF00",
  title: "#F7F8FA",
  description: "rgba(247,248,250,0.82)",
  detail: "#E8D4FF",
  shadow: "rgba(0,0,0,0.85)",
};

const KICKER_SIZE = 48;
const DESCRIPTION_SIZE = 34;
const DETAIL_SIZE = 46;
const GAP_KICKER_TITLE = 32;
const GAP_TITLE_DESCRIPTION = 34;
const GAP_DESCRIPTION_DATE = 36;

export function AchievementShareCard({
  item,
  achievement,
  level,
  stats,
  journalStats,
}: {
  item?: Achievement | null;
  achievement?: Achievement | null;
  level?: TraderLevel | null;
  stats?: AchievementShareStats | null;
  journalStats?: AchievementShareStats | null;
  theme?: "dark";
}) {
  void level;
  const reward = achievement ?? item;
  const journal = journalStats ?? stats;
  const copy = buildAchievementRewardOverlay(reward, journal);
  const titleSize = achievementTitleFontSize(copy.title);
  const titleLineHeight = Math.round(titleSize * 1.06);

  return (
    <View style={styles.root} collapsable={false}>
      <Image
        source={ACHIEVEMENT_GALAXY_TEMPLATE}
        style={achievementTemplateImageStyle()}
        resizeMode="stretch"
      />
      <View style={achievementRewardOverlayStyle()} collapsable={false}>
        <View style={styles.textScrim} />
        <View style={styles.textStack}>
          <Text
            style={styles.kicker}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {copy.kicker}
          </Text>
          <Text
            style={[
              styles.title,
              {
                fontSize: achievementScaledFont(titleSize),
                lineHeight: achievementScaledFont(titleLineHeight),
                marginTop: GAP_KICKER_TITLE,
                marginBottom: copy.description ? GAP_TITLE_DESCRIPTION : copy.detail ? GAP_DESCRIPTION_DATE : 0,
              },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {copy.title}
          </Text>
          {copy.description ? (
            <Text
              style={[
                styles.description,
                { marginBottom: copy.detail ? GAP_DESCRIPTION_DATE : 0 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {copy.description}
            </Text>
          ) : null}
          {copy.detail ? (
            <Text
              style={styles.detail}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {copy.detail}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export const ACHIEVEMENT_SHARE_CARD_WIDTH = ACHIEVEMENT_EXPORT_WIDTH;
export const ACHIEVEMENT_SHARE_CARD_HEIGHT = ACHIEVEMENT_EXPORT_HEIGHT;

const styles = StyleSheet.create({
  root: {
    width: ACHIEVEMENT_EXPORT_WIDTH,
    height: ACHIEVEMENT_EXPORT_HEIGHT,
    overflow: "hidden",
    backgroundColor: "#0a0614",
  },
  textScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 28,
  },
  textStack: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    zIndex: 1,
  },
  kicker: {
    color: TEXT.kicker,
    fontSize: achievementScaledFont(KICKER_SIZE),
    fontWeight: "700",
    letterSpacing: 7,
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
    textShadowColor: TEXT.shadow,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  title: {
    color: TEXT.title,
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
    textShadowColor: TEXT.shadow,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  description: {
    color: TEXT.description,
    fontSize: achievementScaledFont(DESCRIPTION_SIZE),
    fontWeight: "500",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
    textShadowColor: TEXT.shadow,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  detail: {
    color: TEXT.detail,
    fontSize: achievementScaledFont(DETAIL_SIZE),
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
    textShadowColor: TEXT.shadow,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
});
