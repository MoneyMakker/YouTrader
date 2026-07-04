import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";
import {
  openLegalUrl,
  PRIVACY_POLICY_URL,
  TERMS_OF_USE_EULA_URL,
} from "../../config/legalUrls";
import { t } from "../../i18n";

const C = {
  text: "#F4F4F5",
  sub: "#9CA3AF",
  green: "#A3FF12",
  border: "rgba(255,255,255,0.08)",
};

const MONTHLY_FALLBACK = { title: "YouTrader Pro Monthly", duration: "1 month", price: "$12.99/month" };
const YEARLY_FALLBACK = { title: "YouTrader Pro Yearly", duration: "1 year", price: "$99.99/year" };

function productDuration(productId: string) {
  const id = productId.toLowerCase();
  if (id.includes("year") || id.includes("annual")) return t("subDurationYear");
  return t("subDurationMonth");
}

function formatProductPrice(product?: PurchasesStoreProduct | null, fallback = MONTHLY_FALLBACK.price) {
  if (!product?.priceString) return fallback;
  const duration = productDuration(product.identifier);
  return duration === t("subDurationYear") ? `${product.priceString}${t("subPerYear")}` : `${product.priceString}${t("subPerMonth")}`;
}

function formatPackagePrice(pkg?: PurchasesPackage | null, fallback = MONTHLY_FALLBACK.price) {
  if (!pkg?.product?.priceString) return fallback;
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  const yearly = id.includes("year") || id.includes("annual");
  return yearly ? `${pkg.product.priceString}${t("subPerYear")}` : `${pkg.product.priceString}${t("subPerMonth")}`;
}

function packageTitle(pkg: PurchasesPackage) {
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return YEARLY_FALLBACK.title;
  if (id.includes("month")) return MONTHLY_FALLBACK.title;
  return pkg.product.title || "YouTrader Pro";
}

type Props = {
  monthlyPackage?: PurchasesPackage | null;
  yearlyPackage?: PurchasesPackage | null;
  monthlyProduct?: PurchasesStoreProduct | null;
  yearlyProduct?: PurchasesStoreProduct | null;
  compact?: boolean;
};

export function SubscriptionLegalDisclosure({
  monthlyPackage,
  yearlyPackage,
  monthlyProduct,
  yearlyProduct,
  compact = false,
}: Props) {
  const monthly = {
    title: monthlyPackage ? packageTitle(monthlyPackage) : MONTHLY_FALLBACK.title,
    duration: t("subDurationMonth"),
    price: formatPackagePrice(monthlyPackage, formatProductPrice(monthlyProduct, MONTHLY_FALLBACK.price)),
  };
  const yearly = {
    title: yearlyPackage ? packageTitle(yearlyPackage) : YEARLY_FALLBACK.title,
    duration: t("subDurationYear"),
    price: formatPackagePrice(yearlyPackage, formatProductPrice(yearlyProduct, YEARLY_FALLBACK.price)),
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.heading}>{t("subAutoRenewHeading")}</Text>
      <Text style={styles.line}>
        • {monthly.title} — {monthly.duration} — {monthly.price}
      </Text>
      <Text style={styles.line}>
        • {yearly.title} — {yearly.duration} — {yearly.price}
      </Text>
      <Text style={styles.disclosure}>{t("subDisclosure")}</Text>
      <View style={styles.linkRow}>
        <Pressable onPress={() => openLegalUrl(PRIVACY_POLICY_URL, t("authPrivacyLabel"))}>
          <Text style={styles.link}>{t("authPrivacyLabel")}</Text>
        </Pressable>
        <Text style={styles.sep}>•</Text>
        <Pressable onPress={() => openLegalUrl(TERMS_OF_USE_EULA_URL, t("subTermsEula"))}>
          <Text style={styles.link}>{t("subTermsEula")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  wrapCompact: {
    marginTop: 8,
    paddingTop: 8,
  },
  heading: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  line: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  disclosure: {
    color: C.sub,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 8,
  },
  link: {
    color: C.green,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  sep: {
    color: C.sub,
    fontSize: 12,
  },
});
