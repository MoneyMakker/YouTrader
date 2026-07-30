import type { AccountManagementService } from "../accounts/service";
import type { AccountReadModel } from "../accounts/types";
import type { EngineSnapshotRow } from "../shadow/types";
import {
  createActivationDiagnostics,
  type ActivationDiagnosticsSink,
  redactId,
} from "./diagnostics";
import { evaluateSnapshotFreshness } from "./freshness";
import {
  evaluateActivationPolicy,
  type ActivationPolicyInput,
  type KillSwitchContract,
} from "./policy";
import type {
  ActivationDiagnosticEvent,
  PropOsActivationConfig,
  PropOsActivationResult,
  PropOsReadModelGate,
} from "./types";
import { DEFAULT_ACTIVATION_CONFIG } from "./types";

export type PropOsReadRequest = {
  userId: string | null | undefined;
  accountId: string | null;
  /** Current input revision for freshness; null skips revision compare. */
  currentInputRevision?: string | null;
  nowUtc?: string;
};

export type PropOsActivatedReadModel = {
  readModel: AccountReadModel;
  gate: PropOsReadModelGate;
  freshnessReasons: string[];
};

export type PropOsReadServiceDeps = {
  accounts: AccountManagementService;
  getSchemaVersion?: () => Promise<string | null>;
  config?: PropOsActivationConfig;
  envSource?: ActivationPolicyInput["envSource"];
  killSwitch?: KillSwitchContract;
  diagnostics?: ActivationDiagnosticsSink;
  validateSnapshotIntegrity?: (row: EngineSnapshotRow, userId: string) => string[];
};

/**
 * Read-only activation service.
 * Engine / account stores remain flag-unaware; flags live only here.
 */
