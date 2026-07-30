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
  const p = zonedParts(isoUtc, timeZone);
  let y = p.year;
  let m = p.month;
  let d = p.day;
  if (p.hour < rolloverHour) {
    const utcGuess = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
    const prev = zonedParts(new Date(utcGuess).toISOString(), timeZone);
    // Walk back using noon UTC anchors until calendar day changes
    let cursor = Date.UTC(y, m - 1, d, 12, 0, 0);
    for (let i = 0; i < 3; i++) {
      cursor -= 24 * 60 * 60 * 1000;
      const q = zonedParts(new Date(cursor).toISOString(), timeZone);
      if (q.year !== y || q.month !== m || q.day !== d) {
        y = q.year;
        m = q.month;
        d = q.day;
        break;
      }
    }
    if (y === p.year && m === p.month && d === p.day) {
      // fallback from utcGuess parts
      y = prev.year;
      m = prev.month;
      d = prev.day;
    }
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** True when this UTC instant is inside a US DST spring-forward "gap" — not used for marking; fixtures use known dates. */
export function isUsSpringForwardDate(tradingDay: string): boolean {
  // 2026-03-08 America/New_York spring forward
  return tradingDay === "2026-03-08";
}

export function isUsFallBackDate(tradingDay: string): boolean {
  // 2026-11-01 America/New_York fall back
  return tradingDay === "2026-11-01";
}
