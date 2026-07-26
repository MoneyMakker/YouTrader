export type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const LEGACY_MIGRATION_BLOCK_SUFFIX = ".legacy-migration-blocked";

function legacyMigrationBlockKey(key: string): string {
  return `${key}${LEGACY_MIGRATION_BLOCK_SUFFIX}`;
}

/** Supabase persists a JSON session with both tokens. Invalid values are never restored. */
function isValidSessionValue(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;

    const session = parsed as { access_token?: unknown; refresh_token?: unknown };
    return typeof session.access_token === "string" && session.access_token.length > 0
      && typeof session.refresh_token === "string" && session.refresh_token.length > 0;
  } catch {
    return false;
  }
}

/**
 * Auth storage backed by the platform secure store with a one-time, fail-safe
 * migration from the historical AsyncStorage key. Never remove the legacy
 * value until the secure write has completed.
 */
export function createMigratingSessionStorage(
  secureStore: AsyncKeyValueStore,
  legacyStore: AsyncKeyValueStore,
) {
  let operation = Promise.resolve();

  const exclusively = async <T>(callback: () => Promise<T>): Promise<T> => {
    const previous = operation;
    let release!: () => void;
    operation = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  };

  return {
    async getItem(key: string): Promise<string | null> {
      return exclusively(async () => {
        let secureValue: string | null;
        try {
          secureValue = await secureStore.getItem(key);
        } catch {
          // Do not fall back to less-protected legacy storage when SecureStore
          // is unavailable: that could revive a session after logout.
          return null;
        }
        if (secureValue != null) {
          if (isValidSessionValue(secureValue)) return secureValue;
          try { await secureStore.removeItem(key); } catch { /* best effort */ }
          return null;
        }

        try {
          if (await secureStore.getItem(legacyMigrationBlockKey(key)) != null) return null;
        } catch {
          return null;
        }

        let legacyValue: string | null;
        try {
          legacyValue = await legacyStore.getItem(key);
        } catch {
          return null;
        }
        if (legacyValue == null || !isValidSessionValue(legacyValue)) return null;

        try {
          await secureStore.setItem(key, legacyValue);
          await legacyStore.removeItem(key);
        } catch {
          // Keep the legacy session intact if migration cannot complete. This
          // preserves sign-in behavior while allowing a later secure retry.
        }
        return legacyValue;
      });
    },

    async setItem(key: string, value: string): Promise<void> {
      await exclusively(async () => {
        await secureStore.setItem(key, value);
        // A successful sign-in replaces any previous legacy session. Deletion is
        // best-effort because the secure value is already authoritative.
        try {
          await legacyStore.removeItem(key);
        } catch {
          // Do not fail a successful secure session write because stale legacy
          // cleanup is unavailable; getItem will prefer the secure value.
        }
        try {
          await secureStore.removeItem(legacyMigrationBlockKey(key));
        } catch {
          // A stale marker only blocks legacy fallback; it cannot invalidate
          // the newly written SecureStore session.
        }
      });
    },

    async removeItem(key: string): Promise<void> {
      await exclusively(async () => {
        // Write this before deleting the secure session. If legacy cleanup then
        // fails, a future launch cannot re-migrate the old AsyncStorage value.
        await secureStore.setItem(legacyMigrationBlockKey(key), "1");
        const results = await Promise.allSettled([
          secureStore.removeItem(key),
          legacyStore.removeItem(key),
        ]);
        if (results.some((result) => result.status === "rejected")) {
          throw new Error("Unable to clear persisted session.");
        }
        await secureStore.removeItem(legacyMigrationBlockKey(key));
      });
    },
  } satisfies AsyncKeyValueStore;
}
