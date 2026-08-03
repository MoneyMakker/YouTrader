import assert from "node:assert/strict";
import {
  hashLocalAiInput,
  isLocalAiCacheKeyForUser,
  localAiCacheKey,
  LOCAL_AI_CACHE_PREFIX,
  parseLocalAiCacheEntry,
} from "../src/utils/localAiResponseCache";
import { shouldClearLocalUserCacheKey } from "../src/auth/userCache";

function section(name: string) {
  console.log(`\n[local-ai-cache-qa] ${name}`);
}

section("hashLocalAiInput is stable and order-independent for objects");
{
  const a = hashLocalAiInput({ b: 2, a: 1 });
  const b = hashLocalAiInput({ a: 1, b: 2 });
  const c = hashLocalAiInput({ a: 1, b: 3 });
  assert.equal(a, b);
  assert.notEqual(a, c);
}

section("localAiCacheKey is user-scoped and sanitizes feature colons");
{
  const key = localAiCacheKey("trade:vision", "user-A", "abc");
  assert.equal(key, `${LOCAL_AI_CACHE_PREFIX}:trade_vision:user-A:abc`);
  assert.equal(localAiCacheKey("news", null, "xyz").includes(":local:"), true);
}

section("parseLocalAiCacheEntry TTL / corrupt JSON");
{
  const now = 1_000_000;
  const valid = JSON.stringify({ expiresAt: now + 1, value: { ok: true } });
  const expired = JSON.stringify({ expiresAt: now, value: { ok: true } });
  assert.deepEqual(parseLocalAiCacheEntry<{ ok: boolean }>(valid, now), { ok: true, value: { ok: true } });
  assert.deepEqual(parseLocalAiCacheEntry(expired, now), { ok: false, reason: "expired" });
  assert.deepEqual(parseLocalAiCacheEntry("{not-json", now), { ok: false, reason: "invalid" });
  assert.deepEqual(parseLocalAiCacheEntry(JSON.stringify({ expiresAt: "soon", value: 1 }), now), {
    ok: false,
    reason: "invalid",
  });
  assert.deepEqual(parseLocalAiCacheEntry(JSON.stringify({ expiresAt: now + 1 }), now), {
    ok: false,
    reason: "invalid",
  });
}

section("isLocalAiCacheKeyForUser rejects other users and malformed keys");
{
  const mine = localAiCacheKey("assistant-dailyPlan", "user-A", "h1");
  const theirs = localAiCacheKey("assistant-dailyPlan", "user-B", "h1");
  assert.equal(isLocalAiCacheKeyForUser(mine, "user-A"), true);
  assert.equal(isLocalAiCacheKeyForUser(theirs, "user-A"), false);
  assert.equal(isLocalAiCacheKeyForUser("unrelated", "user-A"), false);
  assert.equal(isLocalAiCacheKeyForUser(`${LOCAL_AI_CACHE_PREFIX}:only-two`, "user-A"), false);
}

section("shouldClearLocalUserCacheKey never uses over-broad userId includes");
{
  const userA = "user-A";
  const aiMine = localAiCacheKey("trade-vision", userA, "img1");
  const aiTheirs = localAiCacheKey("trade-vision", "user-B", "img1");
  const decoy = `notes:about:${userA}:elsewhere`;
  const trades = `trades-v7:${userA}`;
  const prefs = `user-preferences-v1:${userA}`;
  const usage = `usage:share-cards:${userA}:2026-07`;

  assert.equal(shouldClearLocalUserCacheKey(aiMine, userA), true);
  assert.equal(shouldClearLocalUserCacheKey(aiTheirs, userA), false);
  assert.equal(shouldClearLocalUserCacheKey(decoy, userA), false);
  assert.equal(shouldClearLocalUserCacheKey(trades, userA), true);
  assert.equal(shouldClearLocalUserCacheKey(prefs, userA), true);
  // User-scoped usage counters clear on logout to prevent account crossover.
  assert.equal(shouldClearLocalUserCacheKey(usage, userA), true);
  assert.equal(shouldClearLocalUserCacheKey(`usage:share-cards:user-B:2026-07`, userA), false);

  assert.equal(shouldClearLocalUserCacheKey(aiMine, null), true);
  assert.equal(shouldClearLocalUserCacheKey(decoy, null), false);
}

console.log("\n[local-ai-cache-qa] PASS");
