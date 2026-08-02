/**
 * Prop OS domain package (Phase 1B — Production Domain Engine).
 *
 * Pure calculation only. Do NOT import from App / UI / Supabase / AI / RevenueCat.
 * App production screens must not import this package until Phase 1E activation gate.
 */
export type * from "./types";
export { sortAccountingEvents, compareAccountingEvents, inputRevision } from "./eventOrder";
export { addLocalDays, tradingDayId, tradingDayIdAtMinute, zonedParts } from "./tradingDay";
export { calculateTradingTimeContext, TradingTimeError } from "./tradingTime";
export type { TradingSessionRule, TradingTimeConfiguration, TradingTimeContext, TradingTimeInput } from "./tradingTime";
export {
  calculateChallenge,
  publicReadinessScore,
  type EngineInput,
} from "./engine";
/** @deprecated alias — identical to calculateChallenge */
export { replayChallenge, type ReplayInput } from "./replay";
export {
  SCORE_DELTA_RECONCILIATION_TOLERANCE,
  buildScoreDeltaDrivers,
  assertDriversReconcileDelta,
} from "./scoreDrivers";
export {
  confidenceFromTradeCount,
  confidenceForRuleBuffers,
  confidenceForEdgeInsight,
} from "./confidence";
export { PROP_OS_FIXTURES } from "./fixtures/index";
export type { PropOsFixture } from "./fixtures/index";
