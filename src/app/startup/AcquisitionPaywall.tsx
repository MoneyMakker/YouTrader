/**
 * Acquisition paywall — three real plans, no AI copy, no CTA+unavailable trap.
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

function hasIntroTrial(product: PurchasesStoreProduct | null | undefined): boolean {
  const intro = (product as { introPrice?: { price?: number; periodNumberOfUnits?: number } | null } | null)
    ?.introPrice;
  if (!intro) return false;
  return Number(intro.price) === 0 || Number(intro.periodNumberOfUnits) > 0;
}

function PaywallHeroPreview() {
  const theme = useYdlTheme("dark");
  return (
    <View
      style={[styles.hero, { backgroundColor: theme.colors.surface.card }]}
      testID="paywall-hero-preview"
      accessibilityElementsHidden
    >
      <View style={styles.heroCol}>
        <YdlText role="caption" color="text.secondary">
          Journal
        </YdlText>
        <YdlText role="bodyEmphasized">MES · +$420</YdlText>
        <YdlText role="caption" color="text.secondary">
          Heatmap
        </YdlText>
        <View style={styles.heatRow}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: i === 3 ? LIME : `rgba(139,124,255,${0.15 + (i % 4) * 0.12})`,
              }}
            />
          ))}
        </View>
      </View>
      <Svg width={120} height={88} viewBox="0 0 120 88">
        <Circle cx="60" cy="44" r="30" stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
        <Path
          d="M60 16 L88 36 L80 68 L40 68 L32 36 Z"
          fill="rgba(184,242,85,0.16)"
          stroke={LIME}
          strokeWidth={1.4}
        />
        <Rect x="14" y="78" width="92" height="6" rx="3" fill="rgba(255,255,255,0.08)" />
        <Rect x="14" y="78" width="64" height="6" rx="3" fill={PURPLE} />
      </Svg>
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
    storeProducts.find((p) => p.identifier === YOU_TRADER_WEEKLY_PRODUCT_ID) || null;
  const monthlyProduct =
    storeProducts.find((p) => p.identifier === YOU_TRADER_MONTHLY_PRODUCT_ID) || null;
  const yearlyProduct =
    storeProducts.find((p) => p.identifier === YOU_TRADER_YEARLY_PRODUCT_ID) || null;

  const offeringsUnavailable =
    !weekly && !monthly && !yearly && !weeklyProduct && !monthlyProduct && !yearlyProduct;
  const yearlyHasTrial = hasIntroTrial(yearly?.product || yearlyProduct);

  useEffect(() => {
    if (offeringsUnavailable) return;
    // Prefer yearly when available; otherwise first valid resolved package.
    if (yearly || yearlyProduct) {
      if (selected === "yearly") return;
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
      return;
    }
    if (selected === "monthly" && !(monthly || monthlyProduct)) {
      setSelected(weekly || weeklyProduct ? "weekly" : "yearly");
    }
  }, [selected, weekly, monthly, yearly, weeklyProduct, monthlyProduct, yearlyProduct, offeringsUnavailable]);

  const plans = useMemo(() => {
    const rows: Array<{
      id: PlanId;
      label: string;
      period: string;
      price: string;
      detail?: string;
      badge?: string;
      productId: string;
      pkg: PurchasesPackage | null;
    }> = [];
    if (weekly || weeklyProduct) {
      rows.push({
        id: "weekly",
        label: "Weekly",
        period: "per week",
        price: weekly ? packagePrice(weekly) : weeklyProduct?.priceString || PREMIUM_PRICE_WEEKLY,
        detail: "Low-commitment option",
        productId: YOU_TRADER_WEEKLY_PRODUCT_ID,
        pkg: weekly,
      });
    }
    if (monthly || monthlyProduct) {
      rows.push({
        id: "monthly",
        label: "Monthly",
        period: "per month",
        price: monthly ? packagePrice(monthly) : monthlyProduct?.priceString || PREMIUM_PRICE,
        productId: YOU_TRADER_MONTHLY_PRODUCT_ID,
        pkg: monthly,
      });
    }
    if (yearly || yearlyProduct) {
      const yearlyPriceString =
        yearly ? packagePrice(yearly) : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY;
      rows.push({
        id: "yearly",
        label: "Yearly",
        period: "per year",
        price: yearlyPriceString,
        detail: "About $8.33 / month",
        badge: "Recommended",
        productId: YOU_TRADER_YEARLY_PRODUCT_ID,
        pkg: yearly,
      });
    }
    return rows;
  }, [weekly, monthly, yearly, weeklyProduct, monthlyProduct, yearlyProduct, packagePrice]);

  const active = plans.find((p) => p.id === selected) || plans[0] || null;

  const cta = (() => {
    if (!active) return "Start";
    if (selected === "weekly") return `Start Weekly · ${active.price}`;
    if (selected === "monthly") return `Start Monthly · ${active.price}`;
    if (yearlyHasTrial) return "Start 7-Day Free Trial";
    return `Start Yearly · ${active.price}`;
  })();

  const valueChips = [
    "Futures Journal",
    "Prop Challenge Tracking",
    "Radar & Heatmap",
    "Risk Protection",
    "Performance Reports",
  ];

  const selectPlan = (id: PlanId) => {
    setSelected(id);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.body}
      testID="acquisition-paywall"
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
        <>
          <View style={styles.plans}>
            {plans.map((plan) => {
              const activePlan = plan.id === (active?.id || selected);
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
                      minHeight: YDL_MIN_TOUCH_TARGET + 18,
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
                    <YdlText role="caption" color="text.secondary">
                      {plan.period}
                    </YdlText>
                    {plan.detail ? (
                      <YdlText role="caption" color="text.secondary">
                        {plan.detail}
                      </YdlText>
                    ) : null}
                    {plan.id === "yearly" && yearlyHasTrial ? (
                      <YdlText role="caption" color="text.secondary">
                        7-day free trial available
                      </YdlText>
                    ) : null}
                  </View>
                  <YdlText role="title">{plan.price}</YdlText>
                </Pressable>
              );
            })}
          </View>

          {active ? (
            <YdlButton
              label={purchaseBusy ? t("connecting") : cta}
              onPress={() => onPurchase(active.pkg, active.productId)}
              disabled={purchaseBusy}
              testID="paywall-primary-cta"
            />
          ) : null}

          {(showRestorePurchases || !!paywallError) && (
            <YdlButton
              label={purchaseBusy ? t("checking") : t("restorePurchases")}
              variant="secondary"
              onPress={onRestore}
              disabled={purchaseBusy}
            />
          )}
        </>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, paddingBottom: 48 },
  close: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  hero: {
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  heroCol: { flex: 1, gap: 6 },
  heatRow: { flexDirection: "row", gap: 4, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
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
});
