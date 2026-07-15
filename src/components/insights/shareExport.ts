import type { RefObject } from "react";
import { Alert, Platform, Share, type View } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import type { Achievement } from "../../analytics/achievements";
import { logger } from "../../lib/logger";
import { t } from "../../i18n";
import { buildWeeklyReportHtml } from "../../reports/weeklyReportHtml";
import { MAPPED_ACHIEVEMENT_IDS } from "../../achievements/achievementCardAssets";
import { preloadAchievementCardAssets, resolveAchievementCardUri } from "../../achievements/resolveAchievementCardUri";
import type { AchievementShareStats } from "./shareCard/achievementHelpers";
import { generateStatShareCardImage, logStatCardExport } from "./shareCard/statCardImageExport";
import type { TraderShareCardData } from "./shareCard/TraderShareCard";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "./SharePnLCard";

const YOU_TRADER_MARK = require("../../../assets/youtrader-bull-mark.png");

const EXPO_GO_SHARE_MESSAGE =
  "Sharing is not available in Expo Go. Use a development build or TestFlight to test native sharing.";

const EXPO_GO_SAVE_MESSAGE = "Save Card may require a development build. Share Card should still work.";

let achievementTemplateReady: Promise<void> | null = null;

export type StatCardExportMeta = {
  userId?: string | null;
  action: "share" | "save";
  period: string;
};

export type StatCardExportData = {
  card: TraderShareCardData;
  meta: StatCardExportMeta;
};

