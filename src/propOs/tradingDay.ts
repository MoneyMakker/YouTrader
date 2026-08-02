/**
 * Firm trading-day helpers using IANA timezones (Intl).
 * Device local midnight must never be used as authority.
 */

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type LocalDateParts = Pick<ZonedParts, "year" | "month" | "day">;

export function zonedParts(isoUtc: string, timeZone: string): ZonedParts {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid UTC timestamp: ${isoUtc}`);
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Calendar date in TZ, optionally shifted back one day if before rollover hour. */
export function tradingDayId(
  isoUtc: string,
  timeZone: string,
  rolloverHour = 0,
): string {
  return tradingDayIdAtMinute(isoUtc, timeZone, rolloverHour * 60);
}

/** Calendar date in TZ, shifted at an exact configured wall-clock minute. */
export function tradingDayIdAtMinute(
  isoUtc: string,
  timeZone: string,
  rolloverMinute: number,
  labelOffsetDays = 0,
): string {
  if (!Number.isInteger(rolloverMinute) || rolloverMinute < 0 || rolloverMinute >= 1_440) {
    throw new Error(`Invalid trading-day boundary minute: ${rolloverMinute}`);
  }
  if (!Number.isInteger(labelOffsetDays) || Math.abs(labelOffsetDays) > 2) {
    throw new Error(`Invalid trading-day label offset: ${labelOffsetDays}`);
  }
  const p = zonedParts(isoUtc, timeZone);
  const minute = p.hour * 60 + p.minute;
  const boundaryShift = minute < rolloverMinute ? -1 : 0;
  return addLocalDays(formatLocalDate(p), boundaryShift + labelOffsetDays);
}

/** Gregorian date math is performed at UTC noon so device timezone cannot alter it. */
export function addLocalDays(date: string, days: number): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(days)) throw new Error(`Invalid local date: ${date}`);
  const instant = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days, 12));
  return `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}`;
}

export function formatLocalDate(parts: LocalDateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** US DST calendar helpers retained for deterministic fixtures; no year is hard-coded. */
export function isUsSpringForwardDate(tradingDay: string): boolean {
  return tradingDay === nthWeekdayOfMonth(Number(tradingDay.slice(0, 4)), 3, 0, 2);
}

export function isUsFallBackDate(tradingDay: string): boolean {
  return tradingDay === nthWeekdayOfMonth(Number(tradingDay.slice(0, 4)), 11, 0, 1);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): string {
  if (!Number.isInteger(year)) return "";
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const day = 1 + ((weekday - first.getUTCDay() + 7) % 7) + (occurrence - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}
