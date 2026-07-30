/**
 * Number formatting for YdlAnimatedNumber — presentation only.
 */

import { ydlMotionDurationToken } from "./tokens";

export type YdlNumberKind =
  | "currency"
  | "percentage"
  | "percent"
  | "integer"
  | "decimal"
  | "score";

export type YdlNumberFormatOptions = {
  locale?: string;
  currency?: string;
  decimals?: number;
  signed?: boolean;
  compact?: boolean;
  prefix?: string;
  suffix?: string;
};

const DEFAULT_DECIMALS: Record<YdlNumberKind, number> = {
  currency: 2,
  percentage: 1,
  percent: 1,
  integer: 0,
  decimal: 2,
  score: 0,
};

function normalizeKind(kind: YdlNumberKind): YdlNumberKind {
  return kind === "percent" ? "percentage" : kind;
}

export function formatYdlNumber(
  kind: YdlNumberKind,
  value: number,
  options: YdlNumberFormatOptions = {},
): string {
  const resolved = normalizeKind(kind);
  const locale = options.locale ?? "en-US";
  const decimals = options.decimals ?? DEFAULT_DECIMALS[resolved];
  const safe = Number.isFinite(value) ? value : 0;

  let body: string;
  switch (resolved) {
    case "currency": {
      try {
        body = new Intl.NumberFormat(locale, {
          style: "currency",
          currency: options.currency ?? "USD",
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          notation: options.compact ? "compact" : "standard",
        }).format(safe);
      } catch {
        body = `$${safe.toFixed(decimals)}`;
      }
      break;
    }
    case "percentage": {
      // Values are already in percent units (e.g. 55 → "55.0%"), not 0–1 fractions.
      const pct = safe;
      const core = pct.toFixed(decimals);
      body = options.signed && pct > 0 ? `+${core}%` : `${core}%`;
      break;
    }
    case "integer": {
      const n = Math.round(safe);
      body = options.signed && n > 0 ? `+${n}` : `${n}`;
      break;
    }
    case "score": {
      body = `${Math.round(safe)}`;
      break;
    }
    case "decimal":
    default: {
      const core = safe.toFixed(decimals);
      body = options.signed && safe > 0 ? `+${core}` : core;
      break;
    }
  }

  return `${options.prefix ?? ""}${body}${options.suffix ?? ""}`;
}

export type YdlNumberMotionConfig = {
  durationMs: number;
  easing: "number";
  overshoot: false;
  fontVariant: Array<"tabular-nums">;
};

/** Presentation motion policy for numbers — timing only, never spring overshoot. */
export function getYdlNumberMotionConfig(_kind: YdlNumberKind): YdlNumberMotionConfig {
  return {
    durationMs: ydlMotionDurationToken.emphasized,
    easing: "number",
    overshoot: false,
    fontVariant: ["tabular-nums"],
  };
}

/** Linear interpolate — no overshoot. */
export function interpolateYdlNumber(from: number, to: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return from + (to - from) * clamped;
}

/** Parse a radar/metric display string into a numeric + kind guess. */
export function parseYdlMetricDisplay(raw: string): {
  value: number;
  kind: YdlNumberKind;
  decimals: number;
} | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return null;
  const match = trimmed.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  const decimals = match[1] ? match[1].length - 1 : 0;
  if (trimmed.includes("%")) {
    return { value, kind: "percentage", decimals: decimals || 0 };
  }
  if (trimmed.includes("$")) {
    return { value, kind: "currency", decimals: decimals || 2 };
  }
  if (decimals === 0) {
    return { value, kind: "integer", decimals: 0 };
  }
  return { value, kind: "decimal", decimals };
}
