export type ParsedTradeImport = {
  date: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  pnl: number;
  entry: number | null;
  exit: number | null;
  contracts: number;
  mood: string;
  notes: string;
};

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((x) => x.trim().replace(/^"|"$/g, ""));
}

function parseNum(raw: string): number | null {
  const v = raw.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  const cleaned = raw.trim().replace(/^"|"$/g, "");
  if (!cleaned) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{10,13}$/.test(cleaned)) {
    const n = Number(cleaned);
    const ms = cleaned.length > 10 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(cleaned);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = cleaned.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return iso;
  }
  return null;
}

type ColumnMap = {
  date?: number;
  symbol?: number;
  direction?: number;
  pnl?: number;
  entry?: number;
  exit?: number;
  contracts?: number;
  mood?: number;
  notes?: number;
};

function headerMap(parts: string[]): ColumnMap | null {
  const lower = parts.map((p) => p.toLowerCase());
  const hasHeader = lower.some((p) =>
    ["date", "time", "symbol", "direction", "pnl", "profit", "open", "entry", "exit"].some((k) => p.includes(k)),
  );
  if (!hasHeader) return null;
  const find = (keys: string[]) => lower.findIndex((p) => keys.some((k) => p === k || p.includes(k)));
  const map: ColumnMap = {};
  map.date = find(["date", "trade_date", "time", "datetime"]);
  map.symbol = find(["symbol", "ticker", "instrument", "contract"]);
  map.direction = find(["direction", "side", "type"]);
  map.pnl = find(["pnl", "profit", "net", "result", "pl"]);
  map.entry = find(["entry", "entry_price", "open"]);
  map.exit = find(["exit", "exit_price", "close"]);
  map.contracts = find(["contracts", "qty", "quantity", "size"]);
  map.mood = find(["mood", "emotion"]);
  map.notes = find(["notes", "comment", "setup"]);
  if (map.date == null || map.date < 0) return null;
  return map;
}

function cell(parts: string[], idx?: number) {
  if (idx == null || idx < 0 || idx >= parts.length) return "";
  return parts[idx] ?? "";
}

export function parseTradesCsvText(csvText: string): ParsedTradeImport[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstParts = splitLine(lines[0], delimiter);
  const map = headerMap(firstParts);
  const startIndex = map ? 1 : 0;
  const out: ParsedTradeImport[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const parts = splitLine(lines[i], delimiter);
    if (parts.length < 3) continue;

    let date: string | null;
    let symbol: string;
    let direction: "LONG" | "SHORT";
    let pnl: number | null;
    let entry: number | null = null;
    let exit: number | null = null;
    let contracts = 1;
    let mood = "Focused";
    let notes = "";

    if (map) {
      date = parseDate(cell(parts, map.date));
      symbol = (cell(parts, map.symbol) || "MES").toUpperCase();
      const dirRaw = cell(parts, map.direction).toUpperCase();
      direction = dirRaw.includes("SHORT") || dirRaw === "S" ? "SHORT" : "LONG";
      pnl = parseNum(cell(parts, map.pnl));
      entry = parseNum(cell(parts, map.entry));
      exit = parseNum(cell(parts, map.exit));
      contracts = parseNum(cell(parts, map.contracts)) ?? 1;
      mood = cell(parts, map.mood) || mood;
      notes = cell(parts, map.notes) || notes;
    } else {
      date = parseDate(parts[0]);
      symbol = (parts[1] || "MES").toUpperCase();
      const dirRaw = (parts[2] || "LONG").toUpperCase();
      direction = dirRaw.includes("SHORT") ? "SHORT" : "LONG";
      pnl = parseNum(parts[3] ?? parts[parts.length - 1]);
      if (parts.length > 4) entry = parseNum(parts[4]);
      if (parts.length > 5) exit = parseNum(parts[5]);
    }

    if (!date || pnl == null) continue;
    out.push({
      date,
      symbol,
      direction,
      pnl: Number(pnl.toFixed(2)),
      entry,
      exit,
      contracts: Math.max(1, Math.round(contracts)),
      mood,
      notes,
    });
  }

  return out;
}
