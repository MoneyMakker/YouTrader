/**
 * Phase 1D — Internal Prop OS account management types.
 * App must not import until Phase 1E.
 */

import type { PropRuleSetSnapshot } from "../types";
import type { EngineSnapshotRow, ScoreSnapshotRow } from "../shadow/types";

export const ACCOUNT_MGMT_VERSION = "account-mgmt-v0" as const;

/** DB account.status */
export type PropAccountStatus = "active" | "archived" | "closed";

/** Domain-facing assignment states (map to DB enums). */
export type TradeAssignmentState =
  | "unassigned"
  | "assigned_manual"
  | "assigned_verified_import"
  | "excluded"
  | "invalid";

/** DB assignment_state values */
export type DbAssignmentState = "unassigned" | "manual" | "verified_import" | "excluded" | "invalid";

export type AssignmentActor = "user" | "system_import" | "admin_correction";

export type ChallengePhase = "evaluation" | "funded";

export type ChallengeStatus =
  | "active"
  | "at_risk"
  | "breached"
  | "passed"
  | "funded"
  | "reset"
  | "abandoned";

export type DataQualityLevel = "ok" | "warn" | "hard" | "unknown";

export type AssignmentProvenance = {
  actor: AssignmentActor | "system";
  source: string;
  reason: string;
  at: string;
  previousState: TradeAssignmentState | null;
  previousChallengeId: string | null;
  previousAccountId: string | null;
  previousAssignmentId: string | null;
  dataQuality: DataQualityLevel;
  confidence: "insufficient" | "low" | "medium" | "high";
  notes?: string;
};

export type PropAccountRecord = {
  id: string;
  userId: string;
  firmKey: string | null;
  label: string;
  accountSizeMinor: number;
  currency: string;
  firmTimezone: string;
  status: PropAccountStatus;
  source: "user_created" | "settings_seed" | "import";
  createdAt: string;
  archivedAt: string | null;
  updatedAt: string;
};

export type PropChallengeRecord = {
  id: string;
  userId: string;
  accountId: string;
  phase: ChallengePhase;
  status: ChallengeStatus;
  ruleSetVersion: string;
  startingBalanceMinor: number;
  startedAt: string;
  endedAt: string | null;
  resetOfChallengeId: string | null;
  breachLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PropRuleSnapshotRecord = {
  id: string;
  userId: string;
  challengeId: string;
  ruleSetVersion: string;
  snapshot: PropRuleSetSnapshot;
  templateKey: string | null;
  templateVersionAtCapture: string | null;
  capturedAt: string;
};

export type PropTradeAssignmentRecord = {
  id: string;
  userId: string;
  tradeClientId: string;
  accountId: string | null;
  challengeId: string | null;
  state: TradeAssignmentState;
  assignedAt: string | null;
  assignedBy: AssignmentActor | null;
  provenance: AssignmentProvenance;
  createdAt: string;
  updatedAt: string;
};

export type ChallengeTransitionRecord = {
  id: string;
  userId: string;
  challengeId: string;
  fromStatus: ChallengeStatus | null;
  toStatus: ChallengeStatus;
  reasonCode: string;
  evidence: Record<string, unknown>;
  actor: string;
  at: string;
};

export type AccountReadModel = {
  account: PropAccountRecord | null;
  defaultAccountId: string | null;
  activeChallenge: PropChallengeRecord | null;
  historicalAttempts: PropChallengeRecord[];
  ruleSnapshot: PropRuleSnapshotRecord | null;
  assignedTradeCount: number;
  unassignedTradeCount: number;
  dataQuality: {
    level: DataQualityLevel;
    flags: string[];
  };
  latestShadowSnapshot: EngineSnapshotRow | null;
  latestScoreSnapshot: ScoreSnapshotRow | null;
};

export type CreatePropAccountInput = {
  userId: string;
  label: string;
  accountSizeMinor: number;
  firmTimezone: string;
  firmKey?: string | null;
  currency?: string;
  source?: PropAccountRecord["source"];
  id?: string;
  nowUtc?: string;
};

export type CreateChallengeAttemptInput = {
  userId: string;
  accountId: string;
  ruleSnapshot: PropRuleSetSnapshot;
  phase?: ChallengePhase;
  startingBalanceMinor?: number;
  startedAtUtc?: string;
  resetOfChallengeId?: string | null;
  templateKey?: string | null;
  templateVersionAtCapture?: string | null;
  id?: string;
  ruleSnapshotId?: string;
  nowUtc?: string;
};

export type AssignTradeInput = {
  userId: string;
  tradeClientId: string;
  challengeId: string;
  state: "assigned_manual" | "assigned_verified_import";
  actor: AssignmentActor;
  reason: string;
  source?: string;
  dataQuality?: DataQualityLevel;
  confidence?: AssignmentProvenance["confidence"];
  nowUtc?: string;
};

export type UnassignTradeInput = {
  userId: string;
  tradeClientId: string;
  actor: AssignmentActor;
  reason: string;
  toState?: "unassigned" | "excluded" | "invalid";
  nowUtc?: string;
};

export type TransitionChallengeInput = {
  userId: string;
  challengeId: string;
  toStatus: ChallengeStatus;
  reasonCode: string;
  actor: string;
  evidence?: Record<string, unknown>;
  nowUtc?: string;
  /** When true, sets breach_locked on breached. */
  lockBreach?: boolean;
};
