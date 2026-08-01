/**
 * Acquisition paywall — three real plans, no AI copy, no CTA+unavailable trap.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";
import { useTranslation } from "react-i18next";
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
  onContinueFree: () => void;
  onClose: () => void;
  packageTitle: (pkg: PurchasesPackage) => string;
  packagePrice: (pkg?: PurchasesPackage | null) => string;
};

function hasIntroTrial(product: PurchasesStoreProduct | null | undefined): boolean {
  const intro = (product as { introPrice?: { price?: number; periodNumberOfUnits?: number } | null } | null)
    ?.introPrice;
  if (!intro) return false;
  return Number(intro.price) === 0 || Number(intro.periodNumberOfUnits) > 0;
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
  onContinueFree,
  onClose,
  packageTitle,
  packagePrice,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const [selected, setSelected] = useState<PlanId>("yearly");

  const weekly = packages.find((pkg) => packageTitle(pkg) === "WEEKLY") || null;
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

  const offeringsUnavailable = !weekly && !monthly && !yearly && !weeklyProduct && !monthlyProduct && !yearlyProduct;
  const yearlyHasTrial = hasIntroTrial(yearly?.product || yearlyProduct);

  useEffect(() => {
    if (selected === "weekly" && !(weekly || weeklyProduct)) setSelected("monthly");
    if (selected === "monthly" && !(monthly || monthlyProduct)) setSelected(yearly || yearlyProduct ? "yearly" : "weekly");
    if (selected === "yearly" && !(yearly || yearlyProduct)) setSelected(monthly || monthlyProduct ? "monthly" : "weekly");
  }, [selected, weekly, monthly, yearly, weeklyProduct, monthlyProduct, yearlyProduct]);

  const plans = useMemo(() => {
    const rows: Array<{
      id: PlanId;
      label: string;
      price: string;
      badge?: string;
      available: boolean;
      productId: string;
      pkg: PurchasesPackage | null;
    }> = [];
    if (weekly || weeklyProduct) {
      rows.push({
        id: "weekly",
        label: "Weekly",
        price: weekly ? packagePrice(weekly) : weeklyProduct?.priceString || PREMIUM_PRICE_WEEKLY,
        available: true,
        productId: YOU_TRADER_WEEKLY_PRODUCT_ID,
        pkg: weekly,
      });
    }
    if (monthly || monthlyProduct) {
      rows.push({
        id: "monthly",
        label: "Monthly",
        price: monthly ? packagePrice(monthly) : monthlyProduct?.priceString || PREMIUM_PRICE,
        available: true,
        productId: YOU_TRADER_MONTHLY_PRODUCT_ID,
        pkg: monthly,
      });
    }
    if (yearly || yearlyProduct) {
      rows.push({
        id: "yearly",
        label: "Yearly",
        price: yearly ? packagePrice(yearly) : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY,
        badge: "Recommended",
        available: true,
        productId: YOU_TRADER_YEARLY_PRODUCT_ID,
        pkg: yearly,
      });
    }
    return rows;
  }, [weekly, monthly, yearly, weeklyProduct, monthlyProduct, yearlyProduct, packagePrice]);

  const active = plans.find((p) => p.id === selected) || plans[0] || null;
  const cta =
    selected === "weekly"
      ? "Start Weekly"
      : selected === "monthly"
        ? "Start Monthly"
        : yearlyHasTrial
          ? "Start 7-Day Free Trial"
          : "Start Yearly";

  const benefits = [
    "Futures Trading Journal",
    "Prop Challenge Tracking",
    "Performance Radar & Heatmap",
    "Risk and Drawdown Protection",
    "Complete Performance Reports",
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.body}
      testID="acquisition-paywall"
    >
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
        <YdlText role="body" color="text.secondary">
          ×
        </YdlText>
      </Pressable>

      <YdlText role="title">Your trading system is ready</YdlText>
      <YdlText role="body" color="text.secondary">
        Track every futures trade, protect prop challenge limits, and understand exactly what improves
        or hurts your performance.
      </YdlText>

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]}>
        {benefits.map((line) => (
          <YdlText key={line} role="body">
            {`• ${line}`}
          </YdlText>
        ))}
      </View>

      {offeringsUnavailable ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="paywall-offerings-unavailable">
          <YdlText role="bodyEmphasized">{t("subscription.unavailableTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("subscription.unavailableBody")}
          </YdlText>
          <YdlButton label={t("subscription.retry")} onPress={onRetryOfferings} disabled={purchaseBusy} />
          <YdlButton
            label="Continue with Free Journal"
            variant="secondary"
            onPress={onContinueFree}
            testID="paywall-continue-free"
          />
          {(showRestorePurchases || !!paywallError) && (
            <YdlButton
              label={t("restorePurchases")}
              variant="secondary"
              onPress={onRestore}
              disabled={purchaseBusy}
            />
          )}
        </View>
      ) : (
        <>
          <View style={styles.plans}>
            {plans.map((plan) => {
              const activePlan = plan.id === (active?.id || selected);
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelected(plan.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activePlan }}
                  accessibilityLabel={`${plan.label} ${plan.price}`}
                  testID={`paywall-plan-${plan.id}`}
                  style={[
                    styles.plan,
                    {
                      minHeight: YDL_MIN_TOUCH_TARGET,
                      backgroundColor: theme.colors.surface.card,
                      borderColor: activePlan ? theme.colors.action.primary : "rgba(255,255,255,0.08)",
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <YdlText role="bodyEmphasized">{plan.label}</YdlText>
                    {plan.badge ? (
                      <YdlText role="caption" color="text.secondary">
                        {plan.badge}
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
  card: { borderRadius: 16, padding: 16, gap: 8 },
  plans: { gap: 10 },
  plan: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
