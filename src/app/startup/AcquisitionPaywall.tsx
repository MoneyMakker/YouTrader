/**
 * Acquisition paywall — three real plans, trial-aware CTA, no fake packages.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path, Rect } from "react-native-svg";
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
import { resolveIntroTrialInfo, yearlySavingsLabel } from "./trialEligibility";

type PlanId = "weekly" | "monthly" | "yearly";

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

function parsePriceNumber(priceString: string): number {
  const n = Number(String(priceString).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

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
          <YdlText role="bodyEmphasized">MES LONG · +$420</YdlText>
          <YdlText role="caption" color="text.secondary">
            Emotion · Focused · Setup · ORB
          </YdlText>
        </View>
        <Svg width={132} height={78} viewBox="0 0 132 78">
          <Path
            d="M4 58 C20 52, 28 40, 42 44 C56 48, 64 28, 78 24 C92 20, 104 34, 128 18"
            stroke={LIME}
            strokeWidth={2.2}
            fill="none"
          />
          <Path
            d="M4 50 C24 56, 40 62, 58 48 C76 34, 96 40, 128 30"
            stroke={RED_SOFT}
            strokeWidth={1.4}
            fill="none"
            opacity={0.45}
          />
        </Svg>
      </View>
      <View style={styles.heroBottom}>
        <Svg width={72} height={56} viewBox="0 0 72 56">
          <Circle cx="36" cy="28" r="22" stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
          <Path
            d="M36 8 L56 22 L50 46 L22 46 L16 22 Z"
            fill="rgba(184,242,85,0.16)"
            stroke={LIME}
            strokeWidth={1.3}
          />
        </Svg>
        <View style={styles.heatRow}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: i === 4 ? LIME : `rgba(139,124,255,${0.14 + (i % 4) * 0.12})`,
              }}
            />
          ))}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <YdlText role="caption" color="text.secondary">
            Prop Pass buffer
          </YdlText>
          <View style={styles.bufferTrack}>
            <View style={[styles.bufferFill, { width: "70%", backgroundColor: PURPLE }]} />
          </View>
        </View>
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
  const [selected, setSelected] = useState<PlanId>("yearly");

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
    weekly?.product ||
    storeProducts.find((p) => p.identifier === YOU_TRADER_WEEKLY_PRODUCT_ID) ||
    null;
  const monthlyProduct =
    monthly?.product ||
    storeProducts.find((p) => p.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) ||
    null;
  const yearlyProduct =
    yearly?.product ||
    storeProducts.find((p) => p.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) ||
    null;

  const offeringsUnavailable =
    !weekly && !monthly && !yearly && !weeklyProduct && !monthlyProduct && !yearlyProduct;

  const weeklyTrial = resolveIntroTrialInfo(weeklyProduct);
  const monthlyTrial = resolveIntroTrialInfo(monthlyProduct);
  const yearlyTrial = resolveIntroTrialInfo(yearlyProduct);

  useEffect(() => {
    if (offeringsUnavailable) return;
    if (yearly || yearlyProduct) {
      if (
        (selected === "weekly" && !(weekly || weeklyProduct)) ||
        (selected === "monthly" && !(monthly || monthlyProduct))
      ) {
        setSelected("yearly");
      }
      return;
    }
    if (selected === "yearly") {
      setSelected(monthly || monthlyProduct ? "monthly" : "weekly");
      return;
    }
    if (selected === "weekly" && !(weekly || weeklyProduct)) {
      setSelected(monthly || monthlyProduct ? "monthly" : "yearly");
    }
    if (selected === "monthly" && !(monthly || monthlyProduct)) {
      setSelected(weekly || weeklyProduct ? "weekly" : "yearly");
    }
  }, [selected, weekly, monthly, yearly, weeklyProduct, monthlyProduct, yearlyProduct, offeringsUnavailable]);

  const plans = useMemo(() => {
    const rows: Array<{
      id: PlanId;
      label: string;
      price: string;
      period: string;
      productId: string;
      pkg: PurchasesPackage | null;
      trial: ReturnType<typeof resolveIntroTrialInfo>;
      savings?: string | null;
      badge?: string;
    }> = [];

    if (weekly || weeklyProduct) {
      rows.push({
        id: "weekly",
        label: "Weekly",
        price: weekly ? packagePrice(weekly) : weeklyProduct?.priceString || PREMIUM_PRICE_WEEKLY,
        period: "week",
        productId: YOU_TRADER_WEEKLY_PRODUCT_ID,
        pkg: weekly,
        trial: weeklyTrial,
      });
    }
    if (monthly || monthlyProduct) {
      rows.push({
        id: "monthly",
        label: "Monthly",
        price: monthly ? packagePrice(monthly) : monthlyProduct?.priceString || PREMIUM_PRICE,
        period: "month",
        productId: YOU_TRADER_MONTHLY_PRODUCT_ID,
        pkg: monthly,
        trial: monthlyTrial,
      });
    }
    if (yearly || yearlyProduct) {
      const yearlyPriceString =
        yearly ? packagePrice(yearly) : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY;
      const monthlyPriceString =
        monthly ? packagePrice(monthly) : monthlyProduct?.priceString || PREMIUM_PRICE;
      rows.push({
        id: "yearly",
        label: "Yearly",
        price: yearlyPriceString,
        period: "year",
        productId: YOU_TRADER_YEARLY_PRODUCT_ID,
        pkg: yearly,
        trial: yearlyTrial,
        badge: "Recommended",
        savings: yearlySavingsLabel(
          parsePriceNumber(monthlyPriceString),
          parsePriceNumber(yearlyPriceString),
        ),
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
    weeklyTrial,
    monthlyTrial,
    yearlyTrial,
    packagePrice,
  ]);

  const active = plans.find((p) => p.id === selected) || plans[0] || null;
  const activeTrialEligible = active?.trial.eligibility === "eligible";

  const cta = (() => {
    if (!active) return "Start";
    if (activeTrialEligible) return "Start My 7-Day Free Trial";
    if (selected === "weekly") return `Start Weekly · ${active.price}`;
    if (selected === "monthly") return `Start Monthly · ${active.price}`;
    return `Start Yearly · ${active.price}`;
  })();

  const subCta = (() => {
    if (!active) return null;
    if (activeTrialEligible) {
      return `7 days free, then ${active.price}/${active.period}. Cancel anytime.`;
    }
    if (active.trial.eligibility === "unknown") {
      return `${active.price} per ${active.trial ? active.period : active.period}. Cancel anytime.`;
    }
    return null;
  })();

  const valueChips = [
    "Futures Trading Journal",
    "Prop Pass",
    "Performance Radar",
    "Trading Heatmap",
    "Risk Protection",
  ];

  const selectPlan = (id: PlanId) => {
    setSelected(id);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const missingWeekly = !offeringsUnavailable && !(weekly || weeklyProduct);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <ScrollView contentContainerStyle={styles.body} testID="acquisition-paywall">
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

        <YdlText role="title">Your trading system is ready</YdlText>
        <YdlText role="body" color="text.secondary">
          Track every futures trade, protect prop challenge limits, and understand exactly what improves
          or hurts your performance.
        </YdlText>

        <View style={styles.chipRow}>
          {valueChips.map((line) => (
            <View key={line} style={[styles.chip, { backgroundColor: theme.colors.surface.card }]}>
              <YdlText role="caption">{line}</YdlText>
            </View>
          ))}
        </View>

        {missingWeekly ? (
          <View style={[styles.warn, { backgroundColor: theme.colors.surface.card }]} testID="paywall-weekly-missing">
            <YdlText role="caption" color="text.secondary">
              Weekly plan is not available from the store yet. Retry or contact support if this persists.
            </YdlText>
          </View>
        ) : null}

        {offeringsUnavailable ? (
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface.card }]}
            testID="paywall-offerings-unavailable"
          >
            <YdlText role="bodyEmphasized">{t("subscription.unavailableTitle")}</YdlText>
            <YdlText role="body" color="text.secondary">
              {t("subscription.unavailableBody")}
            </YdlText>
            <YdlButton label={t("subscription.retry")} onPress={onRetryOfferings} disabled={purchaseBusy} />
            <YdlButton
              label={t("restorePurchases")}
              variant="secondary"
              onPress={onRestore}
              disabled={purchaseBusy}
              testID="paywall-restore"
            />
          </View>
        ) : (
          <View style={styles.plans}>
            {plans.map((plan) => {
              const activePlan = plan.id === (active?.id || selected);
              const showTrial = plan.trial.eligibility === "eligible";
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => selectPlan(plan.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activePlan }}
                  accessibilityLabel={`${plan.label} ${plan.price}${activePlan ? ", selected" : ""}`}
                  testID={`paywall-plan-${plan.id}`}
                  style={[
                    styles.plan,
                    {
                      minHeight: YDL_MIN_TOUCH_TARGET + 28,
                      backgroundColor: activePlan ? "rgba(184,242,85,0.08)" : theme.colors.surface.card,
                      borderColor: activePlan ? theme.colors.action.primary : "rgba(255,255,255,0.08)",
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
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.planLabelRow}>
                      <YdlText role="bodyEmphasized">{plan.label}</YdlText>
                      {plan.badge ? (
                        <View style={[styles.badge, { backgroundColor: "rgba(184,242,85,0.16)" }]}>
                          <YdlText role="caption" style={{ color: LIME }}>
                            {plan.badge}
                          </YdlText>
                        </View>
                      ) : null}
                    </View>
                    {showTrial ? (
                      <YdlText role="caption" style={{ color: LIME }}>
                        7 days free
                      </YdlText>
                    ) : null}
                    <YdlText role="caption" color="text.secondary">
                      {showTrial ? `Then ${plan.price}/${plan.period}` : `${plan.price} per ${plan.period}`}
                    </YdlText>
                    {plan.savings ? (
                      <YdlText role="caption" color="text.secondary">
                        {plan.savings}
                      </YdlText>
                    ) : null}
                  </View>
                  <YdlText role="title">{plan.price}</YdlText>
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

        <YdlText role="caption" color="text.tertiary">
          Payment will be charged to your Apple ID. Subscriptions renew automatically unless cancelled at
          least 24 hours before the end of the current period. Manage or cancel in App Store account
          settings.
        </YdlText>
        <View style={{ height: 96 }} />
      </ScrollView>

      {!offeringsUnavailable && active ? (
        <View style={[styles.stickyCta, { backgroundColor: theme.colors.background.primary }]}>
          <YdlButton
            label={purchaseBusy ? t("connecting") : cta}
            onPress={() => onPurchase(active.pkg, active.productId)}
            disabled={purchaseBusy}
            testID="paywall-primary-cta"
          />
          {subCta ? (
            <YdlText role="caption" color="text.secondary" style={{ textAlign: "center" }} testID="paywall-trial-subcopy">
              {subCta}
            </YdlText>
          ) : null}
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
  heatRow: { flexDirection: "row", flexWrap: "wrap", gap: 3, width: 78 },
  bufferTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  bufferFill: { height: 8, borderRadius: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  warn: { borderRadius: 12, padding: 12 },
  plans: { gap: 10 },
  plan: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  planLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  legalLinks: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  legalLink: { minHeight: 44, justifyContent: "center" },
  stickyCta: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
});
