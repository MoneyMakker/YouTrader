/**
 * Staging-only journal seed for Maestro edit/delete coverage.
 * Does not run in production builds.
 */

import { isStagingQaResetAllowed } from "./stagingQaResetGates";

export function isStagingQaJournalSeedAllowed(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return isStagingQaResetAllowed(env, { devFallback: typeof __DEV__ !== "undefined" && __DEV__ });
}

export function parseStagingQaJournalSeedUrl(url: string): boolean {
  return (url || "").trim().toLowerCase().startsWith("youtrader://qa/seed-trade");
}

export function parseStagingQaApplyTradeEditUrl(url: string): boolean {
  return (url || "").trim().toLowerCase().startsWith("youtrader://qa/apply-trade-edit");
}

export type StagingQaSeedOverrides = {
  notes?: string;
  pnl?: number;
  entry?: number;
  exit?: number;
  contracts?: number;
  marker?: string;
};

export type StagingQaSeedTrade = {
  id: string;
  date: string;
  symbol: "MES";
  direction: "LONG";
  entryTime: string | null;
  exitTime: string | null;
  entry: number;
  exit: number;
  contracts: number;
  stopLoss: null;
  takeProfit: null;
  pnl: number;
  mood: string;
  notes: string;
  tags: string[];
  photoUri: null;
  voiceUri: null;
  photoCloudUri: null;
  voiceCloudUri: null;
  voiceName: null;
  createdAt: number;
  updatedAt: number;
};

function parseNumberParam(raw: string | null): number | undefined {
  if (raw == null || !String(raw).trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse optional mutation fields from seed / apply-edit deep links. */
export function parseStagingQaTradeOverrides(url: string): StagingQaSeedOverrides {
  try {
    const parsed = new URL(url);
    const marker = parsed.searchParams.get("marker") || undefined;
    const notesRaw = parsed.searchParams.get("notes") || undefined;
    return {
      marker,
      notes: notesRaw || (marker ? `QA-${marker}` : undefined),
      pnl: parseNumberParam(parsed.searchParams.get("pnl")),
      entry: parseNumberParam(parsed.searchParams.get("entry")),
      exit: parseNumberParam(parsed.searchParams.get("exit")),
      contracts: parseNumberParam(parsed.searchParams.get("contracts")),
    };
  } catch {
    const pick = (key: string): string | undefined => {
      const m = url.match(new RegExp(`[?&]${key}=([^&]+)`));
      return m ? decodeURIComponent(m[1]) : undefined;
    };
    const marker = pick("marker");
    const notesRaw = pick("notes");
    return {
      marker,
      notes: notesRaw || (marker ? `QA-${marker}` : undefined),
      pnl: parseNumberParam(pick("pnl") ?? null),
      entry: parseNumberParam(pick("entry") ?? null),
      exit: parseNumberParam(pick("exit") ?? null),
      contracts: parseNumberParam(pick("contracts") ?? null),
    };
  }
}

/** Deterministic MES long for edit/delete automation. */
export function buildStagingQaSeedTrade(
  now = Date.now(),
  overrides: StagingQaSeedOverrides = {},
): StagingQaSeedTrade {
  const day = new Date(now);
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  const marker = overrides.marker || "SEED";
  return {
    id: `qa-seed-${marker}-${now}`,
    date: `${yyyy}-${mm}-${dd}`,
    symbol: "MES",
    direction: "LONG",
    entryTime: "09:30",
    exitTime: "10:15",
    entry: overrides.entry ?? 5200,
    exit: overrides.exit ?? 5210,
    contracts: overrides.contracts ?? 1,
    stopLoss: null,
    takeProfit: null,
    pnl: overrides.pnl ?? 50,
    mood: "Focused",
    notes: overrides.notes || `QA seed trade ${marker}`,
    tags: ["ORB"],
    photoUri: null,
    voiceUri: null,
    photoCloudUri: null,
    voiceCloudUri: null,
    voiceName: null,
    createdAt: now,
    updatedAt: now,
  };
}
