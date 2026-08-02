import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getPkceCodeVerifierStorageKey } from "./authStorageKeys";

export { getPkceCodeVerifierStorageKey, getSupabaseAuthStorageKey } from "./authStorageKeys";

/**
 * Supabase writes the PKCE verifier through its configured auth storage.
 * Production uses SecureStore while Expo Go / legacy installs may use
 * AsyncStorage, so check the authoritative secure location first.
 */
export async function hasPkceCodeVerifier(): Promise<boolean> {
  const key = getPkceCodeVerifierStorageKey();
  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue && secureValue.length > 0) return true;
  } catch {
    // Expo Go and simulators can lack a usable SecureStore; retain legacy
    // AsyncStorage support for their browser-OAuth flow.
  }
  const legacyValue = await AsyncStorage.getItem(key);
  return Boolean(legacyValue && legacyValue.length > 0);
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
