import React from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { EXPORT_BRAND, EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";
import { CARD_LAYOUT, CARD_TEXT, slotStyle, TRADER_CARD_TEMPLATE, scaledFont, type CardSlot } from "./cardTemplate";

export function CardTemplateShell({
  children,
  showFooter = true,
}: {
  children: React.ReactNode;
  showFooter?: boolean;
}) {
  return (
    <View style={styles.root}>
      <ImageBackground source={TRADER_CARD_TEMPLATE} style={styles.background} resizeMode="stretch" imageStyle={styles.image}>
        <View style={[styles.totsCover, slotStyle(CARD_LAYOUT.totsCover)]}>
          <Text style={styles.brandCover}>YOUTRADER</Text>
        </View>
        {children}
        {showFooter ? (
          <View style={[styles.footer, slotStyle(CARD_LAYOUT.footer)]}>
            <Text style={styles.footerTitle}>{EXPORT_BRAND.appStoreHint}</Text>
            <Text style={styles.footerSub}>{EXPORT_BRAND.disclaimer}</Text>
          </View>
        ) : null}
      </ImageBackground>
    </View>
  );
}

export function OverlayValue({
  slot,
  value,
  tone = "green",
  size = 34,
  lines = 1,
}: {
  slot: CardSlot;
  value: string;
  tone?: "green" | "white" | "purple" | "red" | "gold";
  size?: number;
  lines?: number;
}) {
  const color =
    tone === "white"
      ? CARD_TEXT.white
      : tone === "purple"
        ? CARD_TEXT.purple
        : tone === "red"
          ? CARD_TEXT.red
          : tone === "gold"
            ? CARD_TEXT.gold
            : CARD_TEXT.green;
  return (
    <View style={[styles.slot, slotStyle(slot), slot.align === "right" ? styles.alignRight : slot.align === "left" ? styles.alignLeft : styles.alignCenter]}>
      <Text
        style={[styles.value, { color, fontSize: scaledFont(size) }]}
        numberOfLines={lines}
        adjustsFontSizeToFit
        minimumFontScale={0.45}
      >
        {value}
      </Text>
    </View>
  );
}

export function OverlayLabelValue({
  slot,
  label,
  value,
  tone = "green",
  valueSize = 28,
}: {
  slot: CardSlot;
  label: string;
  value: string;
  tone?: "green" | "white" | "purple" | "red" | "gold";
  valueSize?: number;
}) {
  const color =
    tone === "white"
      ? CARD_TEXT.white
      : tone === "purple"
        ? CARD_TEXT.purple
        : tone === "red"
          ? CARD_TEXT.red
          : tone === "gold"
            ? CARD_TEXT.gold
            : CARD_TEXT.green;
  return (
    <View style={[styles.slot, slotStyle(slot), styles.alignCenter]}>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {label}
      </Text>
      <Text
        style={[styles.value, { color, fontSize: scaledFont(valueSize), marginTop: 2 }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.45}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: EXPORT_CARD_WIDTH,
    height: EXPORT_CARD_HEIGHT,
    backgroundColor: "#030507",
    overflow: "hidden",
  },
  background: {
    width: EXPORT_CARD_WIDTH,
    height: EXPORT_CARD_HEIGHT,
  },
  image: {
    width: EXPORT_CARD_WIDTH,
    height: EXPORT_CARD_HEIGHT,
  },
  totsCover: {
    backgroundColor: "rgba(3,5,7,0.94)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brandCover: {
    color: CARD_TEXT.greenBright,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    fontSize: scaledFont(18),
    textShadowColor: CARD_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  slot: {
    justifyContent: "center",
  },
  alignCenter: { alignItems: "center" },
  alignLeft: { alignItems: "flex-start" },
  alignRight: { alignItems: "flex-end" },
  label: {
    color: CARD_TEXT.white,
    fontSize: scaledFont(11),
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textShadowColor: CARD_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  value: {
    fontWeight: "900",
    textShadowColor: CARD_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  footer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(3,5,7,0.82)",
    borderRadius: 10,
  },
  footerTitle: {
    color: CARD_TEXT.white,
    fontSize: scaledFont(14),
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: CARD_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  footerSub: {
    color: "rgba(247,248,250,0.78)",
    fontSize: scaledFont(10),
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
    textShadowColor: CARD_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
