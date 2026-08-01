/**
 * Acquisition paywall — final YouTrader 3.0 copy + dynamic plan CTA.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";
import Purchases from "react-native-purchases";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path } from "react-native-svg";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../../ydl/accessibility";
import {
  PREMIUM_PRICE,
  PREMIUM_PRICE_WEEKLY,
  PREMIUM_PRICE_YEARLY,
  YOU_TRADER_MONTHLY_PRODUCT_ID,
  YOU_TRADER_WEEKLY_PRODUCT_ID,
  YOU_TRADER_YEARLY_PRODUCT_ID,
} from "../constants";
import {
  buildPaywallPlanPresentation,
  type PaywallPlanId,
} from "./paywallPlanCopy";

type Props = {
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  onRetryOfferings: () => void;
  onClose?: () => void;
  packageTitle: (pkg: PurchasesPackage) => string;
  packagePrice: (pkg?: PurchasesPackage | null) => string;
};

const LIME = "#B8F255";
const PURPLE = "#8B7CFF";
const RED_SOFT = "#FF4D6D";

const VALUE_CHIPS = [
  "Futures Journal",
  "Prop Pass",
  "Performance Radar",
  "Trading Heatmap",
  "Risk Protection",
] as const;

const LEGAL =
  "Payment will be charged to your Apple ID after purchase confirmation. Free trials automatically convert to the selected paid subscription unless canceled before the trial ends. Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Manage or cancel your subscription in App Store settings.";

function PaywallHeroPreview() {
  const theme = useYdlTheme("dark");
  return (
    <View
      style={[styles.hero, { backgroundColor: theme.colors.surface.card }]}
      testID="paywall-hero-preview"
      accessibilityElementsHidden
    >
      <View style={styles.heroTop}>
        <View style={styles.heroCol}>
          <YdlText role="caption" color="text.secondary">
            Journal
          </YdlText>
          <YdlText role="bodyEmphasized">MES · +$420</YdlText>
          <View style={styles.bufferTrack}>
            <View style={[styles.bufferFill, { width: "78%", backgroundColor: LIME }]} />
          </View>
          <YdlText role="caption" style={{ color: PURPLE }}>
            Daily Risk Protected
          </YdlText>
        </View>
        <Svg width={140} height={86} viewBox="0 0 140 86">
          <Path
            d="M6 62 C22 58, 30 44, 44 48 C58 52, 68 30, 84 26 C100 22, 114 36, 134 20"
            stroke={LIME}
            strokeWidth={2.4}
            fill="none"
          />
          <Path
            d="M6 54 C26 60, 42 66, 60 50 C78 34, 100 42, 134 32"
            stroke={RED_SOFT}
            strokeWidth={1.4}
            fill="none"
            opacity={0.4}
          />
        </Svg>
      </View>
      <View style={styles.heroBottom}>
        <Svg width={70} height={54} viewBox="0 0 70 54">
          <Circle cx="35" cy="27" r="20" stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
          <Path
            d="M35 8 L54 21 L48 44 L22 44 L16 21 Z"
            fill="rgba(184,242,85,0.16)"
            stroke={LIME}
            strokeWidth={1.3}
          />
        </Svg>
        <View style={styles.heatRow}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: i === 5 ? LIME : `rgba(139,124,255,${0.14 + (i % 4) * 0.11})`,
              }}
            />
          ))}
        </View>
        <YdlText role="caption" color="text.secondary" style={{ flex: 1 }}>
          Radar · Heatmap · Prop Pass
        </YdlText>
      </View>
    </View>
  );
}

export function AcquisitionPaywall({
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  onPurchase,
  onRestore,
  onRetryOfferings,
  onClose,
  packageTitle,
  packagePrice,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PaywallPlanId>("yearly");
  const purchaseLock = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // Sticky CTA (primary + supporting ± restore) must not cover plan cards.
  const stickyReserve =
    132 + (showRestorePurchases || !!paywallError ? 56 : 0) + Math.max(insets.bottom, 10);

  const weekly =
    packages.find((pkg) => packageTitle(pkg) === "WEEKLY") ||
    packages.find((pkg) => pkg.product.identifier === YOU_TRADER_WEEKLY_PRODUCT_ID) ||
    null;
  const monthly =
    packages.find((pkg) => packageTitle(pkg) === "MONTHLY") ||
    packages.find((pkg) => pkg.product.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) ||
    null;
  const yearly =
    packages.find((pkg) => packageTitle(pkg) === "YEARLY") ||
    packages.find((pkg) => pkg.product.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) ||
    null;

  const weeklyProduct =
    weekly?.product || storeProducts.find((p) => p.identifier === YOU_TRADER_WEEKLY_PRODUCT_ID) || null;
  const monthlyProduct =
    monthly?.product || storeProducts.find((p) => p.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null;
  const yearlyProduct =
    yearly?.product || storeProducts.find((p) => p.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) || null;

  const offeringsUnavailable =
    !weekly && !monthly && !yearly && !weeklyProduct && !monthlyProduct && !yearlyProduct;

  const [eligibilityByProductId, setEligibilityByProductId] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [weeklyProduct?.identifier, monthlyProduct?.identifier, yearlyProduct?.identifier].filter(
      (id): id is string => !!id,
    );
    if (!ids.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const [productId, info] of Object.entries(result || {})) {
          const status = (info as { status?: string | number })?.status;
          next[productId] = status == null ? "UNKNOWN" : String(status);
        }
        setEligibilityByProductId(next);
      } catch {
        if (!cancelled) setEligibilityByProductId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weeklyProduct?.identifier, monthlyProduct?.identifier, yearlyProduct?.identifier]);

  const weeklyPriceString = weekly
    ? packagePrice(weekly)
    : weeklyProduct?.priceString || PREMIUM_PRICE_WEEKLY.replace("/wk", "") || "$4.99";
  const monthlyPriceString = monthly
    ? packagePrice(monthly)
    : monthlyProduct?.priceString || PREMIUM_PRICE;

  const plans = useMemo(() => {
    const rows: Array<{
      presentation: ReturnType<typeof buildPaywallPlanPresentation>;
      productId: string;
      pkg: PurchasesPackage | null;
      emphasis: "low" | "mid" | "high";
    }> = [];
    if (weekly || weeklyProduct) {
      rows.push({
        presentation: buildPaywallPlanPresentation({
          id: "weekly",
          priceString: weeklyPriceString,
          product: weeklyProduct,
          eligibilityStatus: weeklyProduct?.identifier
            ? eligibilityByProductId[weeklyProduct.identifier]
            : undefined,
        }),
        productId: YOU_TRADER_WEEKLY_PRODUCT_ID,
        pkg: weekly,
        emphasis: "low",
      });
    }
    if (monthly || monthlyProduct) {
      rows.push({
        presentation: buildPaywallPlanPresentation({
          id: "monthly",
          priceString: monthlyPriceString,
          product: monthlyProduct,
          eligibilityStatus: monthlyProduct?.identifier
            ? eligibilityByProductId[monthlyProduct.identifier]
            : undefined,
        }),
        productId: YOU_TRADER_MONTHLY_PRODUCT_ID,
        pkg: monthly,
        emphasis: "mid",
      });
    }
    if (yearly || yearlyProduct) {
      rows.push({
        presentation: buildPaywallPlanPresentation({
          id: "yearly",
          priceString: yearly ? packagePrice(yearly) : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY,
          product: yearlyProduct,
          weeklyPriceString,
          eligibilityStatus: yearlyProduct?.identifier
            ? eligibilityByProductId[yearlyProduct.identifier]
            : undefined,
        }),
        productId: YOU_TRADER_YEARLY_PRODUCT_ID,
        pkg: yearly,
        emphasis: "high",
      });
    }
    return rows;
  }, [
    weekly,
    monthly,
    yearly,
    weeklyProduct,
    monthlyProduct,
    yearlyProduct,
    weeklyPriceString,
    monthlyPriceString,
    packagePrice,
    eligibilityByProductId,
  ]);

  useEffect(() => {
    if (offeringsUnavailable || !plans.length) return;
    const hasSelected = plans.some((p) => p.presentation.id === selected);
    if (!hasSelected) {
      const yearlyResolved = plans.find((p) => p.presentation.id === "yearly" && p.pkg);
      setSelected(yearlyResolved?.presentation.id || plans.find((p) => p.pkg)?.presentation.id || plans[0].presentation.id);
    }
  }, [plans, selected, offeringsUnavailable]);

  useEffect(() => {
    if (offeringsUnavailable || !plans.length) return;
    const timer = setTimeout(() => {
      if (selected === "yearly") {
        scrollRef.current?.scrollToEnd({ animated: false });
      } else if (selected === "weekly") {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [selected, plans.length, offeringsUnavailable]);

  const active = plans.find((p) => p.presentation.id === selected) || plans[0] || null;
  const canPurchase = !!active?.pkg && !purchaseBusy;

  const selectPlan = (id: PaywallPlanId) => {
    setSelected(id);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const handlePurchase = () => {
    if (!active?.pkg || purchaseBusy || purchaseLock.current) return;
    purchaseLock.current = true;
    try {
      onPurchase(active.pkg, active.productId);
    } finally {
      setTimeout(() => {
        purchaseLock.current = false;
      }, 800);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }} testID="acquisition-paywall">
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: stickyReserve }]}
        keyboardShouldPersistTaps="handled"
        testID="paywall-scroll"
      >
        {onClose ? (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <YdlText role="body" color="text.secondary">
              ×
            </YdlText>
          </Pressable>
        ) : (
          <View style={styles.close} />
        )}

        <PaywallHeroPreview />

        <YdlText role="title" testID="paywall-headline">
          Build a Trading System You Can Actually Trust
        </YdlText>
        <YdlText role="body" color="text.secondary">
          Track every futures trade, protect your prop challenge limits, and understand exactly which
          decisions improve or hurt your performance.
        </YdlText>

        <View style={styles.chipRow}>
          {VALUE_CHIPS.map((line) => (
            <View key={line} style={[styles.chip, { backgroundColor: theme.colors.surface.card }]}>
              <YdlText role="caption">{line}</YdlText>
            </View>
          ))}
        </View>

        {offeringsUnavailable ? (
          <View
            style={[styles.inlineError, { backgroundColor: theme.colors.surface.card }]}
            testID="paywall-offerings-unavailable"
          >
            <YdlText role="bodyEmphasized">Plans are temporarily unavailable</YdlText>
            <YdlText role="body" color="text.secondary">
              We couldn’t load the latest App Store subscription options. Check your connection and try
              again.
            </YdlText>
            <YdlButton label="Try Again" onPress={onRetryOfferings} disabled={purchaseBusy} />
            <YdlButton
              label={t("restorePurchases")}
              variant="secondary"
              onPress={onRestore}
              disabled={purchaseBusy}
              testID="paywall-restore"
            />
          </View>
        ) : (
          <View style={styles.plans} testID="paywall-plan-list">
            {plans.map((row) => {
              const plan = row.presentation;
              const activePlan = plan.id === (active?.presentation.id || selected);
              const borderColor =
                activePlan
                  ? theme.colors.action.primary
                  : row.emphasis === "high"
                    ? "rgba(184,242,85,0.35)"
                    : "rgba(255,255,255,0.08)";
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => selectPlan(plan.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activePlan }}
                  accessibilityLabel={`${plan.label} ${plan.priceLine}${activePlan ? ", selected" : ""}`}
                  testID={`paywall-plan-${plan.id}`}
                  style={[
                    styles.plan,
                    row.emphasis === "high" ? styles.planHigh : null,
                    {
                      minHeight: YDL_MIN_TOUCH_TARGET + 36,
                      backgroundColor: activePlan
                        ? "rgba(184,242,85,0.09)"
                        : row.emphasis === "high"
                          ? "rgba(139,124,255,0.08)"
                          : theme.colors.surface.card,
                      borderColor,
                      opacity: 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.check,
                      {
                        borderColor: activePlan ? theme.colors.action.primary : "rgba(255,255,255,0.25)",
                        backgroundColor: activePlan ? theme.colors.action.primary : "transparent",
                      },
                    ]}
                  >
                    {activePlan ? (
                      <YdlText role="caption" style={{ color: theme.colors.action.primaryText }}>
                        ✓
                      </YdlText>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.planLabelRow}>
                      <YdlText role="bodyEmphasized">{plan.label}</YdlText>
                      {plan.badges.map((badge) => (
                        <View
                          key={badge}
                          style={[
                            styles.badge,
                            {
                              backgroundColor: badge.startsWith("SAVE")
                                ? "rgba(184,242,85,0.16)"
                                : "rgba(139,124,255,0.2)",
                            },
                          ]}
                        >
                          <YdlText
                            role="caption"
                            style={{ color: badge.startsWith("SAVE") ? LIME : "#D6CFFF" }}
                          >
                            {badge}
                          </YdlText>
                        </View>
                      ))}
                    </View>
                    {plan.trialBadge ? (
                      <YdlText role="caption" style={{ color: LIME }} testID={`paywall-trial-badge-${plan.id}`}>
                        {plan.trialBadge}
                      </YdlText>
                    ) : null}
                    <YdlText role="title">{plan.priceLine}</YdlText>
                    <YdlText role="caption" color="text.secondary">
                      {plan.body}
                    </YdlText>
                    {plan.valueLines
                      .filter((line) => line !== plan.body)
                      .slice(0, 2)
                      .map((line) => (
                        <YdlText key={line} role="caption" color="text.secondary">
                          {line}
                        </YdlText>
                      ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {paywallError && !offeringsUnavailable ? (
          <YdlText role="caption" color="text.secondary" testID="paywall-inline-error">
            {paywallError}
          </YdlText>
        ) : null}

        <View style={styles.legalLinks}>
          <Pressable
            onPress={() => void Linking.openURL("https://youtrader.app/privacy")}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
            style={styles.legalLink}
          >
            <YdlText role="caption" color="text.tertiary">
              Privacy Policy
            </YdlText>
          </Pressable>
          <YdlText role="caption" color="text.tertiary">
            ·
          </YdlText>
          <Pressable
            onPress={() => void Linking.openURL("https://youtrader.app/terms")}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use"
            style={styles.legalLink}
          >
            <YdlText role="caption" color="text.tertiary">
              Terms of Use
            </YdlText>
          </Pressable>
        </View>

        <YdlText role="caption" color="text.tertiary" testID="paywall-legal-disclosure">
          {LEGAL}
        </YdlText>
      </ScrollView>

      {!offeringsUnavailable && active ? (
        <View
          style={[
            styles.stickyCta,
            {
              backgroundColor: theme.colors.background.primary,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          testID="paywall-sticky-cta"
        >
          <YdlButton
            label={purchaseBusy ? t("connecting") : active.presentation.cta}
            onPress={handlePurchase}
            disabled={!canPurchase}
            testID="paywall-primary-cta"
          />
          <YdlText
            role="caption"
            color="text.secondary"
            style={{ textAlign: "center" }}
            testID="paywall-cta-supporting"
          >
            {active.presentation.supporting}
          </YdlText>
          {(showRestorePurchases || !!paywallError) && (
            <YdlButton
              label={purchaseBusy ? t("checking") : t("restorePurchases")}
              variant="secondary"
              onPress={onRestore}
              disabled={purchaseBusy}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12, paddingBottom: 24 },
  close: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  hero: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  heroBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroCol: { flex: 1, gap: 4 },
  heatRow: { flexDirection: "row", flexWrap: "wrap", gap: 3, width: 84 },
  bufferTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 4,
  },
  bufferFill: { height: 8, borderRadius: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  inlineError: { borderRadius: 16, padding: 16, gap: 10 },
  plans: { gap: 10 },
  plan: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  planHigh: { borderWidth: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  planLabelRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  legalLinks: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  legalLink: { minHeight: 44, justifyContent: "center" },
  stickyCta: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
});
