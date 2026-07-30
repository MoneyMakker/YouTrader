import type { PropRuleSetSnapshot } from "../types";
import { AccountMgmtError } from "./errors";
import { isAssignedState } from "./assignmentState";
import { freshId } from "./memoryStore";
import type { AccountManagementStore } from "./store";
import { canTransitionChallenge, isActiveChallengeStatus } from "./transitions";
import type {
  AccountReadModel,
  AssignTradeInput,
  AssignmentProvenance,
  ChallengeTransitionRecord,
  CreateChallengeAttemptInput,
  CreatePropAccountInput,
  GetAccountReadModelOptions,
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
  TransitionChallengeInput,
  UnassignTradeInput,
} from "./types";
import { ACCOUNT_MGMT_VERSION } from "./types";

function nowIso(nowUtc?: string): string {
  return nowUtc ?? new Date(0).toISOString(); // tests pass explicit now; avoid hidden wall-clock in defaults when provided
}

function requireOwnership(userId: string, ownerId: string, label: string): void {
  if (userId !== ownerId) {
    throw new AccountMgmtError("ownership_mismatch", `${label} ownership mismatch`);
  }
}

export function createAccountManagementService(store: AccountManagementStore) {
  async function createPropAccount(input: CreatePropAccountInput): Promise<PropAccountRecord> {
    if (!input.userId) throw new AccountMgmtError("invalid_input", "userId required");
    if (!input.label?.trim()) throw new AccountMgmtError("invalid_input", "label required");
    if (!(input.accountSizeMinor > 0)) {
      throw new AccountMgmtError("invalid_input", "accountSizeMinor must be > 0");
    }
    if (!input.firmTimezone) throw new AccountMgmtError("invalid_input", "firmTimezone required");

    const at = nowIso(input.nowUtc);
    const row: PropAccountRecord = {
      id: input.id ?? freshId("acc"),
      userId: input.userId,
      firmKey: input.firmKey ?? null,
      label: input.label.trim(),
      accountSizeMinor: input.accountSizeMinor,
      currency: input.currency ?? "USD",
      firmTimezone: input.firmTimezone,
      status: "active",
      source: input.source ?? "user_created",
      createdAt: at,
      archivedAt: null,
      updatedAt: at,
    };
    return store.insertAccount(row);
  }

  async function createChallengeAttempt(
    input: CreateChallengeAttemptInput,
  ): Promise<{ challenge: PropChallengeRecord; ruleSnapshot: PropRuleSnapshotRecord }> {
    const account = await store.getAccount(input.accountId);
    if (!account) throw new AccountMgmtError("not_found", "account not found");
    requireOwnership(input.userId, account.userId, "account");
    if (account.status === "archived" || account.status === "closed") {
      throw new AccountMgmtError("archived", "cannot create challenge on archived/closed account");
    }

    const rules = input.ruleSnapshot;
    validateRuleSnapshot(rules);

    if (input.resetOfChallengeId) {
      const prior = await store.getChallenge(input.resetOfChallengeId);
      if (!prior) throw new AccountMgmtError("not_found", "resetOf challenge not found");
      requireOwnership(input.userId, prior.userId, "prior challenge");
      if (prior.accountId !== input.accountId) {
        throw new AccountMgmtError("conflict", "reset must stay on same account");
      }
      // New attempt after breach/reset — prior must not be "revived"
      if (prior.status === "active" || prior.status === "at_risk") {
        throw new AccountMgmtError(
          "conflict",
          "resetOfChallengeId must reference a terminal attempt, not an active one",
        );
      }
    }

    const at = nowIso(input.startedAtUtc ?? input.nowUtc);
    const challengeId = input.id ?? freshId("ch");
    const challenge: PropChallengeRecord = {
      id: challengeId,
      userId: input.userId,
      accountId: input.accountId,
      phase: input.phase ?? "evaluation",
      status: "active",
      ruleSetVersion: rules.version,
      startingBalanceMinor: input.startingBalanceMinor ?? account.accountSizeMinor,
      startedAt: at,
      endedAt: null,
      resetOfChallengeId: input.resetOfChallengeId ?? null,
      breachLocked: false,
      createdAt: at,
      updatedAt: at,
    };

    const ruleSnapshot: PropRuleSnapshotRecord = {
      id: input.ruleSnapshotId ?? freshId("rule"),
      userId: input.userId,
      challengeId,
      ruleSetVersion: rules.version,
      snapshot: rules,
      templateKey: input.templateKey ?? null,
      templateVersionAtCapture: input.templateVersionAtCapture ?? null,
      capturedAt: at,
    };

    await store.insertChallenge(challenge);
    await store.insertRuleSnapshot(ruleSnapshot);
    return { challenge, ruleSnapshot };
  }

  async function createRuleSnapshot(input: {
    userId: string;
    challengeId: string;
    ruleSnapshot: PropRuleSetSnapshot;
    templateKey?: string | null;
    templateVersionAtCapture?: string | null;
    capturedAtUtc?: string;
    id?: string;
  }): Promise<PropRuleSnapshotRecord> {
    const challenge = await store.getChallenge(input.challengeId);
    if (!challenge) throw new AccountMgmtError("not_found", "challenge not found");
    requireOwnership(input.userId, challenge.userId, "challenge");
    const existing = await store.getRuleSnapshot(input.challengeId);
    if (existing) {
      throw new AccountMgmtError("conflict", "rule snapshot already exists and is immutable");
    }
    validateRuleSnapshot(input.ruleSnapshot);
    if (input.ruleSnapshot.version !== challenge.ruleSetVersion) {
      throw new AccountMgmtError("conflict", "rule snapshot version must match challenge.ruleSetVersion");
    }
    const row: PropRuleSnapshotRecord = {
      id: input.id ?? freshId("rule"),
      userId: input.userId,
      challengeId: input.challengeId,
      ruleSetVersion: input.ruleSnapshot.version,
      snapshot: input.ruleSnapshot,
      templateKey: input.templateKey ?? null,
      templateVersionAtCapture: input.templateVersionAtCapture ?? null,
      capturedAt: nowIso(input.capturedAtUtc),
    };
    return store.insertRuleSnapshot(row);
  }

  async function setDefaultAccount(userId: string, accountId: string | null): Promise<void> {
    if (accountId == null) {
      await store.setDefaultAccountId(userId, null);
      return;
    }
    const account = await store.getAccount(accountId);
    if (!account) throw new AccountMgmtError("not_found", "account not found");
    requireOwnership(userId, account.userId, "account");
    if (account.status === "archived" || account.status === "closed") {
      throw new AccountMgmtError("archived", "cannot set archived/closed account as default");
    }
    await store.setDefaultAccountId(userId, accountId);
  }

  async function assignTrade(input: AssignTradeInput): Promise<PropTradeAssignmentRecord> {
    if (!input.tradeClientId?.trim()) {
      throw new AccountMgmtError("invalid_input", "tradeClientId required");
    }
    const challenge = await store.getChallenge(input.challengeId);
    if (!challenge) throw new AccountMgmtError("not_found", "challenge not found");
    requireOwnership(input.userId, challenge.userId, "challenge");
    if (!isActiveChallengeStatus(challenge.status) && challenge.status !== "passed" && challenge.status !== "funded") {
      // allow assignment only to non-terminal-inactive? PO: explicit assignment — typically active
      if (challenge.status === "breached" || challenge.status === "reset" || challenge.status === "abandoned") {
        throw new AccountMgmtError("conflict", "cannot assign trade to terminal inactive challenge");
      }
    }

    const existing = await store.getAssignment(input.userId, input.tradeClientId);
    const activeAssigned = await store.listActiveAssignedTradeIds(input.userId);
    if (
      activeAssigned.has(input.tradeClientId) &&
      existing?.challengeId &&
      existing.challengeId !== input.challengeId &&
      isAssignedState(existing.state)
    ) {
      throw new AccountMgmtError(
        "duplicate_assignment",
        "trade already assigned to another active challenge",
      );
    }

    const at = nowIso(input.nowUtc);
    const provenance: AssignmentProvenance = {
      actor: input.actor,
      source: input.source ?? "manual_assign",
      reason: input.reason,
      at,
      previousState: existing?.state ?? null,
      previousChallengeId: existing?.challengeId ?? null,
      previousAccountId: existing?.accountId ?? null,
      previousAssignmentId: existing?.id ?? null,
      dataQuality: input.dataQuality ?? "ok",
      confidence: input.confidence ?? "high",
    };

    const row: PropTradeAssignmentRecord = {
      id: existing?.id ?? freshId("asg"),
      userId: input.userId,
      tradeClientId: input.tradeClientId,
      accountId: challenge.accountId,
      challengeId: challenge.id,
      state: input.state,
      assignedAt: at,
      assignedBy: input.actor,
      provenance,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    };
    return store.upsertAssignment(row);
  }

  async function unassignTrade(input: UnassignTradeInput): Promise<PropTradeAssignmentRecord> {
    const existing = await store.getAssignment(input.userId, input.tradeClientId);
    if (!existing) {
      // create explicit unassigned row so legacy stays unassigned with provenance
      const at = nowIso(input.nowUtc);
      const row: PropTradeAssignmentRecord = {
        id: freshId("asg"),
        userId: input.userId,
        tradeClientId: input.tradeClientId,
        accountId: null,
        challengeId: null,
        state: input.toState ?? "unassigned",
        assignedAt: null,
        assignedBy: null,
        provenance: {
          actor: input.actor,
          source: "unassign",
          reason: input.reason,
          at,
          previousState: null,
          previousChallengeId: null,
          previousAccountId: null,
          previousAssignmentId: null,
          dataQuality: "unknown",
          confidence: "medium",
        },
        createdAt: at,
        updatedAt: at,
      };
      return store.upsertAssignment(row);
    }
    requireOwnership(input.userId, existing.userId, "assignment");

    const toState = input.toState ?? "unassigned";
    const at = nowIso(input.nowUtc);
    const row: PropTradeAssignmentRecord = {
      ...existing,
      accountId: toState === "unassigned" ? null : existing.accountId,
      challengeId: toState === "unassigned" ? null : existing.challengeId,
      state: toState,
      assignedAt: toState === "unassigned" ? null : existing.assignedAt,
      assignedBy: toState === "unassigned" ? null : existing.assignedBy,
      provenance: {
        actor: input.actor,
        source: "unassign",
        reason: input.reason,
        at,
        previousState: existing.state,
        previousChallengeId: existing.challengeId,
        previousAccountId: existing.accountId,
        previousAssignmentId: existing.id,
        dataQuality: existing.provenance.dataQuality,
        confidence: existing.provenance.confidence,
      },
      updatedAt: at,
    };
    return store.upsertAssignment(row);
  }

  async function transitionChallenge(
    input: TransitionChallengeInput,
  ): Promise<{ challenge: PropChallengeRecord; transition: ChallengeTransitionRecord }> {
    const challenge = await store.getChallenge(input.challengeId);
    if (!challenge) throw new AccountMgmtError("not_found", "challenge not found");
    requireOwnership(input.userId, challenge.userId, "challenge");

    if (!canTransitionChallenge(challenge.status, input.toStatus)) {
      throw new AccountMgmtError(
        "forbidden_transition",
        `cannot transition ${challenge.status} → ${input.toStatus}`,
      );
    }

    const at = nowIso(input.nowUtc);
    const updated: PropChallengeRecord = {
      ...challenge,
      status: input.toStatus,
      breachLocked:
        input.toStatus === "breached"
          ? input.lockBreach !== false
          : challenge.breachLocked,
      endedAt:
        input.toStatus === "active" || input.toStatus === "at_risk"
          ? challenge.endedAt
          : challenge.endedAt ?? at,
      updatedAt: at,
    };

    const transition: ChallengeTransitionRecord = {
      id: freshId("tr"),
      userId: input.userId,
      challengeId: challenge.id,
      fromStatus: challenge.status,
      toStatus: input.toStatus,
      reasonCode: input.reasonCode,
      evidence: input.evidence ?? { accountMgmtVersion: ACCOUNT_MGMT_VERSION },
      actor: input.actor,
      at,
    };

    await store.updateChallenge(updated);
    await store.insertTransition(transition);
    return { challenge: updated, transition };
  }

  async function archiveAccount(userId: string, accountId: string, nowUtc?: string): Promise<PropAccountRecord> {
    const account = await store.getAccount(accountId);
    if (!account) throw new AccountMgmtError("not_found", "account not found");
    requireOwnership(userId, account.userId, "account");
    if (account.status === "archived") return account;

    const at = nowIso(nowUtc);
    const updated: PropAccountRecord = {
      ...account,
      status: "archived",
      archivedAt: at,
      updatedAt: at,
    };
    await store.updateAccount(updated);

    const def = await store.getDefaultAccountId(userId);
    if (def === accountId) {
      await store.setDefaultAccountId(userId, null);
    }
    return updated;
  }

  async function getAccountReadModel(
    userId: string,
    accountId: string | null,
    options?: GetAccountReadModelOptions,
  ): Promise<AccountReadModel> {
    const defaultAccountId = await store.getDefaultAccountId(userId);
    const resolvedId = accountId ?? defaultAccountId;
    if (!resolvedId) {
      return emptyReadModel(defaultAccountId);
    }

    const account = await store.getAccount(resolvedId);
    if (!account) return emptyReadModel(defaultAccountId);
    requireOwnership(userId, account.userId, "account");

    const attempts = await store.listChallengesForAccount(account.id);
    const activeChallenges = attempts
      .filter((c) => isActiveChallengeStatus(c.status))
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const historicalAttempts = attempts
      .filter((c) => !isActiveChallengeStatus(c.status))
      .slice()
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

    let challengeSelectionState: AccountReadModel["challengeSelectionState"] = "none";
    let activeChallenge: PropChallengeRecord | null = null;

    if (activeChallenges.length === 0) {
      challengeSelectionState = "none";
      activeChallenge = null;
    } else if (activeChallenges.length === 1) {
      challengeSelectionState = "resolved";
      activeChallenge = activeChallenges[0]!;
    } else {
      challengeSelectionState = "selection_required";
      activeChallenge = null;
      const selectedId = options?.selectedChallengeId ?? null;
      if (selectedId) {
        const selected = activeChallenges.find((c) => c.id === selectedId) ?? null;
        if (selected) {
          challengeSelectionState = "resolved";
          activeChallenge = selected;
        }
        // Invalid / cross-account selection: leave selection_required (not authorization).
      }
    }

    // Snapshots/rules only for deterministically resolved active challenge — never historical fallback.
    const focusChallenge = activeChallenge;
    const ruleSnapshot = focusChallenge
      ? await store.getRuleSnapshot(focusChallenge.id)
      : null;

    const allAssignments = await store.listAssignmentsForUser(userId);
    const assignedTradeCount = allAssignments.filter(
      (a) =>
        a.accountId === account.id &&
        (a.state === "assigned_manual" || a.state === "assigned_verified_import"),
    ).length;
    const unassignedTradeCount = allAssignments.filter(
      (a) => a.userId === userId && a.state === "unassigned",
    ).length;

    const flags: string[] = [];
    let level: AccountReadModel["dataQuality"]["level"] = "ok";
    if (challengeSelectionState === "selection_required") {
      flags.push("multiple_active_challenges");
      level = "warn";
    } else if (!focusChallenge) {
      flags.push("no_challenge");
      level = "warn";
    }
    if (focusChallenge && !ruleSnapshot) {
      flags.push("missing_rule_snapshot");
      level = "hard";
    }
    for (const a of allAssignments) {
      if (a.state === "invalid") {
        flags.push("invalid_trade");
        level = level === "hard" ? "hard" : "warn";
      }
      if (a.provenance.dataQuality === "hard") {
        flags.push("hard_data_quality");
        level = "hard";
      }
    }

    const latestShadowSnapshot = focusChallenge
      ? await store.getLatestEngineSnapshot(focusChallenge.id)
      : null;
    const latestScoreSnapshot = focusChallenge
      ? await store.getLatestScoreSnapshot(focusChallenge.id)
      : null;
    if (focusChallenge && !latestShadowSnapshot) flags.push("no_shadow_snapshot");

    return {
      account,
      defaultAccountId,
      activeChallenge,
      activeChallenges,
      challengeSelectionState,
      historicalAttempts,
      ruleSnapshot,
      assignedTradeCount,
      unassignedTradeCount,
      dataQuality: { level, flags: [...new Set(flags)] },
      latestShadowSnapshot,
      latestScoreSnapshot,
    };
  }

  /**
   * List active-like challenges for an owned account.
   * Used by Phase 1E activation gates — does not silently pick among multiples.
   */
  async function listActiveChallengesForAccount(
    userId: string,
    accountId: string,
  ): Promise<PropChallengeRecord[]> {
    const account = await store.getAccount(accountId);
    if (!account) return [];
    requireOwnership(userId, account.userId, "account");
    const attempts = await store.listChallengesForAccount(accountId);
    return attempts.filter((c) => isActiveChallengeStatus(c.status));
  }

  return {
    createPropAccount,
    createChallengeAttempt,
    createRuleSnapshot,
    setDefaultAccount,
    assignTrade,
    unassignTrade,
    transitionChallenge,
    archiveAccount,
    getAccountReadModel,
    listActiveChallengesForAccount,
  };
}

export type AccountManagementService = ReturnType<typeof createAccountManagementService>;

function emptyReadModel(defaultAccountId: string | null): AccountReadModel {
  return {
    account: null,
    defaultAccountId,
    activeChallenge: null,
    activeChallenges: [],
    challengeSelectionState: "none",
    historicalAttempts: [],
    ruleSnapshot: null,
    assignedTradeCount: 0,
    unassignedTradeCount: 0,
    dataQuality: { level: "unknown", flags: ["no_account"] },
    latestShadowSnapshot: null,
    latestScoreSnapshot: null,
  };
}

function validateRuleSnapshot(rules: PropRuleSetSnapshot): void {
  if (!rules?.version) throw new AccountMgmtError("invalid_input", "rule snapshot version required");
  if (!rules.firmTimezone) throw new AccountMgmtError("invalid_input", "firmTimezone required");
  if (rules.profitTargetMinor == null) {
    throw new AccountMgmtError("invalid_input", "profitTargetMinor required");
  }
  if (!rules.drawdown?.kind || rules.drawdown.amountMinor == null) {
    throw new AccountMgmtError("invalid_input", "drawdown required");
  }
}
