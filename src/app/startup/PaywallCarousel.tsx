/**
 * PaywallCarousel — Premium native iOS subscription plan carousel.
 * Center-snapping horizontal cards with scale/opacity depth, lime accent glow,
 * dynamic CTAs, StoreKit pricing, and trial eligibility integration.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";
import type { PaywallPlanId, PaywallPlanPresentation } from "./paywallPlanCopy";
import { C } from "../../theme/colors";
import { t } from "../../i18n";

type Props = {
  plans: PaywallPlanPresentation[];
  packagesMap: Record<PaywallPlanId, PurchasesPackage | null>;
  selectedPlanId: PaywallPlanId;
  onSelectPlan: (id: PaywallPlanId) => void;
  purchaseBusy: boolean;
  /** Contextual label shown on the CTA while a purchase is in flight. */
  purchaseLabel?: string;
  onContinue: (pkg?: PurchasesPackage | null, planId?: PaywallPlanId) => void;
  onRestore: () => void;
  onRetry: () => void;
  catalogLoading: boolean;
  catalogError: string | null;
  profileSubtitle?: string | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_SPACING = 14;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;
const LIME = "#B8F255";

export function PaywallCarousel({
  plans,
  packagesMap,
  selectedPlanId,
  onSelectPlan,
  purchaseBusy,
  purchaseLabel,
  onContinue,
  onRestore,
  onRetry,
  catalogLoading,
  catalogError,
  profileSubtitle,
}: Props) {
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(() => plans.findIndex((p) => p.id === selectedPlanId));

  useEffect(() => {
    const index = plans.findIndex((plan) => plan.id === selectedPlanId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: index * SNAP_INTERVAL, animated: false });
    }, 60);
    return () => clearTimeout(timer);
  }, [plans, selectedPlanId]);

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    const clamped = Math.max(0, Math.min(plans.length - 1, index));
    if (clamped !== activeIndex && plans[clamped]) {
      setActiveIndex(clamped);
      const nextPlan = plans[clamped];
      if (nextPlan.id !== selectedPlanId) {
        void Haptics.selectionAsync();
        onSelectPlan(nextPlan.id);
      }
    }
  }, [activeIndex, plans, selectedPlanId, onSelectPlan]);

  const fallbackPlan = {
    id: selectedPlanId,
    label: "Pro",
    priceLine: "$12.99 / month",
    periodUnit: "month" as const,
    body: "",
    trialBadge: null,
    valueLines: [],
    badges: [],
    cta: "Continue",
    supporting: "Auto-renews until canceled.",
    trial: { eligibility: "unknown" as const, hasFreeIntro: false, periodLabel: null, introDays: null },
  };
  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) ||
    plans.find((p) => p.id === "yearly") ||
    plans.find((p) => p.id === "monthly") ||
    plans.find((p) => p.id === "weekly") ||
    fallbackPlan;
  const selectedPkg = packagesMap[selectedPlanId];

  return (
    <View style={styles.root}>
      {/* Header identity */}
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandY} maxFontSizeMultiplier={1}>Y</Text>
        </View>
        <Text style={styles.brandWordmark} maxFontSizeMultiplier={1.15}>YOUTRADER PRO</Text>
        <Text style={styles.heading} maxFontSizeMultiplier={1.15}>
          {t("paywall.heading") !== "paywall.heading" ? t("paywall.heading") : "Trade With a System\nYou Can Trust"}
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>
          {profileSubtitle || (t("paywall.subtitle") !== "paywall.subtitle" ? t("paywall.subtitle") : "Journal every futures trade, protect your prop limits, and understand what actually improves your performance.")}
        </Text>
      </View>

      {/* Carousel */}
      {catalogLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={LIME} />
          <Text style={styles.loaderText}>{t("loading") || "Loading plans…"}</Text>
        </View>
      ) : catalogError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>We Couldn’t Load the Plans</Text>
          <Text style={styles.errorBody}>Check your connection and try again. Your onboarding progress is safe.</Text>
          <View style={styles.errorActions}>
            <Pressable onPress={onRetry} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Try Again</Text>
            </Pressable>
            <Pressable onPress={onRestore} style={styles.errorRestore}>
              <Text style={styles.errorRestoreText}>Restore Purchases</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.carouselContainer}>
          {/* Subtle glow behind active card */}
          <View pointerEvents="none" style={styles.cardGlow} />

          <FlatList
            ref={flatListRef}
            data={plans}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={styles.listContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isSelected = item.id === selectedPlanId;
              return (
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onSelectPlan(item.id);
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                  }}
                  style={[
                    styles.card,
                    isSelected ? styles.cardSelected : styles.cardSide,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${item.label} plan, ${item.priceLine}`}
                  testID={`paywall-plan-${item.id}`}
                >
                  {/* Badge */}
                  {item.trialBadge || (item.id === "yearly" && "BEST VALUE") ? (
                    <View style={[styles.badge, item.id === "yearly" ? styles.badgeBest : styles.badgeTrial]}>
                      <Text style={styles.badgeText}>{item.trialBadge || "BEST VALUE"}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.cardTitle} maxFontSizeMultiplier={1.15}>{item.label}</Text>
                  <Text style={styles.cardPrice} maxFontSizeMultiplier={1.15}>{item.priceLine}</Text>

                  {item.id === "yearly" ? (
                    <Text style={styles.cardPerWeek} maxFontSizeMultiplier={1.2}>
                      Billed annually · Best value
                    </Text>
                  ) : (
                    <Text style={styles.cardPerWeek} maxFontSizeMultiplier={1.2}>
                      {item.body}
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />

          {/* Dots */}
          <View style={styles.dots}>
            {plans.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.dot,
                  p.id === selectedPlanId ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Sticky CTA bar */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => onContinue(selectedPkg, selectedPlan.id)}
          disabled={purchaseBusy || catalogLoading}
          style={({ pressed }) => [
            styles.ctaButton,
            (purchaseBusy || catalogLoading) && styles.ctaDisabled,
            pressed && styles.ctaPressed,
          ]}
          testID="paywall-continue-cta"
          accessibilityRole="button"
          accessibilityLabel={selectedPlan.cta}
        >
          {purchaseBusy ? (
            <View style={styles.ctaBusyRow}>
              <ActivityIndicator size="small" color="#05070A" />
              {purchaseLabel ? (
                <Text style={styles.ctaLabel} maxFontSizeMultiplier={1.15}>{purchaseLabel}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.ctaLabel} maxFontSizeMultiplier={1.15}>{selectedPlan.cta}</Text>
          )}
        </Pressable>

        <Text style={styles.disclosure} maxFontSizeMultiplier={1.2}>
          {selectedPlan.supporting}
        </Text>

        <View style={styles.footerLinks}>
          <Pressable onPress={onRestore} testID="paywall-restore">
            <Text style={styles.footerLinkText}>Restore Purchases</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable onPress={() => void Linking.openURL("https://youtrader.app/terms")}>
            <Text style={styles.footerLinkText}>Terms</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable onPress={() => void Linking.openURL("https://youtrader.app/privacy")}>
            <Text style={styles.footerLinkText}>Privacy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06080C",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(184,242,85,0.3)",
    backgroundColor: "rgba(184,242,85,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandY: { color: LIME, fontSize: 18, fontWeight: "900" },
  brandWordmark: { color: C.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  heading: { color: C.text, fontSize: 27, lineHeight: 32, fontWeight: "800", textAlign: "center" },
  subtitle: { color: C.sub, fontSize: 13, lineHeight: 18, textAlign: "center", maxWidth: 310 },

  carouselContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    position: "relative",
  },
  cardGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(184,242,85,0.07)",
  },
  listContent: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    gap: CARD_SPACING,
    alignItems: "center",
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    padding: 22,
    justifyContent: "space-between",
    backgroundColor: "#0D1117",
    borderWidth: 1,
  },
  cardSelected: {
    height: 235,
    borderColor: "rgba(184,242,85,0.55)",
    backgroundColor: "#111721",
    ...Platform.select({
      ios: {
        shadowColor: LIME,
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  cardSide: {
    height: 205,
    borderColor: "rgba(255,255,255,0.10)",
    opacity: 0.72,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeBest: { borderColor: "rgba(184,242,85,0.4)", backgroundColor: "rgba(184,242,85,0.12)" },
  badgeTrial: { borderColor: "rgba(139,124,255,0.4)", backgroundColor: "rgba(139,124,255,0.12)" },
  badgeText: { color: LIME, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  cardPrice: { color: C.text, fontSize: 24, fontWeight: "900", marginVertical: 2 },
  cardPerWeek: { color: C.sub, fontSize: 12, fontWeight: "600" },

  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 14 },
  dot: { height: 5, borderRadius: 2.5 },
  dotActive: { width: 18, backgroundColor: LIME },
  dotInactive: { width: 5, backgroundColor: "rgba(255,255,255,0.2)" },

  loaderWrap: { height: 220, alignItems: "center", justifyContent: "center", gap: 10 },
  loaderText: { color: C.sub, fontSize: 14, fontWeight: "600" },

  errorCard: { marginHorizontal: 24, padding: 24, borderRadius: 22, backgroundColor: "#0D1117", borderWidth: 1, borderColor: "rgba(255,59,95,0.3)", gap: 12, alignItems: "center" },
  errorTitle: { color: C.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  errorBody: { color: C.sub, fontSize: 13, textAlign: "center", lineHeight: 18 },
  errorActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  errorBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: LIME, alignItems: "center", justifyContent: "center" },
  errorBtnText: { color: "#05070A", fontWeight: "800", fontSize: 14 },
  errorRestore: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  errorRestoreText: { color: C.text, fontWeight: "700", fontSize: 14 },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  ctaButton: {
    height: 56,
    borderRadius: 17,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: "#05070A", fontSize: 16, fontWeight: "800" },
  ctaBusyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disclosure: { color: C.muted, fontSize: 11, lineHeight: 15, textAlign: "center", paddingHorizontal: 8 },
  footerLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 4 },
  footerLinkText: { color: C.sub, fontSize: 12, fontWeight: "700" },
  footerDot: { color: C.muted, fontSize: 12 },
});
