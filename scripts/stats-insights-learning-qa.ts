import assert from "node:assert/strict";
import { getInsightsLearningState } from "../src/stats/insightsLearning";

const empty = getInsightsLearningState({
  tradeCount: 0,
  hasRecentTrend: false,
  radarReady: false,
  hasBestEdge: false,
  hasBiggestLeak: false,
});
assert.equal(empty.isLearning, true);
assert.equal(empty.requiredTrades, 6);
assert.deepEqual(empty.targets, ["recentTrend", "performanceRadar", "bestEdge", "biggestLeak"]);

const radarPending = getInsightsLearningState({
  tradeCount: 4,
  hasRecentTrend: false,
  radarReady: false,
  hasBestEdge: false,
  hasBiggestLeak: false,
});
assert.equal(radarPending.tradeCount, 4);
assert.equal(radarPending.requiredTrades, 6);

const ready = getInsightsLearningState({
  tradeCount: 8,
  hasRecentTrend: true,
  radarReady: true,
  hasBestEdge: true,
  hasBiggestLeak: true,
});
assert.equal(ready.isLearning, false);
assert.deepEqual(ready.targets, []);

console.log("Stats insights learning QA passed.");
