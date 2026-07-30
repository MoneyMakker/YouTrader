import { hashPropOsCommandPayload } from "./hash";
import { AccountMgmtError } from "../accounts/errors";
import { createAccountManagementService } from "../accounts/service";
import type { AccountManagementService } from "../accounts/service";
import type { AccountManagementStore } from "../accounts/store";
import { isActiveChallengeStatus } from "../accounts/transitions";
import { getPropOsTemplate } from "../templates/index";
import type {
  ArchiveAccountResult,
  ArchivePropAccountCommand,
  ClearActiveChallengeSelectionCommand,
  CreateAccountResult,
  CreateChallengeAttemptCommand,
  CreateChallengeResult,
  CreatePropAccountCommand,
  PreferenceResult,
  PropOsAccountWriteService,
  PropOsCommandState,
  PropOsCommandType,
  SelectActiveChallengeCommand,
  SetDefaultAccountCommand,
} from "./types";

type Receipt = {
  commandType: PropOsCommandType;
  requestHash: string;
  state: PropOsCommandState<unknown>;
};

function hashPayload(commandType: PropOsCommandType, body: unknown): string {
  return hashPropOsCommandPayload(commandType, body);
}

function mapDomainError(err: unknown): PropOsCommandState<never> {
  if (err instanceof AccountMgmtError) {
    if (err.failure === "ownership_mismatch" || err.failure === "cross_user" || err.failure === "forbidden") {
      return { kind: "forbidden" };
    }
    if (err.failure === "conflict" || err.failure === "duplicate_assignment" || err.failure === "forbidden_transition") {
      return { kind: "conflict", reasonCode: err.failure };
    }
    if (err.failure === "archived" || err.failure === "not_found") {
      return { kind: "conflict", reasonCode: err.failure };
    }
    if (err.failure === "invalid_input") {
      return { kind: "validation_error", fieldErrors: { _form: err.message } };
    }
  }
  return { kind: "unexpected_error" };
}

/**
 * In-memory write service for Phase 2B QA.
 * Mirrors RPC idempotency: same (userId, requestId) + hash → original result.
 */