function stampForFilename() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}${s}`;
}

function buildStatCardFilename(meta: StatCardExportMeta) {
  const userPart = (meta.userId || "local").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "local";
  return `youtrader-share-card-${meta.action}-${meta.period}-${userPart}-${stampForFilename()}.png`;
}

function logShareCard(event: string, detail?: string) {
  logger.info(`[YouTrader:share-card] ${event}${detail ? ` ${detail}` : ""}`);
}

async function loadShareModules() {
  const [viewShot, sharing, print, mediaLibrary] = await Promise.all([
    import("react-native-view-shot"),
    import("expo-sharing"),
    import("expo-print"),
    import("expo-media-library"),
  ]);
  return { captureRef: viewShot.captureRef, Sharing: sharing, Print: print, MediaLibrary: mediaLibrary };
}

export async function preloadAchievementTemplate() {
  if (!achievementTemplateReady) {
    achievementTemplateReady = preloadAchievementCardAssets(MAPPED_ACHIEVEMENT_IDS);
  }
  await achievementTemplateReady;
}

async function openNativeShareSheet(uri: string, dialogTitle: string) {
  const { Sharing } = await loadShareModules();
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle, UTI: "public.png" });
    return { shared: true, method: "expo-sharing" as const };
  }
  if (Platform.OS === "ios" || Platform.OS === "android") {
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri, title: dialogTitle }
          : { message: dialogTitle, url: uri, title: dialogTitle },
      );
      return { shared: true, method: "react-native-share" as const };
    } catch {
      // fall through
    }
  }
  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    Alert.alert("Share unavailable", EXPO_GO_SHARE_MESSAGE);
    return { shared: false, method: "expo-go-blocked" as const };
  }
  throw new Error("Sharing is not available on this device");
}

export async function shareStatShareCardFromData(
  card: TraderShareCardData,
  meta: StatCardExportMeta,
  dialogTitle = "Share YouTrader card",
) {
  try {
    const uri = await generateStatShareCardImage(card, buildStatCardFilename(meta));
    const result = await openNativeShareSheet(uri, dialogTitle);
    if (result.shared) logStatCardExport("share_success");
    return { uri, ...result };
  } catch (error) {
    logStatCardExport("export_failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function saveStatShareCardFromData(card: TraderShareCardData, meta: StatCardExportMeta) {
  const { MediaLibrary } = await loadShareModules();
  const perm = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  if (!perm.granted) {
    if (Constants.appOwnership === "expo") {
      Alert.alert("Save Card", EXPO_GO_SAVE_MESSAGE);
    }
    throw new Error("Photos permission was denied. Allow Photos access in iPhone Settings to save YouTrader cards.");
  }
  try {
    const uri = await generateStatShareCardImage(card, buildStatCardFilename(meta));
    await MediaLibrary.saveToLibraryAsync(uri);
    logStatCardExport("save_success");
    return uri;
  } catch (error) {
    logStatCardExport("export_failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function shareCapturedView(
  ref: RefObject<View | null> | null,
  dialogTitle = "Share trader card",
  options?: { width?: number; height?: number; data?: StatCardExportData },
) {
  if (options?.data) {
    return shareStatShareCardFromData(options.data.card, options.data.meta, dialogTitle);
  }
  const { captureRef } = await loadShareModules();
  if (!ref?.current) throw new Error("Share card is not ready");
  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: options?.width || SHARE_CARD_WIDTH,
    height: options?.height || SHARE_CARD_HEIGHT,
  });
  const result = await openNativeShareSheet(uri, dialogTitle);
  return { uri, ...result };
}

export async function saveCapturedViewToPhotos(
  ref: RefObject<View | null> | null,
  options?: { width?: number; height?: number; data?: StatCardExportData },
) {
  if (options?.data) {
    return saveStatShareCardFromData(options.data.card, options.data.meta);
  }
  const { captureRef, MediaLibrary } = await loadShareModules();
  const perm = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  if (!perm.granted) throw new Error("Photos permission was denied. Allow Photos access in iPhone Settings to save YouTrader cards.");
  if (!ref?.current) throw new Error("Share card is not ready");
  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: options?.width || SHARE_CARD_WIDTH,
    height: options?.height || SHARE_CARD_HEIGHT,
  });
  await MediaLibrary.saveToLibraryAsync(uri);
  return uri;
}

export async function shareAchievementCardFromData(
  item: Achievement,
  stats?: AchievementShareStats | null,
  dialogTitle = "Share YouTrader achievement card",
) {
  void stats;
  try {
    const uri = await resolveAchievementCardUri(item.id);
    const result = await openNativeShareSheet(uri, dialogTitle);
    if (result.shared) logShareCard("share_success", item.id);
    return { uri, ...result };
  } catch (error) {
    logShareCard("export_failed", error instanceof Error ? error.message : String(error));
    throw new Error(t("shareCardExportFailed"));
  }
}

export async function saveAchievementCardFromDataToPhotos(item: Achievement, stats?: AchievementShareStats | null) {
  void stats;
  const { MediaLibrary } = await loadShareModules();
  const perm = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  if (!perm.granted) {
    if (Constants.appOwnership === "expo") {
      Alert.alert("Save Card", EXPO_GO_SAVE_MESSAGE);
    }
    throw new Error("Photos permission was denied. Allow Photos access in iPhone Settings to save YouTrader cards.");
  }
  try {
    const uri = await resolveAchievementCardUri(item.id);
    await MediaLibrary.saveToLibraryAsync(uri);
    logShareCard("save_success", item.id);
    return uri;
  } catch (error) {
    logShareCard("export_failed", error instanceof Error ? error.message : String(error));
    throw new Error(t("shareCardExportFailed"));
  }
}

/** @deprecated Use shareAchievementCardFromData — view-shot capture is unreliable on iOS. */
export async function shareAchievementCard(ref: RefObject<View | null>) {
  void ref;
  throw new Error(t("shareCardExportFailed"));
}

/** @deprecated Use saveAchievementCardFromDataToPhotos — view-shot capture is unreliable on iOS. */
export async function saveAchievementCardToPhotos(ref: RefObject<View | null>) {
  void ref;
  throw new Error(t("shareCardExportFailed"));
}

export async function shareMonthlyPdfReport(stats: Record<string, unknown>) {
  return shareWeeklyPdfReport(stats);
}

async function loadLogoDataUri() {
  try {
    const asset = Asset.fromModule(YOU_TRADER_MARK);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri || !uri.startsWith("file://")) return "";
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    return `data:image/png;base64,${base64}`;
  } catch {
    return "";
  }
}

export async function shareWeeklyPdfReport(stats: Record<string, unknown>) {
  const { Sharing, Print } = await loadShareModules();
  const html = buildWeeklyReportHtml(stats, await loadLogoDataUri());
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share YouTrader report" });
  return uri;
}
