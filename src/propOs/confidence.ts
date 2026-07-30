import type { ConfidenceBlock, ConfidenceLevel } from "./types.ts";

export const CONFIDENCE_POLICY_VERSION = "confidence-policy-v0" as const;

export function confidenceFromTradeCount(
  sampleSize: number,
  limitations: string[] = [],
): ConfidenceBlock {
  let confidence: ConfidenceLevel;
  if (sampleSize < 5) confidence = "insufficient";
  else if (sampleSize < 20) confidence = "low";
  else if (sampleSize < 50) confidence = "medium";
  else confidence = "high";

  return {
    sampleSize,
    confidence,
    confidencePolicyVersion: CONFIDENCE_POLICY_VERSION,
    limitations: [...limitations],
  };
}

/** Rule-buffer confidence: completeness of state, not trade count alone. */
export function confidenceForRuleBuffers(args: {
  sampleSize: number;
  stateComplete: boolean;
  limitations: string[];
}): ConfidenceBlock {
  if (!args.stateComplete) {
    return {
      sampleSize: args.sampleSize,
      confidence: "insufficient",
      confidencePolicyVersion: CONFIDENCE_POLICY_VERSION,
      limitations: [...args.limitations, "state_incomplete"],
    };
  }
  return confidenceFromTradeCount(args.sampleSize, args.limitations);
}

/** Edge/performance: downgrade when concentration or missing fields high. */
export function confidenceForEdgeInsight(args: {
  sampleSize: number;
  missingFieldRatio: number;
  maxDayShare: number;
  limitations?: string[];
}): ConfidenceBlock {
  const base = confidenceFromTradeCount(args.sampleSize, args.limitations ?? []);
  const lim = [...base.limitations];
  let { confidence } = base;
  if (args.missingFieldRatio > 0.2) {
    lim.push("missing_field_ratio_high");
    if (confidence === "high") confidence = "medium";
    else if (confidence === "medium") confidence = "low";
  }
  if (args.maxDayShare > 0.5 && args.sampleSize >= 5) {
    lim.push("concentration_single_day");
    if (confidence === "high") confidence = "medium";
  }
  if (args.sampleSize < 30 && confidence === "high") {
    confidence = "medium";
    lim.push("edge_min_sample");
  }
  return { ...base, confidence, limitations: lim };
}
