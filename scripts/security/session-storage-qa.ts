import assert from "node:assert/strict";
import type { AsyncKeyValueStore } from "../../src/auth/sessionStorageAdapter";

class MemoryStore implements AsyncKeyValueStore {
  readonly values = new Map<string, string>();
  failGet = false;
  failSet = false;
  failRemove = false;

  async getItem(key: string) {
    if (this.failGet) throw new Error("get failed");
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    if (this.failSet) throw new Error("set failed");
    this.values.set(key, value);
  }
  async removeItem(key: string) {
    if (this.failRemove) throw new Error("remove failed");
    this.values.delete(key);
  }
}

function session(userId: string): string {
  return JSON.stringify({ access_token: `access-${userId}`, refresh_token: `refresh-${userId}` });
}

async function run() {
  const { createMigratingSessionStorage } = await import(
    new URL("../../src/auth/sessionStorageAdapter.ts", import.meta.url).href
  );
  const secure = new MemoryStore();
  const legacy = new MemoryStore();
  const storage = createMigratingSessionStorage(secure, legacy);
  const sessionKey = "sb-project-auth-token";

  const legacySession = session("legacy");
  legacy.values.set(sessionKey, legacySession);
  assert.equal(await storage.getItem(sessionKey), legacySession, "restores the legacy session");
  assert.equal(secure.values.get(sessionKey), legacySession, "migrates to secure storage");
  assert.equal(legacy.values.has(sessionKey), false, "deletes legacy data after a successful migration");

  const failedSecure = new MemoryStore();
  const failedLegacy = new MemoryStore();
  failedSecure.failSet = true;
  failedLegacy.values.set(sessionKey, legacySession);
  const failedStorage = createMigratingSessionStorage(failedSecure, failedLegacy);
  assert.equal(await failedStorage.getItem(sessionKey), legacySession, "preserves restore behavior when migration fails");
  assert.equal(failedLegacy.values.get(sessionKey), legacySession, "does not delete legacy data after failed migration");

  await storage.setItem(sessionKey, session("user-a"));
  await storage.setItem(sessionKey, session("user-b"));
  assert.equal(await storage.getItem(sessionKey), session("user-b"), "does not retain a previous user session");

  legacy.values.set(sessionKey, session("stale"));
  await storage.removeItem(sessionKey);
  assert.equal(await secure.getItem(sessionKey), null, "logout clears secure storage");
  assert.equal(await legacy.getItem(sessionKey), null, "logout clears legacy storage");

  const partialSecure = new MemoryStore();
  const partialLegacy = new MemoryStore();
  const partialStorage = createMigratingSessionStorage(partialSecure, partialLegacy);
  const staleSession = session("stale-after-logout");
  partialSecure.values.set(sessionKey, session("current"));
  partialLegacy.values.set(sessionKey, staleSession);
  partialLegacy.failRemove = true;
  await assert.rejects(
    partialStorage.removeItem(sessionKey),
    /Unable to clear persisted session/,
    "a partial logout failure is reported",
  );
  assert.equal(await partialSecure.getItem(sessionKey), null, "partial logout still clears SecureStore");
  partialLegacy.failRemove = false;
  const relaunchedStorage = createMigratingSessionStorage(partialSecure, partialLegacy);
  assert.equal(
    await relaunchedStorage.getItem(sessionKey),
    null,
    "an app relaunch cannot restore a legacy session after a partial logout failure",
  );
  assert.equal(partialLegacy.values.get(sessionKey), staleSession, "legacy data remains untouched until cleanup succeeds");

  const unreadableSecure = new MemoryStore();
  const unreadableLegacy = new MemoryStore();
  unreadableLegacy.values.set(sessionKey, legacySession);
  unreadableSecure.failGet = true;
  assert.equal(
    await createMigratingSessionStorage(unreadableSecure, unreadableLegacy).getItem(sessionKey),
    null,
    "a SecureStore read failure fails closed without restoring legacy storage",
  );
  assert.equal(unreadableLegacy.values.get(sessionKey), legacySession, "a SecureStore failure does not mutate legacy data");

  const corruptedSecure = new MemoryStore();
  const corruptedLegacy = new MemoryStore();
  corruptedSecure.values.set(sessionKey, "not-a-session");
  corruptedLegacy.values.set(sessionKey, legacySession);
  assert.equal(
    await createMigratingSessionStorage(corruptedSecure, corruptedLegacy).getItem(sessionKey),
    null,
    "a corrupted secure session is not returned or replaced with legacy data",
  );
  assert.equal(corruptedSecure.values.has(sessionKey), false, "a corrupted secure value is removed when possible");
  assert.equal(corruptedLegacy.values.get(sessionKey), legacySession, "corruption does not mutate the legacy value");

  const malformedLegacy = new MemoryStore();
  malformedLegacy.values.set(sessionKey, "not-a-session");
  assert.equal(
    await createMigratingSessionStorage(new MemoryStore(), malformedLegacy).getItem(sessionKey),
    null,
    "a malformed legacy value is never migrated",
  );
}

void run().then(() => console.log("session-storage QA passed"));
