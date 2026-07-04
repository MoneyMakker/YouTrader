import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPkceCodeVerifierStorageKey } from "./authStorageKeys";

export { getPkceCodeVerifierStorageKey, getSupabaseAuthStorageKey } from "./authStorageKeys";

/** Used by Google OAuth in Expo Go only. */
export async function hasPkceCodeVerifier(): Promise<boolean> {
  const value = await AsyncStorage.getItem(getPkceCodeVerifierStorageKey());
  return Boolean(value && value.length > 0);
}

export async function waitForPkceCodeVerifier(options?: {
  attempts?: number;
  delayMs?: number;
}): Promise<boolean> {
  const attempts = options?.attempts ?? 12;
  const delayMs = options?.delayMs ?? 80;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await hasPkceCodeVerifier()) return true;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
