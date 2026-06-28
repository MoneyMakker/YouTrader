type Impact = "HIGH" | "MED" | "LOW";
type Asset = "ES" | "NQ" | "GOLD" | "OIL" | "BTC" | "ETH";
type Bias = "LONG" | "SHORT" | "NEUTRAL";

export type EconEventDTO = {
  id: string;
  date: string;
  time: string;
  name: string;
  impact: Impact;
  actual: string;
  forecast: string;
  previous: string;
  bias: Record<Asset, Bias>;
};

type FinnhubEconomicRow = {
  event?: string;
  country?: string;
  time?: string;
  impact?: string;
  actual?: number | string | null;
  estimate?: number | string | null;
  prev?: number | string | null;
  unit?: string;
};

function formatValue(value: number | string | null | undefined, unit?: string) {
  if (value == null || value === "") return "—";
  const raw = typeof value === "number" ? String(value) : value;
  if (!unit) return raw;
  if (unit === "percent" || unit === "%") return `${raw}%`;
  return `${raw} ${unit}`;
}

function parseFinnhubTime(time?: string) {
  const fallback = { date: "", time: "08:30 AM" };
  if (!time) return fallback;
  const match = time.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hour = Number(match[2]);
  const minute = match[3];
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return {
    date: match[1],
    time: `${hour12}:${minute} ${ampm}`,
  };
}

function mapImpact(raw?: string): Impact {
  const value = String(raw || "").toLowerCase();
  if (value.includes("high") || value === "3") return "HIGH";
  if (value.includes("med") || value === "2") return "MED";
  return "LOW";
}

export function mapFinnhubEconomicRows(
  rows: FinnhubEconomicRow[],
  estimateBias: (text: string) => Record<Asset, Bias>,
): EconEventDTO[] {
  const priorityCountries = new Set(["US", "EU", "GB", "DE", "CN", "JP", "CA"]);
  return rows
    .filter((row) => {
      const country = String(row.country || "").toUpperCase();
      return !country || priorityCountries.has(country);
    })
    .map((row, index) => {
      const parsed = parseFinnhubTime(row.time);
      const name = String(row.event || "Economic event");
      const text = `${name} ${row.country || ""}`;
      return {
        id: `${parsed.date || "event"}-${index}-${name.slice(0, 24)}`,
        date: parsed.date,
        time: parsed.time,
        name: row.country ? `${name} (${row.country})` : name,
        impact: mapImpact(row.impact),
        actual: formatValue(row.actual, row.unit),
        forecast: formatValue(row.estimate, row.unit),
        previous: formatValue(row.prev, row.unit),
        bias: estimateBias(text),
      };
    })
    .filter((row) => !!row.date)
    .slice(0, 200);
}

export async function fetchFinnhubEconomicCalendar(
  apiKey: string,
  start: string,
  end: string,
): Promise<FinnhubEconomicRow[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${start}&to=${end}&token=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Finnhub calendar HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.economicCalendar) ? data.economicCalendar : [];
  } finally {
    clearTimeout(timer);
  }
}
