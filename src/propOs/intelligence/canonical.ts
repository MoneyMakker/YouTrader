/**
 * Canonical snapshot serialization — byte-stable across runtimes.
 */

import { createHash, stableStringify } from "./hash";
import { PI_RATIO_SCALE } from "./precision";
import type {
  PerformanceIntelligenceSnapshot,
  RatioOrUndefined,
} from "./types";

function canonRatio(r: RatioOrUndefined): unknown {
  if (r.kind === "value") {
    return {
      kind: "value",
      valueScaled: r.valueScaled,
      scale: PI_RATIO_SCALE,
    };
  }
  if (r.kind === "unavailable") {
    return { kind: "unavailable", reasonCode: r.reasonCode };
  }
  return { kind: r.kind };
}

function walk(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "number") {
    if (Object.is(value, -0)) return 0;
    if (!Number.isFinite(value)) {
      throw new Error("canonical_forbid_non_finite");
    }
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(walk);
  const obj = value as Record<string, unknown>;
  // RatioOrUndefined shape
  if (
    typeof obj.kind === "string" &&
    (obj.kind === "value" ||
      obj.kind === "undefined_zero_loss" ||
      obj.kind === "undefined_zero_profit" ||
      obj.kind === "undefined_zero_denominator" ||
      obj.kind === "unavailable") &&
    ("valueScaled" in obj || obj.kind !== "value")
  ) {
    return canonRatio(obj as RatioOrUndefined);
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    if (k === "id" || k === "calculatedAt") continue; // excluded from core
    if (obj[k] === undefined) continue;
    out[k] = walk(obj[k]);
  }
  return out;
}

/** Canonical JSON bytes for snapshot core (excludes id/calculatedAt). */
export function canonicalSnapshotBytes(
  snap: PerformanceIntelligenceSnapshot,
): string {
  return stableStringify(walk(snap));
}

export function canonicalSnapshotHash(
  snap: PerformanceIntelligenceSnapshot,
): string {
  return createHash(canonicalSnapshotBytes(snap));
}

export const CANONICAL_SERIALIZATION_CONTRACT = {
  keyOrdering: "lexicographic_utf16_code_units",
  arrayOrdering: "preserved_deterministic_engine_order",
  timestamps: "ISO-8601_UTC_Z_or_null",
  locale: "none",
  numbers: "JSON_number_no_locale; ratios as valueScaled integers",
  nulls: "explicit_null",
  undefinedMetrics: "tagged_kind_objects",
} as const;
