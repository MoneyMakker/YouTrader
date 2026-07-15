import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

function resolveMimeType(uri: string): "jpeg" | "png" {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  if (lower.includes("achievement-galaxy") || lower.includes("dark-bull-stat")) return "jpeg";
  return "png";
}

/** react-native-svg Image href requires a data URI — file:// paths rasterize as blank. */
export async function loadBundledAssetAsSvgHref(moduleId: number, cacheBasename: string): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  let uri = asset.localUri || asset.uri;
  if (!uri) throw new Error(`Share template asset is missing: ${cacheBasename}`);

  if (uri.startsWith("http")) {
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) throw new Error("No writable cache directory for share template");
    const localPath = `${cacheDir}${cacheBasename}`;
    await FileSystem.downloadAsync(uri, localPath);
    uri = localPath;
  }

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const mime = resolveMimeType(uri);
  return `data:image/${mime};base64,${base64}`;
}
