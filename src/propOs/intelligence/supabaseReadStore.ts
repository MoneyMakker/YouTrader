/**
 * Remote Performance Intelligence read + request store.
 * SELECT own rows via RLS; request via prop_os_cmd_request_performance_intelligence.
 * Never writes snapshots from the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { newPropOsClientRequestId } from "../commands/hash";
import { createHash, stableStringify } from "./hash";
import { scopeKey } from "./scope";
import type {
  IntelligenceCalcState,
  IntelligenceScope,
  PerformanceIntelligenceSnapshot,
} from "./types";
import type {
  IntelligenceScopeAvailability,
  PerformanceIntelligenceReadStore,
  PerformanceIntelligenceRequestStore,
} from "./readStore";

type RpcClient = {
  from: SupabaseClient["from"];
  rpc: SupabaseClient["rpc"];
};

type SnapshotRow = {
  id: string;
  user_id: string;
  account_id: string;
  challenge_id: string | null;
  scope_kind: string;
  scope_key: string;
  scope_json: IntelligenceScope;
  assignment_revision: number;
  input_revision: string;
  metric_spec_version: string;
  engine_version: string;
  status: PerformanceIntelligenceSnapshot["status"];
  dataset_summary: PerformanceIntelligenceSnapshot["datasetSummary"];
  performance: PerformanceIntelligenceSnapshot["performance"];
  risk: PerformanceIntelligenceSnapshot["risk"];
  sequences: PerformanceIntelligenceSnapshot["sequences"];
  segments: PerformanceIntelligenceSnapshot["segments"];
  findings: PerformanceIntelligenceSnapshot["findings"];
  earliest_trade_at: string | null;
  latest_trade_at: string | null;
  calculated_at: string;
  schema_version: string;
};

type CalcRow = {
  scope_key: string;
  state: string;
  assignment_revision: number;
  snapshot_id: string | null;
  reason_code: string | null;
};

function mapSnapshot(row: SnapshotRow): PerformanceIntelligenceSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    challengeId: row.challenge_id ?? undefined,
    assignmentRevision: row.assignment_revision,
    inputRevision: row.input_revision,
    metricSpecVersion: row.metric_spec_version,
    engineVersion: row.engine_version,
    scope: row.scope_json,
    status: row.status,
    datasetSummary: row.dataset_summary,
    performance: row.performance,
    risk: row.risk,
    sequences: row.sequences,
    segments: row.segments,
    findings: row.findings,
    calculatedAt: row.calculated_at,
    sourceRange: {
      earliestTradeAt: row.earliest_trade_at,
      latestTradeAt: row.latest_trade_at,
    },
    schemaVersion: row.schema_version,
  };
}

function mapCalc(row: CalcRow | null, fallbackKey: string): IntelligenceCalcState {
  if (!row) return { kind: "not_required" };
  const assignmentRevision = Number(row.assignment_revision) || 0;
  const scopeKeyValue = row.scope_key || fallbackKey;
  switch (row.state) {
    case "queued":
      return { kind: "queued", assignmentRevision, scopeKey: scopeKeyValue };
    case "running":
      return { kind: "running", assignmentRevision, scopeKey: scopeKeyValue };
    case "completed":
      return {
        kind: "completed",
        assignmentRevision,
        scopeKey: scopeKeyValue,
        snapshotId: row.snapshot_id ?? "",
      };
    case "failed":
      return {
        kind: "failed",
        assignmentRevision,
        scopeKey: scopeKeyValue,
        reasonCode: row.reason_code ?? "unknown",
      };
    default:
      return { kind: "not_required" };
  }
}

function payloadHash(scope: IntelligenceScope, assignmentRevision: number): string {
  return createHash(
    stableStringify({
      scope,
      assignmentRevision,
      v: "pi-request-v0",
    }),
  );
}

export function createSupabaseIntelligenceReadStore(
  client: RpcClient,
  userId: string,
): PerformanceIntelligenceReadStore & PerformanceIntelligenceRequestStore {
  async function getCalculationState(
    scope: IntelligenceScope,
  ): Promise<IntelligenceCalcState> {
    const sk = scopeKey(scope);
    const { data, error } = await client
      .from("prop_performance_intelligence_calc")
      .select("scope_key, state, assignment_revision, snapshot_id, reason_code")
      .eq("user_id", userId)
      .eq("scope_key", sk)
      .maybeSingle();
    if (error) return { kind: "not_required" };
    return mapCalc(data as CalcRow | null, sk);
  }

  return {
    async getCurrentSnapshot(scope) {
      const sk = scopeKey(scope);
      const { data: current, error: curErr } = await client
        .from("prop_performance_intelligence_current")
        .select("snapshot_id")
        .eq("user_id", userId)
        .eq("scope_key", sk)
        .maybeSingle();
      if (curErr || !current?.snapshot_id) return null;
      const { data, error } = await client
        .from("prop_performance_intelligence_snapshots")
        .select("*")
        .eq("id", current.snapshot_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return mapSnapshot(data as SnapshotRow);
    },

    async getSnapshotHistory(scope) {
      const sk = scopeKey(scope);
      const { data, error } = await client
        .from("prop_performance_intelligence_snapshots")
        .select("*")
        .eq("user_id", userId)
        .eq("scope_key", sk)
        .order("calculated_at", { ascending: false })
        .limit(20);
      if (error || !data) return [];
      return (data as SnapshotRow[]).map(mapSnapshot);
    },

    async getAvailableScopes(accountId) {
      const scopes: IntelligenceScope[] = [
        { kind: "account", accountId, includeArchivedChallenges: false },
        { kind: "recent_trades", accountId, count: 20 },
        { kind: "recent_trades", accountId, count: 50 },
        { kind: "recent_trades", accountId, count: 100 },
      ];
      const { data: challengeRows } = await client
        .from("prop_challenges")
        .select("id")
        .eq("user_id", userId)
        .eq("account_id", accountId)
        .limit(32);
      for (const row of challengeRows ?? []) {
        if (row?.id) {
          scopes.push({
            kind: "challenge",
            challengeId: String(row.id),
            accountId,
          });
        }
      }
      const out: IntelligenceScopeAvailability[] = [];
      for (const scope of scopes) {
        const sk = scopeKey(scope);
        const calc = await getCalculationState(scope);
        const { data: cur } = await client
          .from("prop_performance_intelligence_current")
          .select("snapshot_id")
          .eq("user_id", userId)
          .eq("scope_key", sk)
          .maybeSingle();
        out.push({
          scope,
          scopeKey: sk,
          hasCurrent: !!cur?.snapshot_id,
          calc,
        });
      }
      return out;
    },

    getCalculationState,

    async requestCalculation(scope, assignmentRevision) {
      const sk = scopeKey(scope);
      const clientRequestId = newPropOsClientRequestId();
      const hash = payloadHash(scope, assignmentRevision);
      const { data, error } = await client.rpc(
        "prop_os_cmd_request_performance_intelligence",
        {
          p_client_request_id: clientRequestId,
          p_payload_hash: hash,
          p_account_id: scope.accountId,
          p_scope_json: scope,
          p_scope_key: sk,
        },
      );
      if (error) {
        return { kind: "queued", scopeKey: sk };
      }
      const kind = (data as { kind?: string } | null)?.kind;
      if (kind === "running") return { kind: "running", scopeKey: sk };
      if (kind === "completed") return { kind: "completed", scopeKey: sk };
      return { kind: "queued", scopeKey: sk };
    },
  };
}
