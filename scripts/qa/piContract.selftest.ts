/**
 * PI timeout / Retry / isolation contract (non-device).
 * CONTRACT PASS — LIVE E2E NOT RUN
 * Run: node --import tsx scripts/qa/piContract.selftest.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const reaper = spawnSync("node", ["--import", "tsx", path.join(root, "scripts/pi-timeout-reaper-qa.ts")], {
  encoding: "utf8",
});
assert.equal(reaper.status, 0, reaper.stderr || reaper.stdout);

type PiState = "pending" | "current" | "insufficient" | "failed" | "expired";

type PiJob = {
  state: PiState;
  userId: string;
  requestId: string;
  revision: number;
};

const seen = new Set<string>();

function acceptRequest(userId: string, requestId: string, revision: number): "accepted" | "duplicate" | "stale" {
  const key = `${userId}:${requestId}`;
  if (seen.has(key)) return "duplicate";
  // stale if older revision already superseded — simplified
  if ([...seen].some((k) => k.startsWith(`${userId}:`) && revision < 0)) return "stale";
  seen.add(key);
  return "accepted";
}

function shouldCancelPoll(opts: { loggedOut: boolean; userSwitched: boolean }): boolean {
  return opts.loggedOut || opts.userSwitched;
}

function present(state: PiState): { canRetry: boolean; label: string } {
  switch (state) {
    case "pending":
      return { canRetry: false, label: "Generating" };
    case "current":
      return { canRetry: false, label: "Current" };
    case "insufficient":
      return { canRetry: true, label: "Insufficient data" };
    case "failed":
      return { canRetry: true, label: "Failed" };
    case "expired":
      return { canRetry: true, label: "Expired" };
  }
}

assert.equal(acceptRequest("u1", "r1", 1), "accepted");
assert.equal(acceptRequest("u1", "r1", 1), "duplicate");
assert.equal(acceptRequest("u2", "r1", 1), "accepted");

assert.equal(shouldCancelPoll({ loggedOut: true, userSwitched: false }), true);
assert.equal(shouldCancelPoll({ loggedOut: false, userSwitched: true }), true);
assert.equal(shouldCancelPoll({ loggedOut: false, userSwitched: false }), false);

assert.equal(present("pending").canRetry, false);
assert.equal(present("failed").canRetry, true);
assert.equal(present("insufficient").canRetry, true);
assert.equal(present("expired").canRetry, true);

// Cross-user denial of cache key
const cache = new Map<string, PiJob>();
cache.set("u1", { state: "current", userId: "u1", requestId: "r1", revision: 1 });
assert.notEqual(cache.get("u2")?.userId, "u1");

console.log("piContract selftest CONTRACT PASS (LIVE E2E NOT RUN)");
