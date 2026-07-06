import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Achievement, TraderLevel } from "../../../analytics/achievements";
import {
  buildAchievementRewardOverlay,
  type AchievementShareStats,
} from "./achievementHelpers";
import { buildAchievementShareTextLayout } from "./achievementShareTextLayout";
import { resolveAchievementTextTheme } from "./achievementTextTheme";
import {
  ACHIEVEMENT_EXPORT_HEIGHT,
  ACHIEVEMENT_EXPORT_WIDTH,
  ACHIEVEMENT_GALAXY_TEMPLATE,
  achievementRewardOverlayStyle,
  achievementScaledFont,
  achievementTemplateImageStyle,
} from "./achievementTemplateLayout";

export type { AchievementShareStats };

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
  const layout = useMemo(() => buildAchievementShareTextLayout(copy), [copy]);
  const textTheme = useMemo(() => resolveAchievementTextTheme(reward), [reward]);

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
            style={[styles.kicker, { color: textTheme.kicker }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {copy.kicker}
          </Text>
          <View style={styles.titleBlock}>
            {layout.title.lines.map((line, index) => (
              <Text
                key={`title-line-${index}`}
                style={[
                  styles.title,
                  {
                    color: textTheme.title,
                    fontSize: layout.title.fontSize,
                    lineHeight: layout.title.lineHeight,
                    marginTop: index === 0 ? achievementScaledFont(8) : 0,
                  },
                ]}
              >
                {line}
              </Text>
            ))}
          </View>
          {copy.description && layout.description ? (
            <View style={styles.descriptionBlock}>
              {layout.description.lines.map((line, index) => (
                <Text
                  key={`desc-line-${index}`}
                  style={[
                    styles.description,
                    {
                      color: textTheme.description,
                      fontSize: layout.description.fontSize,
                      lineHeight: layout.description.lineHeight,
                      marginTop: index === 0 ? achievementScaledFont(8) : 0,
                    },
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
          {copy.detail && layout.detail ? (
            <Text
              style={[
                styles.detail,
                {
                  color: textTheme.detail,
                  fontSize: layout.detail.fontSize,
                  marginTop: achievementScaledFont(6),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
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
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 20,
  },
  textStack: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: "10%",
    paddingTop: "8%",
    paddingBottom: "10%",
    overflow: "hidden",
    zIndex: 1,
  },
  kicker: {
    fontWeight: "700",
    letterSpacing: achievementScaledFont(2),
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
    fontSize: achievementScaledFont(14),
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleBlock: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  descriptionBlock: {
    width: "100%",
    alignItems: "center",
  },
  description: {
    fontWeight: "500",
    textAlign: "center",
    width: "100%",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  detail: {
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
