/**
 * More → Subscription — non-blocking subscription management.
 * Does not overlay Journal/Stats/Prop Pass.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../ydl/accessibility";

type Props = {
  isPremium: boolean;
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  offeringsUnavailable: boolean;
  monthlyLabel: string;
  yearlyLabel: string;
  monthlyPrice: string;
  yearlyPrice: string;
  onPurchaseMonthly: () => void;
  onPurchaseYearly: () => void;
  onRestore: () => void;
  onRetryOfferings: () => void;
  onBack: () => void;
};

export function SubscriptionScreen({
  isPremium,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  offeringsUnavailable,
  monthlyLabel,
  yearlyLabel,
  monthlyPrice,
  yearlyPrice,
  onPurchaseMonthly,
  onPurchaseYearly,
  onRestore,
  onRetryOfferings,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.body}
      testID="subscription-screen"
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("more.back")}
        style={styles.back}
        hitSlop={12}
      >
        <YdlText role="body" color="text.secondary">
          {`‹ ${t("more.back")}`}
        </YdlText>
      </Pressable>

      <YdlText role="title">{t("more.subscription")}</YdlText>
      <YdlText role="caption" color="text.secondary">
        {t("subscription.screenSubtitle")}
      </YdlText>

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]}>
        <YdlText role="label" color="text.secondary">
          {t("subscription.currentPlan")}
        </YdlText>
        <YdlText role="bodyEmphasized">
          {isPremium ? t("subscription.proActive") : t("subscription.noActiveSubscription")}
        </YdlText>
      </View>

      {offeringsUnavailable ? (
        <View
          style={[styles.card, { backgroundColor: theme.colors.surface.card }]}
          testID="subscription-offerings-unavailable"
        >
          <YdlText role="bodyEmphasized">{t("subscription.unavailableTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("subscription.unavailableBody")}
          </YdlText>
          <YdlButton
            label={t("subscription.retry")}
            onPress={onRetryOfferings}
            disabled={purchaseBusy}
            testID="subscription-retry"
          />
        </View>
      ) : (
        <View style={styles.plans}>
          <Pressable
            onPress={onPurchaseMonthly}
            disabled={purchaseBusy || isPremium}
            accessibilityRole="button"
            accessibilityLabel={`${monthlyLabel} ${monthlyPrice}`}
            style={[
              styles.plan,
              {
                backgroundColor: theme.colors.surface.card,
                minHeight: YDL_MIN_TOUCH_TARGET,
                opacity: purchaseBusy || isPremium ? 0.55 : 1,
              },
            ]}
            testID="subscription-monthly"
          >
            <YdlText role="bodyEmphasized">{monthlyLabel}</YdlText>
            <YdlText role="caption" color="text.secondary">
              {monthlyPrice}
            </YdlText>
          </Pressable>
          <Pressable
            onPress={onPurchaseYearly}
            disabled={purchaseBusy || isPremium}
            accessibilityRole="button"
            accessibilityLabel={`${yearlyLabel} ${yearlyPrice}`}
            style={[
              styles.plan,
              {
                backgroundColor: theme.colors.surface.card,
                minHeight: YDL_MIN_TOUCH_TARGET,
                opacity: purchaseBusy || isPremium ? 0.55 : 1,
              },
            ]}
            testID="subscription-yearly"
          >
            <YdlText role="bodyEmphasized">{yearlyLabel}</YdlText>
            <YdlText role="caption" color="text.secondary">
              {yearlyPrice}
            </YdlText>
          </Pressable>
        </View>
      )}

      {(showRestorePurchases || !!paywallError || offeringsUnavailable) && (
        <YdlButton
          label={purchaseBusy ? t("checking") : t("restorePurchases")}
          variant="secondary"
          onPress={onRestore}
          disabled={purchaseBusy}
          testID="subscription-restore"
        />
      )}

      {paywallError ? (
        <YdlText role="caption" color="text.secondary" testID="subscription-error">
          {paywallError}
        </YdlText>
      ) : null}

      <YdlText role="caption" color="text.tertiary">
        {t("subscription.manageHint")}
      </YdlText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 48 },
  back: { minHeight: 44, justifyContent: "center" },
  card: { borderRadius: 14, padding: 16, gap: 6 },
  plans: { gap: 10 },
  plan: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
});
