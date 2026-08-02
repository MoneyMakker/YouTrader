import assert from "node:assert/strict";
import { evaluatePositionSizeProgression } from "../src/propPass/tradingOs";
const base = { previousStage: "base" as const, allowedContracts: 2, allowedRiskPerTradeMinor: 10_000, recoveryModeActive: false, killSwitchActive: false, reducedRiskRequired: false, scalingEligible: true, scaleAlreadyApplied: false, occurredAt: "2026-08-02T15:00:00.000Z", relatedRuleId: "scaling_rule" };
const eligible = evaluatePositionSizeProgression(base); assert.equal(eligible.values.stage, "eligible_to_scale"); assert.equal(eligible.values.transition?.newStage, "eligible_to_scale");
const recovery = evaluatePositionSizeProgression({ ...base, recoveryModeActive: true, allowedContracts: 1, allowedRiskPerTradeMinor: 5_000 }); assert.equal(recovery.values.stage, "recovery");
const locked = evaluatePositionSizeProgression({ ...base, killSwitchActive: true, allowedContracts: 0, allowedRiskPerTradeMinor: 0 }); assert.equal(locked.status, "stop_trading"); assert.equal(locked.values.stage, "locked");
const unchanged = evaluatePositionSizeProgression({ ...base, previousStage: "eligible_to_scale" }); assert.equal(unchanged.values.transition, null);