export function createPropOsReadService(deps: PropOsReadServiceDeps) {
  const diagnostics = deps.diagnostics ?? createActivationDiagnostics();
  let callCount = 0;

  function emit(event: ActivationDiagnosticEvent) {
    diagnostics.emit(event);
  }

  function fail(
    mode: PropOsActivationResult<PropOsActivatedReadModel>["mode"],
    gate: PropOsReadModelGate,
    reasonCodes: string[],
  ): PropOsActivationResult<PropOsActivatedReadModel> {
    emit({ type: "read_model_available", available: false, gate });
    emit({ type: "fallback_activated", gate, reasonCodes });
    return {
      ok: false,
      mode,
      gate,
      reasonCodes,
      diagnostics: diagnostics.list(),
      data: null,
    };
  }

  async function getActivatedReadModel(
    request: PropOsReadRequest,
  ): Promise<PropOsActivationResult<PropOsActivatedReadModel>> {
    try {
      const policy = evaluateActivationPolicy({
        config: deps.config,
        envSource: deps.envSource,
        killSwitch: deps.killSwitch,
        userId: request.userId,
        schemaVersionPresent: null,
      });

      emit({
        type: "activation_mode_resolved",
        mode: policy.mode,
        source: policy.sourceLabel,
      });
      if (policy.config.killSwitch) {
        emit({ type: "kill_switch_used", active: true });
      }

      // off / kill-switch: zero Prop OS store calls
      if (policy.mode === "off" || policy.config.killSwitch) {
        emit({
          type: "user_eligible",
          eligible: false,
          reasonCodes: policy.eligibility.reasonCodes,
        });
        return fail("off", "activation_off", policy.eligibility.reasonCodes);
      }

      // shadow: runner may persist elsewhere; App-visible reads stay off (no account store calls)
      if (policy.mode === "shadow") {
        emit({
          type: "user_eligible",
          eligible: false,
          reasonCodes: ["shadow_not_app_visible"],
        });
        return fail("shadow", "activation_off", ["shadow_not_app_visible"]);
      }

      if (!request.userId) {
        return fail(policy.mode, "missing_user", ["missing_user"]);
      }

      const started = Date.now();
      let schemaVersion: string | null = "prop-os-schema-v0";
      if (deps.getSchemaVersion) {
        try {
          schemaVersion = await deps.getSchemaVersion();
        } catch {
          emit({
            type: "repository_latency",
            operation: "schema_version",
            ms: Date.now() - started,
          });
          return fail(policy.mode, "repository_unavailable", ["schema_lookup_failed"]);
        }
      }
      emit({
        type: "repository_latency",
        operation: "schema_version",
        ms: Date.now() - started,
      });
      emit({
        type: "schema_compatible",
        compatible: schemaVersion === policy.config.schemaVersionRequired,
        schemaVersion: schemaVersion ?? undefined,
      });

      const eligibility = evaluateActivationPolicy({
        config: policy.config,
        killSwitch: deps.killSwitch,
        userId: request.userId,
        schemaVersionPresent: schemaVersion,
      }).eligibility;

      emit({
        type: "user_eligible",
        eligible: eligibility.eligible,
        reasonCodes: eligibility.reasonCodes,
      });

      if (!eligibility.eligible) {
        const gate: PropOsReadModelGate = eligibility.reasonCodes.includes(
          "schema_incompatible",
        )
          ? "schema_incompatible"
          : eligibility.reasonCodes.includes("missing_user")
            ? "missing_user"
            : "ineligible";
        return fail(policy.mode, gate, eligibility.reasonCodes);
      }

      callCount += 1;
      const readStarted = Date.now();
      let readModel: AccountReadModel;
      try {
        readModel = await deps.accounts.getAccountReadModel(
          request.userId,
          request.accountId,
        );
      } catch (err) {
        emit({
          type: "repository_latency",
          operation: "get_account_read_model",
          ms: Date.now() - readStarted,
        });
        const msg = err instanceof Error ? err.message : "unknown";
        if (/timeout/i.test(msg)) {
          return fail(policy.mode, "repository_unavailable", ["repository_timeout"]);
        }
        return fail(policy.mode, "repository_unavailable", ["repository_exception"]);
      }
      emit({
        type: "repository_latency",
        operation: "get_account_read_model",
        ms: Date.now() - readStarted,
      });

      const gated = await applyReadModelGates({
        readModel,
        userId: request.userId,
        accounts: deps.accounts,
        config: policy.config,
        currentInputRevision: request.currentInputRevision ?? null,
        nowUtc: request.nowUtc ?? new Date().toISOString(),
        validateSnapshotIntegrity:
          deps.validateSnapshotIntegrity ?? defaultValidateSnapshotIntegrity,
        emit,
      });

      if (gated.gate !== "available") {
        return fail(policy.mode, gated.gate, gated.reasonCodes);
      }

      emit({ type: "read_model_available", available: true, gate: "available" });
      return {
        ok: true,
        mode: policy.mode,
        gate: "available",
        data: {
          readModel: gated.readModel,
          gate: "available",
          freshnessReasons: [],
        },
        diagnostics: diagnostics.list(),
      };
    } catch {
      emit({ type: "unexpected_activation_error", code: "evaluation_threw" });
      return fail(
        deps.config?.mode ?? DEFAULT_ACTIVATION_CONFIG.mode,
        "evaluation_error",
        ["evaluation_threw"],
      );
    }
  }

  return {
    getActivatedReadModel,
    getPropOsCallCount: () => callCount,
    resetCallCount: () => {
      callCount = 0;
    },
    getDiagnostics: () => diagnostics.list(),
    redactUserId: redactId,
  };
}

export type PropOsReadService = ReturnType<typeof createPropOsReadService>;

