import assert from "node:assert/strict";
import { calculateTradingTimeContext, TradingTimeError, type TradingTimeConfiguration } from "../src/propOs/index";

const futures: TradingTimeConfiguration = {
  accountTimezone: "America/New_York",
  exchangeTimezone: "America/New_York",
  tradingDayBoundaryMinute: 18 * 60,
  tradingDayLabelOffsetDays: 1,
  weekStartsOn: 1,
  weekendWeekdays: [6],
  marketHolidayTradingDays: [],
  sessions: [{ id: "overnight", label: "Overnight", startMinute: 18 * 60, endMinute: 17 * 60, startWeekdays: [0, 1, 2, 3, 4] }],
  cutoffMinute: null,
  ambiguousTimePolicy: "earlier",
};

const sundayOpen = calculateTradingTimeContext({ nowUtc: "2026-03-08T22:30:00.000Z", configuration: futures, manualSessionLockActive: false });
assert.equal(sundayOpen.tradingDayId, "2026-03-09");
assert.equal(sundayOpen.sessionId, "overnight");
assert.equal(sundayOpen.sessionStatus, "open");
assert.equal(sundayOpen.currentTradingDayStartUtc, "2026-03-08T22:00:00.000Z");

const beforeBoundary = calculateTradingTimeContext({ nowUtc: "2026-03-09T21:59:00.000Z", configuration: futures, manualSessionLockActive: false });
assert.equal(beforeBoundary.tradingDayId, "2026-03-09");
const afterBoundary = calculateTradingTimeContext({ nowUtc: "2026-03-09T22:01:00.000Z", configuration: futures, previousTradingDayId: "2026-03-09", previousWeekStartTradingDayId: "2026-03-09", manualSessionLockActive: false });
assert.equal(afterBoundary.tradingDayId, "2026-03-10");
assert.equal(afterBoundary.dailyResetDue, true);
assert.equal(afterBoundary.weeklyResetDue, false);

const midnight: TradingTimeConfiguration = {
  ...futures,
  tradingDayBoundaryMinute: 0,
  tradingDayLabelOffsetDays: 0,
  weekStartsOn: 0,
  weekendWeekdays: [],
  sessions: [{ id: "all-day", label: "All day", startMinute: 0, endMinute: 1_439, startWeekdays: [0, 1, 2, 3, 4, 5, 6] }],
};
const spring = calculateTradingTimeContext({ nowUtc: "2026-03-08T06:30:00.000Z", configuration: midnight, manualSessionLockActive: false });
assert.equal(Date.parse(spring.currentTradingDayEndUtc) - Date.parse(spring.currentTradingDayStartUtc), 23 * 60 * 60 * 1_000);
const fall = calculateTradingTimeContext({ nowUtc: "2026-11-01T05:30:00.000Z", configuration: midnight, manualSessionLockActive: false });
assert.equal(Date.parse(fall.currentTradingDayEndUtc) - Date.parse(fall.currentTradingDayStartUtc), 25 * 60 * 60 * 1_000);

const ambiguousBase: TradingTimeConfiguration = { ...midnight, tradingDayBoundaryMinute: 90 };
const earlier = calculateTradingTimeContext({ nowUtc: "2026-11-01T07:00:00.000Z", configuration: { ...ambiguousBase, ambiguousTimePolicy: "earlier" }, manualSessionLockActive: false });
const later = calculateTradingTimeContext({ nowUtc: "2026-11-01T07:00:00.000Z", configuration: { ...ambiguousBase, ambiguousTimePolicy: "later" }, manualSessionLockActive: false });
assert.equal(Date.parse(later.currentTradingDayStartUtc) - Date.parse(earlier.currentTradingDayStartUtc), 60 * 60 * 1_000);

const holiday = calculateTradingTimeContext({ nowUtc: "2026-03-09T15:00:00.000Z", configuration: { ...midnight, marketHolidayTradingDays: ["2026-03-09"] }, manualSessionLockActive: false });
assert.equal(holiday.sessionStatus, "holiday");
assert.equal(holiday.insideAllowedSession, false);
const cutoff = calculateTradingTimeContext({ nowUtc: "2026-03-09T20:00:00.000Z", configuration: { ...midnight, cutoffMinute: 15 * 60 }, manualSessionLockActive: false });
assert.equal(cutoff.sessionStatus, "cutoff");
const locked = calculateTradingTimeContext({ nowUtc: "2026-03-09T15:00:00.000Z", configuration: midnight, manualSessionLockActive: true });
assert.equal(locked.sessionStatus, "manual_lock");

assert.throws(
  () => calculateTradingTimeContext({ nowUtc: "2026-03-08T07:30:00.000Z", configuration: { ...midnight, tradingDayBoundaryMinute: 150 }, manualSessionLockActive: false }),
  (error) => error instanceof TradingTimeError && error.code === "nonexistent_local_time",
);

console.log("prop-pass-trading-time-qa: PASS");
