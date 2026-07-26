export type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Auth storage backed by the platform secure store with a one-time, fail-safe
 * migration from the historical AsyncStorage key. Never remove the legacy
 * value until the secure write has completed.
 */
export function createMigratingSessionStorage(
  secureStore: AsyncKeyValueStore,
  legacyStore: AsyncKeyValueStore,
) {
  return {
    async getItem(key: string): Promise<string | null> {
      const secureValue = await secureStore.getItem(key);
      if (secureValue != null) return secureValue;

      const legacyValue = await legacyStore.getItem(key);
      if (legacyValue == null) return null;

      try {
        await secureStore.setItem(key, legacyValue);
        await legacyStore.removeItem(key);
      } catch {
        // Keep the legacy session intact if migration cannot complete. This
        // preserves sign-in behavior while allowing a later secure retry.
      }
      return legacyValue;
    },

    async setItem(key: string, value: string): Promise<void> {
      await secureStore.setItem(key, value);
      // A successful sign-in replaces any previous legacy session. Deletion is
      // best-effort because the secure value is already authoritative.
      try {
        await legacyStore.removeItem(key);
      } catch {
        // Do not fail a successful secure session write because stale legacy
        // cleanup is unavailable; getItem will prefer the secure value.
      }
    },

    async removeItem(key: string): Promise<void> {
      const results = await Promise.allSettled([
        secureStore.removeItem(key),
        legacyStore.removeItem(key),
      ]);
      if (results.every((result) => result.status === "rejected")) {
        throw new Error("Unable to clear persisted session.");
      }
    },
  } satisfies AsyncKeyValueStore;
}
