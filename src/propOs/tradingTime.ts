import { addLocalDays, formatLocalDate, tradingDayIdAtMinute, zonedParts, type ZonedParts } from "./tradingDay";

export type TradingSessionRule = Readonly<{
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
  /** 0 = Sunday through 6 = Saturday; evaluated on the session start date. */
  startWeekdays: number[];
}>;

export type TradingTimeConfiguration = Readonly<{
  accountTimezone: string;
  exchangeTimezone: string;
  tradingDayBoundaryMinute: number;
  tradingDayLabelOffsetDays: number;
  weekStartsOn: number;
  weekendWeekdays: number[];
  marketHolidayTradingDays: string[];
  sessions: TradingSessionRule[];
  cutoffMinute: number | null;
  ambiguousTimePolicy: "earlier" | "later";
}>;

export type TradingTimeInput = Readonly<{
  nowUtc: string;
  configuration: TradingTimeConfiguration;
  previousTradingDayId?: string | null;
  previousWeekStartTradingDayId?: string | null;
  manualSessionLockActive: boolean;
}>;

export type TradingTimeContext = Readonly<{
  tradingDayId: string;
  sessionId: string | null;
  sessionStatus: "open" | "outside_session" | "weekend" | "holiday" | "cutoff" | "manual_lock";
  currentTradingDayStartUtc: string;
  currentTradingDayEndUtc: string;
  currentWeekStartUtc: string;
  currentWeekEndUtc: string;
  weekStartTradingDayId: string;
  currentMinuteLocal: number;
  insideAllowedSession: boolean;
  dailyResetDue: boolean;
  weeklyResetDue: boolean;
  cutoffReached: boolean;
  manualSessionLockActive: boolean;
  accountTimezone: string;
  exchangeTimezone: string;
}>;

export class TradingTimeError extends Error {
  constructor(readonly code: "invalid_configuration" | "invalid_timestamp" | "nonexistent_local_time") {
    super(code);
    this.name = "TradingTimeError";
  }
}

/** Canonical futures trading-day/session calculation; device timezone is never read. */
export function calculateTradingTimeContext(input: TradingTimeInput): TradingTimeContext {
  validate(input);
  const config = input.configuration;
  const now = zonedParts(input.nowUtc, config.exchangeTimezone);
  const minute = now.hour * 60 + now.minute;
  const tradingDayId = tradingDayIdAtMinute(input.nowUtc, config.exchangeTimezone, config.tradingDayBoundaryMinute, config.tradingDayLabelOffsetDays);
  const anchorDate = addLocalDays(tradingDayId, -config.tradingDayLabelOffsetDays);
  const tradingDayStart = localBoundaryToUtc(anchorDate, config.tradingDayBoundaryMinute, config.exchangeTimezone, config.ambiguousTimePolicy);
  const tradingDayEnd = localBoundaryToUtc(addLocalDays(anchorDate, 1), config.tradingDayBoundaryMinute, config.exchangeTimezone, config.ambiguousTimePolicy);
  const tradingDayWeekday = weekday(tradingDayId);
  const weekDelta = (tradingDayWeekday - config.weekStartsOn + 7) % 7;
  const weekStartTradingDayId = addLocalDays(tradingDayId, -weekDelta);
  const weekStartAnchor = addLocalDays(weekStartTradingDayId, -config.tradingDayLabelOffsetDays);
  const weekEndTradingDayId = addLocalDays(weekStartTradingDayId, 7);
  const weekEndAnchor = addLocalDays(weekEndTradingDayId, -config.tradingDayLabelOffsetDays);
  const currentWeekStartUtc = localBoundaryToUtc(weekStartAnchor, config.tradingDayBoundaryMinute, config.exchangeTimezone, config.ambiguousTimePolicy);
  const currentWeekEndUtc = localBoundaryToUtc(weekEndAnchor, config.tradingDayBoundaryMinute, config.exchangeTimezone, config.ambiguousTimePolicy);

  const activeSession = findActiveSession(now, config.sessions);
  const weekend = config.weekendWeekdays.includes(tradingDayWeekday);
  const holiday = config.marketHolidayTradingDays.includes(tradingDayId);
  const cutoffReached = config.cutoffMinute != null && minute >= config.cutoffMinute;
  const sessionStatus = input.manualSessionLockActive
    ? "manual_lock"
    : weekend
      ? "weekend"
      : holiday
        ? "holiday"
        : cutoffReached
          ? "cutoff"
          : activeSession
            ? "open"
            : "outside_session";

  return Object.freeze({
    tradingDayId,
    sessionId: activeSession?.id ?? null,
    sessionStatus,
    currentTradingDayStartUtc: tradingDayStart,
    currentTradingDayEndUtc: tradingDayEnd,
    currentWeekStartUtc,
    currentWeekEndUtc,
    weekStartTradingDayId,
    currentMinuteLocal: minute,
    insideAllowedSession: sessionStatus === "open",
    dailyResetDue: input.previousTradingDayId != null && input.previousTradingDayId !== tradingDayId,
    weeklyResetDue: input.previousWeekStartTradingDayId != null && input.previousWeekStartTradingDayId !== weekStartTradingDayId,
    cutoffReached,
    manualSessionLockActive: input.manualSessionLockActive,
    accountTimezone: config.accountTimezone,
    exchangeTimezone: config.exchangeTimezone,
  });
}