async function applyReadModelGates(input: {
  readModel: AccountReadModel;
  userId: string;
  accounts: AccountManagementService;
  config: PropOsActivationConfig;
  currentInputRevision: string | null;
  nowUtc: string;
  validateSnapshotIntegrity: (row: EngineSnapshotRow, userId: string) => string[];
  emit: (e: ActivationDiagnosticEvent) => void;
}): Promise<{
  gate: PropOsReadModelGate;
  reasonCodes: string[];
  readModel: AccountReadModel;
}> {
  const { readModel, config } = input;

  if (!readModel.account) {
    return { gate: "no_account", reasonCodes: ["no_account"], readModel };
  }

  let actives;
  try {
    actives = await input.accounts.listActiveChallengesForAccount(
      input.userId,
      readModel.account.id,
    );
    input.emit({
      type: "repository_latency",
      operation: "list_active_challenges",
      ms: 0,
    });
  } catch {
    return {
      gate: "repository_unavailable",
      reasonCodes: ["challenge_list_failed"],
      readModel,
    };
  }

  if (actives.length > 1) {
    return {
      gate: "multiple_active_challenges",
      reasonCodes: ["multiple_active_challenges_require_resolution"],
      readModel,
    };
  }

  if (actives.length === 0) {
    if (
      readModel.account.status === "archived" &&
      readModel.historicalAttempts.length > 0
    ) {
      // Archived accounts remain historically readable per contract.
    } else if (!readModel.historicalAttempts.length && !readModel.activeChallenge) {
      return {
        gate: "no_active_challenge",
        reasonCodes: ["no_active_challenge"],
        readModel,
      };
    }
  }

  if (
    !readModel.ruleSnapshot &&
    (readModel.activeChallenge || readModel.historicalAttempts[0])
  ) {
    return {
      gate: "missing_rule_snapshot",
      reasonCodes: ["missing_rule_snapshot"],
      readModel,
    };
  }

  if (readModel.ruleSnapshot) {
    const snap = readModel.ruleSnapshot.snapshot;
    if (!snap || typeof snap !== "object" || !("version" in snap)) {
      return {
        gate: "incomplete_data",
        reasonCodes: ["invalid_rule_snapshot"],
        readModel,
      };
    }
  }

  const engine = readModel.latestShadowSnapshot;
  if (!engine) {
    return {
      gate: "no_shadow_snapshot",
      reasonCodes: ["no_shadow_snapshot"],
      readModel,
    };
  }

  const integrity = input.validateSnapshotIntegrity(engine, input.userId);
  if (integrity.length) {
    input.emit({ type: "integrity_mismatch", reasons: integrity });
    return { gate: "integrity_mismatch", reasonCodes: integrity, readModel };
  }

  const freshness = evaluateSnapshotFreshness({
    snapshotInputRevision: engine.input_revision,
    currentInputRevision: input.currentInputRevision,
    calculationVersion: engine.calculation_version,
    ruleSetVersion: engine.rule_set_version,
    currentRuleSetVersion: readModel.ruleSnapshot?.ruleSetVersion ?? null,
    readinessModelVersion: engine.readiness_model_version,
    confidencePolicyVersion: engine.confidence_policy_version,
    calculatedAt: engine.calculated_at,
    nowUtc: input.nowUtc,
    maxAgeMs: config.maxSnapshotAgeMs,
    allowedCalculationVersions: config.calculationVersionsAllowed,
    allowedConfidencePolicyVersions: config.confidencePolicyVersionsAllowed,
  });

  if (!freshness.fresh) {
    input.emit({ type: "snapshot_stale", reasons: freshness.reasons });
    if (freshness.reasons.includes("unsupported_calculation_version")) {
      return {
        gate: "unsupported_calculation",
        reasonCodes: freshness.reasons,
        readModel,
      };
    }
    return { gate: "stale_snapshot", reasonCodes: freshness.reasons, readModel };
  }

  if (readModel.dataQuality.level === "hard") {
    return {
      gate: "incomplete_data",
      reasonCodes: ["hard_data_quality", ...readModel.dataQuality.flags],
      readModel,
    };
  }

  if (readModel.dataQuality.flags.includes("incomplete_intraday")) {
    return {
      gate: "incomplete_data",
      reasonCodes: ["incomplete_intraday"],
      readModel,
    };
  }

  return { gate: "available", reasonCodes: [], readModel };
}

export function defaultValidateSnapshotIntegrity(
  row: EngineSnapshotRow,
  userId: string,
): string[] {
  const reasons: string[] = [];
  if (row.user_id !== userId) reasons.push("snapshot_user_mismatch");
  if (!row.schema_version) reasons.push("missing_schema_version");
  if (row.schema_version && row.schema_version !== "prop-os-schema-v0") {
    reasons.push("schema_version_mismatch");
  }
  if (!row.payload || typeof row.payload !== "object") reasons.push("missing_payload");
  if (!row.calculation_version) reasons.push("missing_calculation_version");
  if (!row.input_revision) reasons.push("missing_input_revision");
  if (!row.confidence_policy_version) reasons.push("missing_confidence_policy_version");
  return reasons;
}
