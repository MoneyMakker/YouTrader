import React from "react";
import { Text, View } from "react-native";
import { Target } from "lucide-react-native";
import { t } from "../../i18n";
import { AnimatedEntrance } from "../ui/AnimatedEntrance";
import { ydlIconRules } from "../../ydl";
import { C } from "../../app/theme";
import { styles } from "../../app/styles";
import type { TradingRadarAxis } from "./radarAxes";

export function StatsFocusInsight({
  axes,
  isPremium,
}: {
  axes: TradingRadarAxis[];
  isPremium: boolean;
  onUpgrade?: () => void;
}) {
  const strongest = [...axes].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakest = [...axes].sort((a, b) => a.score - b.score)[0] || null;
  const focusA11y = `${t("nextImprovement")}. ${t("weakestArea")}: ${weakest?.label || "—"}. ${weakest?.explanation || ""}. ${t("strengths")}: ${strongest.map((item) => item.label).join(", ")}`;

  if (!isPremium || !weakest) {
    return null;
  }

  return (
    <AnimatedEntrance style={styles.statsFocusCard} distance={8}>
      <View style={styles.statsFocusBody}>
        <View accessible accessibilityRole="header" accessibilityLabel={focusA11y} style={styles.statsFocusHeaderBlock}>
          <View style={styles.statsFocusHeader} importantForAccessibility="no">
            <Target size={ydlIconRules.sizes.md} color={C.purple} strokeWidth={2.2} />
            <Text style={styles.statsFocusKicker} maxFontSizeMultiplier={1.2} importantForAccessibility="no">
              {t("nextImprovement")}
            </Text>
          </View>

          <Text style={styles.statsFocusTitle} maxFontSizeMultiplier={1.3} importantForAccessibility="no">
            {weakest.label}
          </Text>
          <Text style={styles.statsFocusExplanation} maxFontSizeMultiplier={1.25} importantForAccessibility="no">
            {weakest.explanation}
          </Text>
          <Text style={styles.statsFocusMeta} maxFontSizeMultiplier={1.2} importantForAccessibility="no">
            {t("targetPrefix")} {weakest.target}
          </Text>
        </View>

        {strongest.length ? (
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${t("strengths")}: ${strongest.map((item) => item.label).join(", ")}`}
            style={styles.statsFocusStrengthBlock}
          >
            <Text style={styles.statsFocusStrengthLabel} importantForAccessibility="no">
              {t("strengths")}
            </Text>
            <View style={styles.statsFocusChipRow} importantForAccessibility="no">
              {strongest.map((item) => (
                <Text key={item.label} style={styles.statsFocusChip}>
                  {item.label}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </AnimatedEntrance>
  );
}
