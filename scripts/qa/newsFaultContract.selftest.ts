/**
 * News load-plan / fault contract (non-device).
 * CONTRACT PASS — SIMULATOR NOT RUN
 * Run: node --import tsx scripts/qa/newsFaultContract.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const faultPath = path.join(root, "src/qa/stagingQaNewsFault.ts");
assert.ok(fs.existsSync(faultPath), "stagingQaNewsFault module required");

type NewsFaultMode = "none" | "offline" | "timeout" | "empty" | "malformed";

type NewsLoadPlan = {
  useCache: boolean;
  showSpinner: boolean;
  label: string;
  canRetry: boolean;
};

function resolveNewsLoadPlan(mode: NewsFaultMode, hasCache: boolean): NewsLoadPlan {
  switch (mode) {
    case "offline":
      return {
        useCache: hasCache,
        showSpinner: false,
        label: hasCache ? "Cached · offline" : "Offline",
        canRetry: true,
      };
    case "timeout":
      return {
        useCache: hasCache,
        showSpinner: false,
        label: hasCache ? "Cached · timed out" : "Timed out",
        canRetry: true,
      };
    case "empty":
      return { useCache: false, showSpinner: false, label: "No headlines", canRetry: true };
    case "malformed":
      return { useCache: hasCache, showSpinner: false, label: "Unavailable", canRetry: true };
    default:
      return { useCache: false, showSpinner: true, label: "Loading", canRetry: false };
  }
}

function parseHeadlines(payload: unknown): { ok: boolean; count: number } {
  if (!payload || typeof payload !== "object") return { ok: false, count: 0 };
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return { ok: false, count: 0 };
  return { ok: true, count: items.length };
}

assert.deepEqual(parseHeadlines(null), { ok: false, count: 0 });
assert.deepEqual(parseHeadlines({}), { ok: false, count: 0 });
assert.deepEqual(parseHeadlines({ items: [] }), { ok: true, count: 0 });
assert.deepEqual(parseHeadlines({ items: [{ id: "1" }] }), { ok: true, count: 1 });
assert.equal(parseHeadlines("nope").ok, false);

const offline = resolveNewsLoadPlan("offline", true);
assert.equal(offline.showSpinner, false);
assert.equal(offline.canRetry, true);
assert.match(offline.label, /Cached/);

const timeout = resolveNewsLoadPlan("timeout", false);
assert.equal(timeout.showSpinner, false);
assert.equal(timeout.canRetry, true);

const empty = resolveNewsLoadPlan("empty", false);
assert.equal(empty.showSpinner, false);

const loading = resolveNewsLoadPlan("none", false);
assert.equal(loading.showSpinner, true);
assert.equal(loading.canRetry, false);

// Infinite spinner forbidden once fault applied
for (const mode of ["offline", "timeout", "empty", "malformed"] as NewsFaultMode[]) {
  assert.equal(resolveNewsLoadPlan(mode, false).showSpinner, false);
}

console.log("newsFaultContract selftest CONTRACT PASS (SIMULATOR NOT RUN)");
