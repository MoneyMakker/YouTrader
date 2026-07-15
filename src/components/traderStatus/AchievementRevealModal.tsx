import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { X } from "lucide-react-native";
import type { Achievement } from "../../analytics/achievements";
import { getAchievementCardSource } from "../../achievements/achievementCardAssets";
import { t } from "../../i18n";
import { C } from "../../theme/colors";
import { AnimatedPressable } from "../ui/premium";

type Props = {
  item: Achievement | null;
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onShare: (item: Achievement) => void;
  onSave: (item: Achievement) => void;
};

export function AchievementRevealModal({ item, visible, busy, onClose, onShare, onSave }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardMaxW = Math.min(screenW - 40, 340);
  const cardMaxH = Math.min(screenH * 0.62, cardMaxW * 1.55);

  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    if (!visible || !item) return;
    backdrop.setValue(0);
    cardScale.setValue(0.88);
    cardOpacity.setValue(0);
    cardTranslateY.setValue(28);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        speed: 14,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, cardOpacity, cardScale, cardTranslateY, item, visible]);

  if (!item) return null;

  const cardSource = getAchievementCardSource(item.id);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />

        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
              maxWidth: cardMaxW,
            },
          ]}
        >
          <View style={[styles.cardFrame, { maxHeight: cardMaxH }]}>
            <Image
              source={cardSource}
              style={styles.cardImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <View style={styles.actions}>
            <AnimatedPressable
              haptic
              disabled={busy}
              onPress={() => onShare(item)}
              style={styles.actionPrimaryPressable}
              contentStyle={styles.actionPrimary}
            >
              <Text style={styles.actionPrimaryText}>{t("share")}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              haptic
              disabled={busy}
              onPress={() => onSave(item)}
              style={styles.actionSecondaryPressable}
              contentStyle={styles.actionSecondary}
            >
              <Text style={styles.actionSecondaryText}>{t("saveImage")}</Text>
            </AnimatedPressable>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
              <X size={18} color={C.sub} strokeWidth={2.2} />
              <Text style={styles.closeText}>{t("close")}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
  },
  cardWrap: {
    width: "100%",
    alignItems: "center",
    zIndex: 2,
  },
  cardFrame: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: C.green,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cardImage: {
    width: "100%",
    aspectRatio: 664 / 1024,
  },
  actions: {
    width: "100%",
    marginTop: 18,
    gap: 10,
  },
  actionPrimaryPressable: {
    width: "100%",
  },
  actionPrimary: {
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionPrimaryText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  actionSecondaryPressable: {
    width: "100%",
  },
  actionSecondary: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  actionSecondaryText: {
    color: C.text,
    fontWeight: "800",
    fontSize: 14,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  closeText: {
    color: C.sub,
    fontWeight: "700",
    fontSize: 13,
  },
});
