import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createMigratingSessionStorage } from "./sessionStorageAdapter";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/** Supabase-compatible storage with secure persistence and legacy migration. */
export const secureSessionStorage = createMigratingSessionStorage(
  secureStoreAdapter,
  AsyncStorage,
);
