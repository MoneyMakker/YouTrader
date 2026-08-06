/**
 * Acquisition paywall — redesigned horizontal plan carousel with StoreKit pricing,
 * trial eligibility integration, and native iOS styling.
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
import { PaywallCarousel } from "./PaywallCarousel";

type Props = {
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  /** Authenticated paywall: Sign Out + Delete Account (required when Main Settings unreachable). */
  authenticatedAccountActions?: boolean;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
  onRetryOfferings: () => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
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
  authenticatedAccountActions = false,
  onPurchase,
  onRestore,
  onRetryOfferings,
  onSignOut,
  onDeleteAccount,
  onClose,
  packageTitle,
  packagePrice,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PaywallPlanId>("yearly");
  const purchaseLock = useRef(false);

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
    !weekly && !monthly && !yearly && !weeklyProduct && !monthlyProduct && !yearlyProduct && !__DEV__;

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
    : monthlyProduct?.priceString || PREMIUM_PRICE || "$12.99";
  const yearlyPriceString = yearly
    ? packagePrice(yearly)
    : yearlyProduct?.priceString || PREMIUM_PRICE_YEARLY || "$99.99";

  const plans = useMemo(() => {
    const rows: ReturnType<typeof buildPaywallPlanPresentation>[] = [];
    const hasWeekly = !!(weekly || weeklyProduct || __DEV__);
    const hasMonthly = !!(monthly || monthlyProduct || __DEV__);
    const hasYearly = !!(yearly || yearlyProduct || __DEV__);

    if (hasWeekly) {
      rows.push(
        buildPaywallPlanPresentation({
          id: "weekly",
          priceString: weeklyPriceString,
          product: weeklyProduct,
          eligibilityStatus: weeklyProduct?.identifier
            ? eligibilityByProductId[weeklyProduct.identifier]
            : undefined,
        }),
      );
    }
    if (hasMonthly) {
      rows.push(
        buildPaywallPlanPresentation({
          id: "monthly",
          priceString: monthlyPriceString,
          product: monthlyProduct,
          eligibilityStatus: monthlyProduct?.identifier
            ? eligibilityByProductId[monthlyProduct.identifier]
            : undefined,
        }),
      );
    }
    if (hasYearly) {
      rows.push(
        buildPaywallPlanPresentation({
          id: "yearly",
          priceString: yearlyPriceString,
          product: yearlyProduct,
          weeklyPriceString,
          eligibilityStatus: yearlyProduct?.identifier
            ? eligibilityByProductId[yearlyProduct.identifier]
            : undefined,
        }),
      );
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
    yearlyPriceString,
    eligibilityByProductId,
  ]);

  const packagesMap = useMemo(() => ({
    weekly: weekly || null,
    monthly: monthly || null,
    yearly: yearly || null,
  }), [weekly, monthly, yearly]);

  const activePlan = plans.find((p) => p.id === selected) || plans[0] || null;
  const activePkg =
    activePlan?.id === "weekly" ? weekly
    : activePlan?.id === "monthly" ? monthly
    : activePlan?.id === "yearly" ? yearly
    : null;
  const activeProductId =
    activePlan?.id === "weekly" ? YOU_TRADER_WEEKLY_PRODUCT_ID
    : activePlan?.id === "monthly" ? YOU_TRADER_MONTHLY_PRODUCT_ID
    : activePlan?.id === "yearly" ? YOU_TRADER_YEARLY_PRODUCT_ID
    : YOU_TRADER_YEARLY_PRODUCT_ID;

  const handleContinue = (_pkg?: PurchasesPackage | null, planId?: PaywallPlanId) => {
    if (purchaseBusy || purchaseLock.current) return;
    purchaseLock.current = true;
    const targetPlan = plans.find((p) => p.id === planId) || activePlan;
    const targetPkg =
      targetPlan?.id === "weekly" ? weekly
      : targetPlan?.id === "monthly" ? monthly
      : targetPlan?.id === "yearly" ? yearly
      : activePkg;
    const targetProdId =
      targetPlan?.id === "weekly" ? YOU_TRADER_WEEKLY_PRODUCT_ID
      : targetPlan?.id === "monthly" ? YOU_TRADER_MONTHLY_PRODUCT_ID
      : targetPlan?.id === "yearly" ? YOU_TRADER_YEARLY_PRODUCT_ID
      : activeProductId;

    try {
      onPurchase(targetPkg, targetProdId);
    } finally {
      setTimeout(() => {
        purchaseLock.current = false;
      }, 800);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background.primary, paddingTop: Math.max(insets.top, 8) }]} testID="acquisition-paywall">
      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close} testID="paywall-close">
          <YdlText role="body" color="text.secondary">×</YdlText>
        </Pressable>
      ) : <View style={{ height: 24 }} />}

      <PaywallCarousel
        plans={plans}
        packagesMap={packagesMap}
        selectedPlanId={selected}
        onSelectPlan={(id) => setSelected(id)}
        purchaseBusy={purchaseBusy}
        onContinue={handleContinue}
        onRestore={onRestore}
        onRetry={onRetryOfferings}
        catalogLoading={false}
        catalogError={offeringsUnavailable ? "Plans are temporarily unavailable" : null}
      />

      {authenticatedAccountActions ? (
        <View style={[styles.accountActions, { paddingBottom: Math.max(insets.bottom, 12) }]} testID="paywall-account-actions">
          {onSignOut ? (
            <Pressable onPress={onSignOut} accessibilityRole="button" accessibilityLabel={t("signOut")} style={styles.accountAction} testID="paywall-sign-out">
              <YdlText role="caption" color="text.secondary">{t("signOut")}</YdlText>
            </Pressable>
          ) : null}
          {onSignOut && onDeleteAccount ? <YdlText role="caption" color="text.tertiary">·</YdlText> : null}
          {onDeleteAccount ? (
            <Pressable onPress={onDeleteAccount} accessibilityRole="button" accessibilityLabel={t("deleteAccount")} style={styles.accountAction} testID="paywall-delete-account">
              <YdlText role="caption" color="text.secondary">{t("deleteAccount")}</YdlText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06080C" },
  close: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
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
  accountActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  accountAction: { minHeight: 40, justifyContent: "center", paddingHorizontal: 6 },
});
