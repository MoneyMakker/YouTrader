import assert from "node:assert/strict";
import type { AsyncKeyValueStore } from "../../src/auth/sessionStorageAdapter";

class MemoryStore implements AsyncKeyValueStore {
  readonly values = new Map<string, string>();
  failSet = false;
  failRemove = false;

  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failSet) throw new Error("set failed");
    this.values.set(key, value);
  }
  async removeItem(key: string) {
    if (this.failRemove) throw new Error("remove failed");
    this.values.delete(key);
  }
}

async function run() {
  const { createMigratingSessionStorage } = await import(
    new URL("../../src/auth/sessionStorageAdapter.ts", import.meta.url).href
  );
  const secure = new MemoryStore();
  const legacy = new MemoryStore();
  const storage = createMigratingSessionStorage(secure, legacy);
  const sessionKey = "sb-project-auth-token";

  legacy.values.set(sessionKey, "legacy-session");
  assert.equal(await storage.getItem(sessionKey), "legacy-session", "restores the legacy session");
  assert.equal(secure.values.get(sessionKey), "legacy-session", "migrates to secure storage");
  assert.equal(legacy.values.has(sessionKey), false, "deletes legacy data after a successful migration");

  const failedSecure = new MemoryStore();
  const failedLegacy = new MemoryStore();
  failedSecure.failSet = true;
  failedLegacy.values.set(sessionKey, "legacy-session");
  const failedStorage = createMigratingSessionStorage(failedSecure, failedLegacy);
  assert.equal(await failedStorage.getItem(sessionKey), "legacy-session", "preserves restore behavior when migration fails");
  assert.equal(failedLegacy.values.get(sessionKey), "legacy-session", "does not delete legacy data after failed migration");

  await storage.setItem(sessionKey, "user-a-session");
  await storage.setItem(sessionKey, "user-b-session");
  assert.equal(await storage.getItem(sessionKey), "user-b-session", "does not retain a previous user session");

  legacy.values.set(sessionKey, "stale-legacy-session");
  await storage.removeItem(sessionKey);
  assert.equal(await secure.getItem(sessionKey), null, "logout clears secure storage");
  assert.equal(await legacy.getItem(sessionKey), null, "logout clears legacy storage");
}

void run().then(() => console.log("session-storage QA passed"));