export function createMemoryPropOsWriteService(input: {
  userId: string;
  store: AccountManagementStore;
  /** When false, all commands return forbidden (activation off / not allowlisted). */
  mutationsAllowed?: boolean;
}): PropOsAccountWriteService {
  const domain: AccountManagementService = createAccountManagementService(input.store);
  const receipts = new Map<string, Receipt>();
  const inflight = new Map<string, Promise<PropOsCommandState<unknown>>>();
  const mutationsAllowed = input.mutationsAllowed !== false;

  async function withIdempotency<T>(
    commandType: PropOsCommandType,
    clientRequestId: string,
    body: unknown,
    run: () => Promise<PropOsCommandState<T>>,
  ): Promise<PropOsCommandState<T>> {
    if (!mutationsAllowed) return { kind: "forbidden" };
    if (!input.userId) return { kind: "forbidden" };
    if (!clientRequestId?.trim()) {
      return { kind: "validation_error", fieldErrors: { clientRequestId: "required" } };
    }

    const requestHash = hashPayload(commandType, body);
    const key = `${input.userId}::${clientRequestId}`;
    const existing = receipts.get(key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return { kind: "conflict", reasonCode: "idempotency_hash_mismatch" };
      }
      return existing.state as PropOsCommandState<T>;
    }

    const running = inflight.get(key);
    if (running) {
      return (await running) as PropOsCommandState<T>;
    }

    const work = (async (): Promise<PropOsCommandState<T>> => {
      const state = await run();
      if (
        state.kind === "success" ||
        state.kind === "conflict" ||
        state.kind === "validation_error" ||
        state.kind === "forbidden"
      ) {
        receipts.set(key, { commandType, requestHash, state });
      }
      return state;
    })();

    inflight.set(key, work as Promise<PropOsCommandState<unknown>>);
    try {
      return await work;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    async createPropAccount(cmd: CreatePropAccountCommand) {
      return withIdempotency("create_account", cmd.clientRequestId, cmd, async () => {
        if (!cmd.label?.trim()) {
          return { kind: "validation_error", fieldErrors: { label: "required" } };
        }
        if (!(cmd.accountSizeMinor > 0)) {
          return {
            kind: "validation_error",
            fieldErrors: { accountSizeMinor: "must_be_positive" },
          };
        }
        if (!cmd.firmTimezone) {
          return { kind: "validation_error", fieldErrors: { firmTimezone: "required" } };
        }
        try {
          const account = await domain.createPropAccount({
            userId: input.userId,
            label: cmd.label,
            accountSizeMinor: cmd.accountSizeMinor,
            firmTimezone: cmd.firmTimezone,
            firmKey: cmd.firmKey,
            currency: cmd.currency,
            source: "user_created",
          });
          const value: CreateAccountResult = { account };
          return { kind: "success", value };
        } catch (err) {
          return mapDomainError(err);
        }
      });
    },

    async createChallengeAttempt(cmd: CreateChallengeAttemptCommand) {
      return withIdempotency("create_challenge_attempt", cmd.clientRequestId, cmd, async () => {
        const template = getPropOsTemplate(cmd.templateId, cmd.templateVersion);
        if (!template) {
          return {
            kind: "validation_error",
            fieldErrors: { templateId: "unknown_or_unsupported_template" },
          };
        }
        if (template.unsupportedFields.includes("firm_verified_rules") && template.firmKey === "custom") {
          // Custom path allowed only when rule snapshot was explicitly confirmed (caller responsibility).
          // Still reject empty / guessed snapshots.
          if (!cmd.ruleSnapshot?.version || !cmd.ruleSnapshot?.profitTargetMinor) {
            return {
              kind: "validation_error",
              fieldErrors: { ruleSnapshot: "custom_rules_require_explicit_confirmation" },
            };
          }
        }
        try {
          const created = await domain.createChallengeAttempt({
            userId: input.userId,
            accountId: cmd.accountId,
            ruleSnapshot: cmd.ruleSnapshot,
            phase: cmd.phase,
            startedAtUtc: cmd.startedAtUtc,
            resetOfChallengeId: cmd.resetOfChallengeId,
            templateKey: cmd.templateId,
            templateVersionAtCapture: cmd.templateVersion,
          });
          const attempts = await input.store.listChallengesForAccount(cmd.accountId);
          const attemptNumber = attempts.length;
          const value: CreateChallengeResult = {
            challenge: created.challenge,
            ruleSnapshot: created.ruleSnapshot,
            attemptNumber,
          };
          return { kind: "success", value };
        } catch (err) {
          return mapDomainError(err);
        }
      });
    },

    async setDefaultAccount(cmd: SetDefaultAccountCommand) {
      return withIdempotency("set_default_account", cmd.clientRequestId, cmd, async () => {
        try {
          await domain.setDefaultAccount(input.userId, cmd.accountId);
          const value: PreferenceResult = {
            defaultAccountId: await input.store.getDefaultAccountId(input.userId),
            selectedChallengeId: await input.store.getSelectedChallengeId(input.userId),
          };
          return { kind: "success", value };
        } catch (err) {
          return mapDomainError(err);
        }
      });
    },

    async archivePropAccount(cmd: ArchivePropAccountCommand) {
      return withIdempotency("archive_account", cmd.clientRequestId, cmd, async () => {
        try {
          const challenges = await input.store.listChallengesForAccount(cmd.accountId);
          const hasActive = challenges.some((c) => isActiveChallengeStatus(c.status));
          if (hasActive && !cmd.confirmActive) {
            return {
              kind: "conflict",
              reasonCode: "active_challenge_confirmation_required",
            };
          }
          const account = await domain.archiveAccount(input.userId, cmd.accountId);
          const value: ArchiveAccountResult = { account };
          return { kind: "success", value };
        } catch (err) {
          return mapDomainError(err);
        }
      });
    },

    async selectActiveChallenge(cmd: SelectActiveChallengeCommand) {
      return withIdempotency("select_active_challenge", cmd.clientRequestId, cmd, async () => {
        try {
          const account = await input.store.getAccount(cmd.accountId);
          if (!account || account.userId !== input.userId) return { kind: "forbidden" };
          if (account.status === "archived" || account.status === "closed") {
            return { kind: "conflict", reasonCode: "archived" };
          }
          const challenge = await input.store.getChallenge(cmd.challengeId);
          if (!challenge || challenge.userId !== input.userId) return { kind: "forbidden" };
          if (challenge.accountId !== cmd.accountId) {
            return { kind: "conflict", reasonCode: "cross_account_selection" };
          }
          if (!isActiveChallengeStatus(challenge.status)) {
            return { kind: "conflict", reasonCode: "challenge_not_eligible" };
          }
          await input.store.setSelectedChallengeId(input.userId, cmd.challengeId);
          const value: PreferenceResult = {
            defaultAccountId: await input.store.getDefaultAccountId(input.userId),
            selectedChallengeId: cmd.challengeId,
          };
          return { kind: "success", value };
        } catch (err) {
          return mapDomainError(err);
        }
      });
    },

    async clearActiveChallengeSelection(cmd: ClearActiveChallengeSelectionCommand) {
      return withIdempotency(
        "clear_active_challenge_selection",
        cmd.clientRequestId,
        cmd,
        async () => {
          try {
            const account = await input.store.getAccount(cmd.accountId);
            if (!account || account.userId !== input.userId) return { kind: "forbidden" };
            const selected = await input.store.getSelectedChallengeId(input.userId);
            if (selected) {
              const ch = await input.store.getChallenge(selected);
              if (!ch || ch.accountId === cmd.accountId) {
                await input.store.setSelectedChallengeId(input.userId, null);
              }
            }
            const value: PreferenceResult = {
              defaultAccountId: await input.store.getDefaultAccountId(input.userId),
              selectedChallengeId: await input.store.getSelectedChallengeId(input.userId),
            };
            return { kind: "success", value };
          } catch (err) {
            return mapDomainError(err);
          }
        },
      );
    },
  };
}
