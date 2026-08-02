import assert from "node:assert/strict";
import { buildChallengeTimeline } from "../src/propPass/tradingOs";
const events = buildChallengeTimeline([{ type: "breached", occurredAt: "2026-08-02T12:00:00Z", accountId: "a", ruleId: "daily_loss", tradeId: "t", plannedRiskMinor: 100, actualRiskMinor: 200, snapshot: { equityMinor: 1, balanceMinor: 1 }, bufferBeforeMinor: 10, bufferAfterMinor: -1 }, { type: "challenge_started", occurredAt: "2026-08-01T12:00:00Z", accountId: "a", snapshot: { equityMinor: 1, balanceMinor: 1 } }]);
assert.equal(events[0].type, "challenge_started"); assert.match(events[1].explanation, /daily_loss/); assert.ok(events[1].actionableImprovement);
console.log("prop-pass-timeline-qa: PASS");
