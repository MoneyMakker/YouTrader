/**
 * Clears app-owned pending OAuth / PKCE state.
 * Safe for production logout and staging QA reset.
 * Does not wipe unrelated Keychain / Safari data.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { getSupabaseAuthStorageKey } from "./authStorageKeys";
import { listPendingOAuthStorageKeys } from "./pendingOAuthKeys";

export async function clearPendingOAuthClientState(): Promise<boolean> {
  let cleared = false;
  try {
    // Invalidates an in-flight ASWebAuthenticationSession when present.
    WebBrowser.dismissAuthSession();
    cleared = true;
  } catch {
    // Unavailability on some platforms — ignore.
  }

  const keys = listPendingOAuthStorageKeys(getSupabaseAuthStorageKey());
  for (const key of keys) {
    try {
      await AsyncStorage.removeItem(key);
      cleared = true;
    } catch {
      // ignore
    }
    try {
      await SecureStore.deleteItemAsync(key);
      cleared = true;
    } catch {
      // Key may not exist — ignore.
    }
  }
  return cleared;
}
