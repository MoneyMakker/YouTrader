export function safeDateFromISO(value?: string) {
  const raw = typeof value === "string" ? value.slice(0, 10) : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return new Date();
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m, d, 12, 0, 0));
  return Number.isFinite(dt.getTime()) ? dt : new Date();
}
export function nyNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((x) => x.type === type)?.value || 0);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");
  const dt = new Date(y, Math.max(0, m - 1), d, hh, mm, ss);
  return Number.isFinite(dt.getTime()) ? dt : new Date();
}
export function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((x) => x.type === "year")?.value || "2026";
  const m = parts.find((x) => x.type === "month")?.value || "01";
  const d = parts.find((x) => x.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}
export function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
export function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
export function safeText(value: string, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
export function normalizeTradeClock(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return "";
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
export function formatClockFromDate(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function tradeTimestampFromClock(dateISO: string, clock?: string | null) {
  const safeClock = normalizeTradeClock(clock) || "12:00";
  const parsed = new Date(`${dateISO}T${safeClock}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : safeDateFromISO(dateISO).getTime();
}
