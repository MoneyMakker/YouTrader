import type { Achievement } from "../../../analytics/achievements";

export type AchievementTextTheme = {
  kicker: string;
  title: string;
  titleShadow: string;
  description: string;
  detail: string;
  accent: string;
};

const THEMES = {
  common: {
    accent: "#B8FF00",
    kicker: "#B8FF00",
    title: "#F2FFE0",
    titleShadow: "rgba(0,0,0,0.55)",
    description: "rgba(210,255,140,0.88)",
    detail: "#C8FF66",
  },
  rare: {
    accent: "#B026FF",
    kicker: "#C084FC",
    title: "#F5EBFF",
    titleShadow: "rgba(0,0,0,0.58)",
    description: "rgba(220,180,255,0.86)",
    detail: "#E8D4FF",
  },
  epic: {
    accent: "#D36BFF",
    kicker: "#E8A0FF",
    title: "#FFF4FD",
    titleShadow: "rgba(0,0,0,0.58)",
    description: "rgba(235,190,255,0.86)",
    detail: "#F0C8FF",
  },
  legendary: {
    accent: "#F4C95D",
    kicker: "#FFD978",
    title: "#FFF8E8",
    titleShadow: "rgba(0,0,0,0.6)",
    description: "rgba(255,228,160,0.88)",
    detail: "#FFE08A",
  },
  risk: {
    accent: "#D36BFF",
    kicker: "#C084FC",
    title: "#F5EBFF",
    titleShadow: "rgba(0,0,0,0.58)",
    description: "rgba(220,180,255,0.86)",
    detail: "#E8D4FF",
  },
  prop: {
    accent: "#6BB8FF",
    kicker: "#8CC8FF",
    title: "#EEF6FF",
    titleShadow: "rgba(0,0,0,0.55)",
    description: "rgba(170,210,255,0.88)",
    detail: "#B8DCFF",
  },
  performance: {
    accent: "#F4C95D",
    kicker: "#FFD978",
    title: "#FFF8E8",
    titleShadow: "rgba(0,0,0,0.6)",
    description: "rgba(255,228,160,0.88)",
    detail: "#FFE08A",
  },
  journal: {
    accent: "#B8FF00",
    kicker: "#B8FF00",
    title: "#F2FFE0",
    titleShadow: "rgba(0,0,0,0.55)",
    description: "rgba(210,255,140,0.88)",
    detail: "#C8FF66",
  },
} as const satisfies Record<string, AchievementTextTheme>;

function titleTier(item: Achievement): keyof typeof THEMES {
  const title = item.title.toLowerCase();
  if (title.includes("apex") || title.includes("$10k") || title.includes("five figure") || title.includes("legend")) {
    return "legendary";
  }
  if (title.includes("elite") || title.includes("risk master") || title.includes("funded")) return "epic";
  if (title.includes("$1k") || title.includes("10 trades") || title.includes("sniper")) return "rare";
  return "common";
}

/** Typography tint derived from badge category / milestone tier — artwork unchanged. */
export function resolveAchievementTextTheme(item?: Achievement | null): AchievementTextTheme {
  if (!item) return THEMES.common;

  const category = item.category?.toLowerCase() ?? "";
  if (category.includes("risk")) return THEMES.risk;
  if (category.includes("prop")) return THEMES.prop;
  if (category.includes("performance")) return THEMES.performance;
  if (category.includes("journal")) return THEMES.journal;

  return THEMES[titleTier(item)];
}
