/**
 * Prop Pass presentation + money formatting selftest.
 * Run: npx tsx scripts/qa/propPassPresentation.selftest.ts
 */
import assert from "node:assert/strict";
import {
  formatPropMoney,
  minorToMajor,
} from "../../src/propPass/formatMoney";
import {
  bufferUsedMinor,
  bufferUsedPercent,
  humanAccountTitle,
  looksLikeUuid,
  mapBufferDisplayStatus,
  mapChallengeHeroStatus,
  mapReadinessLabel,
  progressPercent,
  sanitizeDisplayLabel,
  tradesNeededForInsights,
} from "../../src/propPass/presentation";
import type { PropPassViewModel } from "../../src/propPass/types";

function baseModel(over: Partial<PropPassViewModel> = {}): PropPassViewModel {
  return {
    account: {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "fixture_apex_50k",
      firmName: "Apex",
      accountSize: { minor: 5000000, currency: "USD" },
      lifecycleStatus: "active",
    },
    challenge: {
      id: "22222222-2222-4222-8222-222222222222",
      attemptNumber: 1,
      status: "active",
      startedAt: "2026-07-01T00:00:00.000Z",
    },
    historicalAttempts: [],
    assignedTradeCount: 5,
    progress: {
      currentBalance: { minor: 5125000, currency: "USD" },
      profitTarget: { minor: 300000, currency: "USD" },
      profitRemaining: { minor: 175000, currency: "USD" },
    },
    buffers: {
      dailyLoss: {
        id: "daily_loss",
        labelKey: "propPass.buffer.dailyLoss",
        remainingMinor: 78000,
        limitMinor: 100000,
        status: "ok",
        ratio: 0.78,
        limitations: [],
        accessibilityKey: "propPass.a11y.bufferStatus",
      },
      trailingDrawdown: {
        id: "trailing_drawdown",
        labelKey: "propPass.buffer.trailingDrawdown",
        remainingMinor: 142000,
        limitMinor: 200000,
        status: "ok",
        ratio: 0.71,
        limitations: [],
        accessibilityKey: "propPass.a11y.bufferStatus",
      },
      totalLoss: {
        id: "total_loss",
        labelKey: "propPass.buffer.totalLoss",
        remainingMinor: 142000,
        limitMinor: 200000,
        status: "ok",
        ratio: 0.71,
        limitations: [],
        accessibilityKey: "propPass.a11y.bufferStatus",
      },
    },
    readiness: {
      score: 72,
      confidence: "high",
      reasonCodes: [],
      lifecycleOverride: false,
    },
    dataQuality: { status: "ok", limitations: [] },
    freshness: { status: "current", calculatedAt: new Date().toISOString() },
    ...over,
  };
}

assert.equal(minorToMajor(5100000), 51000);
assert.equal(formatPropMoney(5100000), "$51,000.00");
assert.equal(formatPropMoney(-22000), "-$220.00");
assert.equal(formatPropMoney(0), "$0.00");
assert.equal(formatPropMoney(null), "—");

const healthy = baseModel();
assert.equal(mapChallengeHeroStatus(healthy), "on_track");
assert.equal(mapReadinessLabel(healthy), "high");
assert.equal(progressPercent(healthy), 42);
assert.ok(humanAccountTitle(healthy).includes("Apex"));
assert.ok(!looksLikeUuid(humanAccountTitle(healthy)));
assert.equal(sanitizeDisplayLabel("fixture_apex"), null);
assert.equal(sanitizeDisplayLabel("11111111-1111-4111-8111-111111111111"), null);

const caution = baseModel({
  buffers: {
    ...healthy.buffers,
    dailyLoss: { ...healthy.buffers.dailyLoss!, status: "warn", remainingMinor: 24000, ratio: 0.24 },
  },
});
assert.equal(mapChallengeHeroStatus(caution), "caution");
assert.equal(mapBufferDisplayStatus(caution.buffers.dailyLoss), "caution");

const danger = baseModel({
  buffers: {
    ...healthy.buffers,
    dailyLoss: { ...healthy.buffers.dailyLoss!, status: "hard", remainingMinor: 8000, ratio: 0.08 },
  },
});
assert.equal(mapChallengeHeroStatus(danger), "at_risk");
assert.equal(mapBufferDisplayStatus(danger.buffers.dailyLoss), "danger");
assert.equal(bufferUsedMinor(danger.buffers.dailyLoss), 92000);
assert.equal(bufferUsedPercent(danger.buffers.dailyLoss), 92);

const violated = baseModel({
  challenge: { ...healthy.challenge, status: "breached" },
  readiness: { ...healthy.readiness, lifecycleOverride: true, score: null },
});
assert.equal(mapChallengeHeroStatus(violated), "violated");
assert.equal(mapReadinessLabel(violated), "more_data_needed");

const insufficient = baseModel({
  assignedTradeCount: 1,
  progress: {},
  buffers: {},
  readiness: { score: null, confidence: "unknown", reasonCodes: [], lifecycleOverride: false },
});
assert.equal(mapChallengeHeroStatus(insufficient), "insufficient_data");
assert.equal(mapReadinessLabel(insufficient), "more_data_needed");
assert.equal(tradesNeededForInsights(1), 2);

assert.ok(!/minor/i.test(formatPropMoney(12500)));
assert.ok(!humanAccountTitle(healthy).includes("11111111"));

console.log("propPassPresentation.selftest PASS");
