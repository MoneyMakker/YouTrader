import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export const TRADE_VISION_PRIVACY_DISCLOSURE_VERSION = "2026-07-15";

const ACKNOWLEDGEMENT_KEY = "youtrader.trade-vision.privacy-acknowledgement.v1";
const TRADE_VISION_CACHE_PREFIX = "ai-local-cache-v1:trade-vision:";

export type TradeVisionPrivacyAcknowledgement = {
  disclosureVersion: string;
  acknowledgedAt: string;
  appVersion: string;
  sourceScreen: "trade_vision" | "settings";
};

export function isCurrentTradeVisionAcknowledgement(value: unknown): value is TradeVisionPrivacyAcknowledgement {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.disclosureVersion === TRADE_VISION_PRIVACY_DISCLOSURE_VERSION
    && typeof record.acknowledgedAt === "string"
    && typeof record.appVersion === "string"
    && (record.sourceScreen === "trade_vision" || record.sourceScreen === "settings");
}

export async function getTradeVisionPrivacyAcknowledgement(): Promise<TradeVisionPrivacyAcknowledgement | null> {
  try {
    const raw = await AsyncStorage.getItem(ACKNOWLEDGEMENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    return isCurrentTradeVisionAcknowledgement(value) ? value : null;
  } catch {
    return null;
  }
}

export async function acknowledgeTradeVisionPrivacy(
  sourceScreen: TradeVisionPrivacyAcknowledgement["sourceScreen"],
): Promise<TradeVisionPrivacyAcknowledgement> {
  const acknowledgement: TradeVisionPrivacyAcknowledgement = {
    disclosureVersion: TRADE_VISION_PRIVACY_DISCLOSURE_VERSION,
    acknowledgedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || "unknown",
    sourceScreen,
  };
  await AsyncStorage.setItem(ACKNOWLEDGEMENT_KEY, JSON.stringify(acknowledgement));
  return acknowledgement;
}

export async function revokeTradeVisionPrivacyAcknowledgement(): Promise<void> {
  await AsyncStorage.removeItem(ACKNOWLEDGEMENT_KEY);
}

/** Deletes only locally cached Trade Vision responses; the selected source image is never cached here. */
export async function clearTradeVisionLocalCache(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const tradeVisionKeys = keys.filter((key) => key.startsWith(TRADE_VISION_CACHE_PREFIX));
  if (tradeVisionKeys.length) await AsyncStorage.multiRemove(tradeVisionKeys);
  return tradeVisionKeys.length;
}