function findActiveSession(now: ZonedParts, sessions: TradingSessionRule[]): TradingSessionRule | null {
  const minute = now.hour * 60 + now.minute;
  const currentDate = formatLocalDate(now);
  for (const session of sessions) {
    const overnight = session.endMinute <= session.startMinute;
    const active = overnight
      ? minute >= session.startMinute || minute < session.endMinute
      : minute >= session.startMinute && minute < session.endMinute;
    if (!active) continue;
    const startDate = overnight && minute < session.endMinute ? addLocalDays(currentDate, -1) : currentDate;
    if (session.startWeekdays.includes(weekday(startDate))) return session;
  }
  return null;
}

function localBoundaryToUtc(date: string, minute: number, timezone: string, policy: "earlier" | "later"): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = { year, month, day, hour: Math.floor(minute / 60), minute: minute % 60 };
  const guess = Date.UTC(year, month - 1, day, target.hour, target.minute);
  const matches: number[] = [];
  for (let offset = -16 * 60; offset <= 16 * 60; offset += 15) {
    const candidate = guess + offset * 60_000;
    const parts = zonedParts(new Date(candidate).toISOString(), timezone);
    if (sameMinute(parts, target)) matches.push(candidate);
  }
  if (!matches.length) throw new TradingTimeError("nonexistent_local_time");
  return new Date(policy === "earlier" ? Math.min(...matches) : Math.max(...matches)).toISOString();
}

function sameMinute(left: ZonedParts, right: ZonedParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute;
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function validate(input: TradingTimeInput): void {
  if (Number.isNaN(new Date(input.nowUtc).getTime())) throw new TradingTimeError("invalid_timestamp");
  const config = input.configuration;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: config.accountTimezone }).format();
    new Intl.DateTimeFormat("en-US", { timeZone: config.exchangeTimezone }).format();
  } catch { throw new TradingTimeError("invalid_configuration"); }
  if (!validMinute(config.tradingDayBoundaryMinute) || !Number.isInteger(config.tradingDayLabelOffsetDays) || Math.abs(config.tradingDayLabelOffsetDays) > 2 || !validWeekday(config.weekStartsOn)) throw new TradingTimeError("invalid_configuration");
  if (config.cutoffMinute != null && !validMinute(config.cutoffMinute)) throw new TradingTimeError("invalid_configuration");
  if (!config.sessions.length || config.weekendWeekdays.some((day) => !validWeekday(day))) throw new TradingTimeError("invalid_configuration");
  for (const session of config.sessions) {
    if (!session.id || !validMinute(session.startMinute) || !validMinute(session.endMinute) || session.startMinute === session.endMinute || !session.startWeekdays.length || session.startWeekdays.some((day) => !validWeekday(day))) throw new TradingTimeError("invalid_configuration");
  }
}

function validMinute(value: number): boolean { return Number.isInteger(value) && value >= 0 && value < 1_440; }
function validWeekday(value: number): boolean { return Number.isInteger(value) && value >= 0 && value <= 6; }
