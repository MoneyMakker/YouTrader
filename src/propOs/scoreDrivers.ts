import type { ConfidenceBlock, ReadinessDriver } from "./types";

/**
 * Maximum |sum(driver.contribution) − (currentScore − previousScore)|
 * allowed for causal score drivers (integer score floor rounding).
 */
export const SCORE_DELTA_RECONCILIATION_TOLERANCE = 1;

export type ReadinessFactorMap = Record<string, { value: number; weight: number }>;

export type DriverBuildResult = {
  drivers: ReadinessDriver[];
  supportingEvidence: ReadinessDriver[];
  reconciled: boolean;
  contributionSum: number | null;
  residual: number | null;
};

function toEvidence(
  factor: string,
  value: number,
  contribution: number,
  confidence: ConfidenceBlock,
): ReadinessDriver {
  return {
    factor,
    contribution,
    evidence: { ...confidence, value },
  };
}

/**
 * Build causal score-delta drivers when a previous factor snapshot exists.
 * Contributions must reconcile previousScore → currentScore within tolerance.
 * Otherwise factors are returned only as supportingEvidence (not drivers).
 */
export function buildScoreDeltaDrivers(args: {
  currentFactors: ReadinessFactorMap;
  previousFactors: ReadinessFactorMap | null | undefined;
  currentScore: number;
  previousScore: number | null | undefined;
  confidence: ConfidenceBlock;
  tolerance?: number;
}): DriverBuildResult {
  const tolerance = args.tolerance ?? SCORE_DELTA_RECONCILIATION_TOLERANCE;
  const { currentFactors, previousFactors, currentScore, previousScore, confidence } = args;

  const currentLevels: ReadinessDriver[] = Object.entries(currentFactors).map(
    ([factor, { value, weight }]) =>
      toEvidence(factor, value, weight * value * 100, confidence),
  );

  if (previousScore == null || previousFactors == null) {
    return {
      drivers: [],
      supportingEvidence: currentLevels,
      reconciled: false,
      contributionSum: null,
      residual: null,
    };
  }

  const delta = currentScore - previousScore;
  const causal: ReadinessDriver[] = [];
  let contributionSum = 0;

  for (const [factor, cur] of Object.entries(currentFactors)) {
    const prev = previousFactors[factor];
    if (prev == null) {
      return {
        drivers: [],
        supportingEvidence: currentLevels,
        reconciled: false,
        contributionSum: null,
        residual: null,
      };
    }
    if (Math.abs(prev.weight - cur.weight) > 1e-12) {
      return {
        drivers: [],
        supportingEvidence: currentLevels,
        reconciled: false,
        contributionSum: null,
        residual: null,
      };
    }
    const contribution = cur.weight * (cur.value - prev.value) * 100;
    contributionSum += contribution;
    causal.push(toEvidence(factor, cur.value, contribution, confidence));
  }

  const residual = Math.abs(contributionSum - delta);
  if (residual <= tolerance) {
    return {
      drivers: causal.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
      supportingEvidence: [],
      reconciled: true,
      contributionSum,
      residual,
    };
  }

  return {
    drivers: [],
    supportingEvidence: currentLevels,
    reconciled: false,
    contributionSum,
    residual,
  };
}

export function assertDriversReconcileDelta(args: {
  previousScore: number;
  currentScore: number;
  drivers: ReadinessDriver[];
  tolerance?: number;
}): void {
  const tolerance = args.tolerance ?? SCORE_DELTA_RECONCILIATION_TOLERANCE;
  const delta = args.currentScore - args.previousScore;
  const sum = args.drivers.reduce((acc, d) => acc + d.contribution, 0);
  const residual = Math.abs(sum - delta);
  if (residual > tolerance) {
    throw new Error(
      `score-delta drivers do not reconcile: sum=${sum} delta=${delta} residual=${residual} tolerance=${tolerance}`,
    );
  }
}
