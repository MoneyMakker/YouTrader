import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Lock } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import type { PurchasesStoreProduct } from "react-native-purchases";
import { t } from "../../i18n";
import { PRO_MONTHLY_PRICE_LABEL, PRO_TRIAL_DAYS } from "../../config/monetization";
import { lightHaptic } from "../ui/haptics";
import { C } from "../../theme/colors";

type Props = {
  packages: PurchasesPackage[];
  storeProducts: PurchasesStoreProduct[];
  purchaseBusy: boolean;
  paywallError: string;
  showRestorePurchases: boolean;
  monthlyProductId: string;
  fallbackPrice: string;
  packageTitle: (pkg: PurchasesPackage) => string;
  packagePrice: (pkg: PurchasesPackage) => string;
  onPurchase: (pkg?: PurchasesPackage | null, productId?: string) => void;
  onRestore: () => void;
};

export function AiAnalyticsProScreen({
  packages,
  storeProducts,
  purchaseBusy,
  paywallError,
  showRestorePurchases,
  monthlyProductId,
  fallbackPrice,
  packageTitle,
  packagePrice,
  onPurchase,
  onRestore,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.4)).current;
  const monthly = packages.find((pkg) => packageTitle(pkg) === "MONTHLY") || packages[0] || null;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fade, glow]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, alignItems: "center", width: "100%" }}>
          <Animated.View style={[styles.lockHalo, { opacity: glow }]}>
            <Lock size={38} color={C.green} strokeWidth={2.2} />
          </Animated.View>

          <Text style={styles.title}>{t("aiProFeatureTitle")}</Text>
          <Text style={styles.body}>{t("aiProFeatureBody")}</Text>

          <Pressable
            disabled={purchaseBusy}
            onPress={() => {
              lightHaptic();
              onPurchase(monthly, monthlyProductId);
            }}
            style={[styles.cta, purchaseBusy && styles.ctaDisabled]}
          >
            <Text style={styles.ctaText}>
              {purchaseBusy ? t("aiProConnecting") : t("aiProStartTrial", { days: PRO_TRIAL_DAYS })}
            </Text>
          </Pressable>
          <Text style={styles.priceHint}>{t("aiProPriceHint", { price: PRO_MONTHLY_PRICE_LABEL })}</Text>

          {showRestorePurchases || paywallError ? (
            <Pressable disabled={purchaseBusy} onPress={onRestore} style={styles.restoreBtn}>
              <Text style={styles.restoreText}>{purchaseBusy ? t("checking") : t("restorePurchases")}</Text>
            </Pressable>
          ) : null}
          {paywallError ? <Text style={styles.error}>{paywallError}</Text> : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 48,
    alignItems: "center",
  },
  lockHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.35)",
    backgroundColor: "rgba(163,255,18,0.08)",
    marginBottom: 28,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 16,
    maxWidth: 340,
  },
  body: {
    color: C.sub,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 340,
    marginBottom: 32,
  },
  cta: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 999,
    backgroundColor: C.green,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.green,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: C.bg, fontSize: 16, fontWeight: "900" },
  priceHint: { color: C.sub, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  restoreBtn: { alignItems: "center", paddingVertical: 16 },
  restoreText: { color: C.purple, fontWeight: "800", fontSize: 13 },
  error: { color: C.red, fontSize: 12, textAlign: "center", marginTop: 8 },
});
