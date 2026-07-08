import { Asset } from "expo-asset";
import type { ImageSourcePropType } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getAchievementCardSource } from "./achievementCardAssets";

const uriCache = new Map<number, string>();

function moduleIdFromSource(source: ImageSourcePropType): number {
  if (typeof source === "number") return source;
  throw new Error("Achievement card source must be a bundled require() module");
}

/** Resolves a bundled achievement PNG to a local file URI for share/save (no rasterization). */
export async function resolveAchievementCardUri(achievementId: string): Promise<string> {
  const source = getAchievementCardSource(achievementId);
  const moduleId = moduleIdFromSource(source);
  const cached = uriCache.get(moduleId);
  if (cached) return cached;

  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  let uri = asset.localUri || asset.uri;
  if (!uri) throw new Error("Achievement card asset is unavailable");

  if (uri.startsWith("http")) {
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) throw new Error("No writable cache directory for achievement card");
    const localPath = `${cacheDir}achievement-card-${achievementId.replace(/[^a-zA-Z0-9_-]/g, "")}.png`;
    await FileSystem.downloadAsync(uri, localPath);
    uri = localPath;
  }

  uriCache.set(moduleId, uri);
  return uri;
}

export async function preloadAchievementCardAssets(achievementIds: string[]) {
  await Promise.all(achievementIds.map((id) => resolveAchievementCardUri(id).catch(() => undefined)));
}
