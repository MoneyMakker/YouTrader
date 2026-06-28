import * as FileSystem from "expo-file-system";

export async function readCsvFileAsText(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: "utf8" });
}
