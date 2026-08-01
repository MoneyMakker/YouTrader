/**
 * Staging-only: persist Prop Pass engine/score snapshots via trusted recalc processor.
 * Refuses non-staging hosts. Requires SUPABASE_SERVICE_ROLE_KEY + STAGING_QA_ALLOW_USER_ID.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { prepareTrustedRecalculation } from "../../src/propOs/assignments/trustedRecalcProcessor";
import type { ChallengeRow, ExecutionRow, RuleSnapshotRow } from "../../src/propOs/shadow/types";

async function main() {
  const URL = process.env.SUPABASE_URL!;
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
  const ALLOW = process.env.STAGING_QA_ALLOW_USER_ID!;
  if (!URL.includes("zleojeqkzizeyerhjpur")) throw new Error("refuse prod");

  const admin = createClient(URL, SR, { auth: { persistSession: false } });

  async function callProcessor(body: unknown) {
    const res = await fetch(`${URL}/functions/v1/prop-os-recalc-processor`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SR}`,
        apikey: ANON,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  const { data: pref } = await admin
    .from("prop_os_user_preferences")
    .select("default_account_id,selected_challenge_id")
    .eq("user_id", ALLOW)
    .maybeSingle();
  const challengeId = pref?.selected_challenge_id;
  if (!challengeId) throw new Error("missing selected_challenge_id");

  const { data: recalc } = await admin
    .from("prop_os_challenge_recalc")
    .select("assignment_revision,state")
    .eq("challenge_id", challengeId)
    .maybeSingle();
  const assignmentRevision = Number(recalc?.assignment_revision ?? 5);
  console.info("[YTQA:snap] prefs", {
    challenge: String(challengeId).slice(0, 8) + "…",
    rev: assignmentRevision,
    state: recalc?.state ?? null,
  });

  if (recalc?.state === "running") {
    const { error } = await admin
      .from("prop_os_challenge_recalc")
      .update({ state: "queued" })
      .eq("challenge_id", challengeId);
    console.info("[YTQA:snap] force_queued", { error: error?.message || null });
  }

  const mark = await callProcessor({ op: "mark_running", challengeId, assignmentRevision });
  console.info("[YTQA:snap] mark_running", { status: mark.status, kind: (mark.body as any)?.kind });

  const { data: chRow } = await admin
    .from("prop_challenges")
    .select(
      "id,user_id,account_id,phase,status,rule_set_version,starting_balance_minor,started_at,ended_at,reset_of_challenge_id,breach_locked,schema_version",
    )
    .eq("id", challengeId)
    .single();
  const { data: ruleRow } = await admin
    .from("prop_challenge_rule_snapshots")
    .select(
      "id,user_id,challenge_id,rule_set_version,snapshot,template_key,template_version_at_capture,captured_at,schema_version",
    )
    .eq("challenge_id", challengeId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .single();
  const { data: execRows } = await admin
    .from("prop_executions")
    .select(
      "id,user_id,challenge_id,account_id,trade_client_id,occurred_at,broker_sequence,realized_pnl_minor,fees_minor,contracts,voided,corrects_event_id,source,schema_version",
    )
    .eq("challenge_id", challengeId)
    .eq("voided", false);

  if (!chRow || !ruleRow) throw new Error("missing challenge/rule");

  const challengeRow: ChallengeRow = {
    id: String(chRow.id),
    user_id: String(chRow.user_id),
    account_id: String(chRow.account_id),
    phase: String(chRow.phase),
    status: String(chRow.status),
    rule_set_version: String(chRow.rule_set_version),
    starting_balance_minor: Number(chRow.starting_balance_minor),
    started_at: String(chRow.started_at),
    ended_at: chRow.ended_at == null ? null : String(chRow.ended_at),
    reset_of_challenge_id:
      chRow.reset_of_challenge_id == null ? null : String(chRow.reset_of_challenge_id),
    breach_locked: Boolean(chRow.breach_locked),
    schema_version: String(chRow.schema_version),
  };
  const ruleSnapshotRow: RuleSnapshotRow = {
    id: String(ruleRow.id),
    user_id: String(ruleRow.user_id),
    challenge_id: String(ruleRow.challenge_id),
    rule_set_version: String(ruleRow.rule_set_version),
    snapshot: ruleRow.snapshot as RuleSnapshotRow["snapshot"],
    template_key: ruleRow.template_key == null ? null : String(ruleRow.template_key),
    template_version_at_capture:
      ruleRow.template_version_at_capture == null
        ? null
        : String(ruleRow.template_version_at_capture),
    captured_at: String(ruleRow.captured_at),
    schema_version: String(ruleRow.schema_version),
  };
  const executionRows: ExecutionRow[] = (execRows ?? []).map((j) => ({
    id: String(j.id),
    user_id: String(j.user_id),
    challenge_id: j.challenge_id == null ? null : String(j.challenge_id),
    account_id: j.account_id == null ? null : String(j.account_id),
    trade_client_id: j.trade_client_id == null ? null : String(j.trade_client_id),
    occurred_at: String(j.occurred_at),
    broker_sequence: j.broker_sequence == null ? null : Number(j.broker_sequence),
    realized_pnl_minor: j.realized_pnl_minor == null ? null : Number(j.realized_pnl_minor),
    fees_minor: j.fees_minor == null ? null : Number(j.fees_minor),
    contracts: j.contracts == null ? null : Number(j.contracts),
    voided: Boolean(j.voided),
    corrects_event_id: j.corrects_event_id == null ? null : String(j.corrects_event_id),
    source: String(j.source),
    schema_version: String(j.schema_version),
  }));

  const prepared = prepareTrustedRecalculation({
    userId: ALLOW,
    challengeRow,
    ruleSnapshotRow,
    executionRows,
    assignmentRevision,
    asOfUtc: new Date().toISOString(),
  });
  const eng = prepared.engineSnapshot;
  const score = prepared.scoreSnapshot;
  const engId = randomUUID();
  const scoreId = randomUUID();

  const persist = await callProcessor({
    op: "persist_snapshots",
    engineSnapshot: {
      id: engId,
      user_id: ALLOW,
      challenge_id: challengeId,
      calculation_version: eng.calculation_version,
      rule_set_version: eng.rule_set_version,
      input_revision: prepared.inputRevision,
      calculated_at: eng.calculated_at,
      status: eng.status,
      payload: eng.payload,
      confidence: eng.confidence,
      limitations: eng.limitations,
      readiness_model_version: eng.readiness_model_version,
      confidence_policy_version: eng.confidence_policy_version,
      fixture_contract_version: "assignment-recalc-v0",
      schema_version: eng.schema_version,
      created_at: eng.created_at,
    },
    scoreSnapshot: {
      id: scoreId,
      user_id: ALLOW,
      challenge_id: challengeId,
      calculation_version: score.calculation_version,
      rule_set_version: score.rule_set_version,
      input_revision: prepared.inputRevision,
      calculated_at: score.calculated_at,
      status: score.status,
      payload: score.payload,
      confidence: score.confidence,
      limitations: score.limitations,
      readiness_model_version: score.readiness_model_version,
      confidence_policy_version: score.confidence_policy_version,
      fixture_contract_version: "assignment-recalc-v0",
      schema_version: score.schema_version,
      created_at: score.created_at,
    },
  });
  console.info("[YTQA:snap] persist", {
    status: persist.status,
    kind: (persist.body as any)?.kind,
  });

  const requestId = `ytqa-${randomUUID()}`;
  const requestHash = createHash("sha256")
    .update(`complete_recalculation:${challengeId}:${assignmentRevision}`)
    .digest("hex");
  const complete = await callProcessor({
    op: "complete",
    requestId,
    requestHash,
    challengeId,
    assignmentRevision,
    snapshotRevision: assignmentRevision,
  });
  console.info("[YTQA:snap] complete", {
    status: complete.status,
    kind: (complete.body as any)?.kind,
  });

  const { data: snap } = await admin
    .from("prop_engine_snapshots")
    .select("id,calculated_at")
    .eq("challenge_id", challengeId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.info("[YTQA:snap] engine_present", {
    present: !!snap?.id,
    id: snap?.id ? String(snap.id).slice(0, 8) + "…" : null,
  });
}

main().catch((err) => {
  console.error("[YTQA:snap] failed", err);
  process.exit(1);
});
