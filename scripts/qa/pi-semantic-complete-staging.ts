/**
 * Staging-only: seed ≥5 assigned trades, request PI, publish semantic snapshot
 * via trusted prop-os-pi-processor (no client hardcoded UI results, no direct DML).
 *
 * Usage:
 *   set -a; source ios/.xcode.env.staging
 *   source .codex/secrets/staging-qa-credentials.env
 *   source .codex/secrets/staging-api-keys.env; set +a
 *   npx tsx scripts/qa/pi-semantic-complete-staging.ts
 *   npx tsx scripts/qa/pi-semantic-complete-staging.ts --fail-only
 *   npx tsx scripts/qa/pi-semantic-complete-staging.ts --stale-only
 */
import { createClient } from "@supabase/supabase-js";
import { hashPropOsCommandPayload, newPropOsClientRequestId } from "../../src/propOs/commands/hash";
import { calculatePerformanceIntelligence } from "../../src/propOs/intelligence/engine";
import { scopeKey } from "../../src/propOs/intelligence/scope";
import type { IntelligenceScope, RawJournalTradeFact } from "../../src/propOs/intelligence/types";

const STAGING_HOST = "zleojeqkzizeyerhjpur";
const PROD_HOST = "izzrlsgumyabdvlmwlwn";

function red(id: string | null | undefined): string {
  if (!id) return "none";
  return `${String(id).slice(0, 8)}…`;
}

function requireEnv(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function snapshotToPiJson(snap: ReturnType<typeof calculatePerformanceIntelligence>) {
  return JSON.parse(JSON.stringify(snap));
}

async function callProcessor(
  url: string,
  serviceRole: string,
  anon: string,
  processorSecret: string | null,
  body: unknown,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serviceRole}`,
    apikey: anon,
    "Content-Type": "application/json",
  };
  if (processorSecret) headers["x-prop-os-processor-secret"] = processorSecret;
  const res = await fetch(`${url}/functions/v1/prop-os-pi-processor`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

async function main() {
  const failOnly = process.argv.includes("--fail-only");
  const staleOnly = process.argv.includes("--stale-only");
  const url = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const anon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const processorSecret = (process.env.PROP_OS_PROCESSOR_SHARED_SECRET || "").trim() || null;
  const host = urlHost(url);
  if (!url || !anon) throw new Error("missing SUPABASE_URL / anon");
  if (host.includes(PROD_HOST)) {
    console.error("REFUSE: production host");
    process.exit(2);
  }
  if (!host.includes(STAGING_HOST)) {
    console.error(`REFUSE: expected staging ${STAGING_HOST}, got ${host}`);
    process.exit(2);
  }

  const email = requireEnv("STAGING_QA_ALLOW_EMAIL");
  const password = requireEnv("STAGING_QA_ALLOW_PASSWORD");
  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: signed, error: signErr } = await authClient.auth.signInWithPassword({ email, password });
  if (signErr || !signed.session || !signed.user) {
    throw new Error(`signIn failed: ${signErr?.message || "no_session"}`);
  }
  const userId = signed.user.id;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${signed.session.access_token}` } },
    auth: { persistSession: false },
  });
  console.info("[YTQA:pi] auth_ok", { user: red(userId), host });

  const { data: prefs } = await client
    .from("prop_os_user_preferences")
    .select("default_account_id,selected_challenge_id")
    .eq("user_id", userId)
    .maybeSingle();
  let accountId = String(prefs?.default_account_id || "");
  if (!accountId) {
    const { data: accounts } = await client
      .from("prop_accounts")
      .select("id,label")
      .ilike("label", "YTQA Staging Fixture%")
      .order("created_at", { ascending: false })
      .limit(1);
    accountId = String(accounts?.[0]?.id || "");
  }
  if (!accountId) throw new Error("no default_account_id — run seed-prop-pass-staging.ts first");

  const { data: challenge } = await client
    .from("prop_challenges")
    .select("id,status")
    .eq("account_id", accountId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const challengeId = String(challenge?.id || "");
  if (!challengeId) throw new Error("no challenge for account");

  // Ensure ≥5 closed assigned trades for semantic path (unless fail/stale-only).
  const { data: assignments, error: asgErr } = await client
    .from("prop_trade_assignments")
    .select("trade_client_id,assignment_state")
    .eq("challenge_id", challengeId)
    .in("assignment_state", ["manual", "verified_import"]);
  if (asgErr) throw new Error(`assignments query failed: ${asgErr.message}`);
  const tradeClientIds = (assignments || []).map((a) => String(a.trade_client_id));
  if (!failOnly && !staleOnly) {
    console.info("[YTQA:pi] assigned_trades", { have: tradeClientIds.length, need: 5 });
    if (tradeClientIds.length < 5) {
      throw new Error(
        `need ≥5 assigned trades, have ${tradeClientIds.length}. Run: npx tsx scripts/qa/seed-prop-pass-staging.ts --pi-semantic`,
      );
    }
  }

  const { data: recalc } = await client
    .from("prop_os_challenge_recalc")
    .select("assignment_revision")
    .eq("challenge_id", challengeId)
    .maybeSingle();
  const assignmentRevision = Number(recalc?.assignment_revision ?? 1);

  const { data: journal } = await client
    .from("trade_journal")
    .select(
      "id,client_id,user_id,symbol,direction,pnl,entry_time,exit_time,contracts,trade_date,deleted_at,stop_loss,entry,exit",
    )
    .in("client_id", tradeClientIds.length ? tradeClientIds : ["__none__"]);

  const facts: RawJournalTradeFact[] = (journal || []).map((row) => {
    const stop = row.stop_loss == null ? null : Number(row.stop_loss);
    const entryPx = row.entry == null ? null : Number(row.entry);
    // Always supply risk for semantic `current` (missing risk → incomplete_data).
    let riskAmountMajor = 100;
    if (stop != null && !Number.isNaN(stop) && stop > 0) riskAmountMajor = stop;
    else if (stop != null && entryPx != null) {
      riskAmountMajor = Math.abs(entryPx - stop) || 100;
    }
    const contracts = Number(row.contracts ?? 1);
    return {
      journalTradeId: String(row.id),
      tradeClientId: String(row.client_id),
      userId: String(row.user_id),
      symbol: String(row.symbol),
      direction: String(row.direction),
      pnlMajor: Number(row.pnl),
      feesMajor: 0,
      contracts: Number.isNaN(contracts) ? 1 : contracts,
      occurredAtUtc: String(row.exit_time ?? row.entry_time),
      exitTime: row.exit_time == null ? null : String(row.exit_time),
      entryTime: row.entry_time == null ? null : String(row.entry_time),
      open: false,
      deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
      assignmentRevision,
      accountId,
      challengeId,
      riskAmountMajor,
      rMultiple: 1.5,
    };
  });

  const scope: IntelligenceScope = {
    kind: "account",
    accountId,
    includeArchivedChallenges: false,
  };
  const sk = scopeKey(scope);

  // Request (owner RPC) so calc row exists for polling.
  {
    const clientRequestId = newPropOsClientRequestId();
    const { data, error } = await client.rpc("prop_os_cmd_request_performance_intelligence", {
      p_client_request_id: clientRequestId,
      p_payload_hash: hashPropOsCommandPayload("request_performance_intelligence", {
        clientRequestId,
        accountId,
        scope,
      }),
      p_account_id: accountId,
      p_scope_json: scope,
      p_scope_key: sk,
    });
    console.info("[YTQA:pi] request", {
      ok: !error,
      kind: (data as { kind?: string })?.kind || null,
      err: error?.message || null,
    });
  }

  if (failOnly) {
    const failed = await callProcessor(url, serviceRole, anon, processorSecret, {
      op: "fail",
      userId,
      scopeKey: sk,
      assignmentRevision,
      reasonCode: "ytqa_processor_failure",
    });
    console.info("[YTQA:pi] fail", {
      status: failed.status,
      kind: failed.body?.kind || null,
      reason: failed.body?.reasonCode || failed.body?.message || null,
    });
    return;
  }

  if (staleOnly) {
    const snap = calculatePerformanceIntelligence({
      userId,
      scope,
      assignmentRevision,
      facts,
      asOfUtc: new Date().toISOString(),
    });
    const stale = await callProcessor(url, serviceRole, anon, processorSecret, {
      op: "complete",
      userId,
      scopeKey: sk,
      assignmentRevision: assignmentRevision + 999,
      snapshot: snapshotToPiJson(snap),
    });
    console.info("[YTQA:pi] stale_complete", {
      status: stale.status,
      kind: stale.body?.kind || null,
      detail: JSON.stringify(stale.body).slice(0, 200),
    });
    return;
  }

  const snap = calculatePerformanceIntelligence({
    userId,
    scope,
    assignmentRevision,
    facts,
    asOfUtc: new Date().toISOString(),
  });
  console.info("[YTQA:pi] engine", {
    status: snap.status,
    tradeCount: facts.length,
    findings: (snap as { findings?: unknown[] }).findings?.length ?? null,
  });

  const done = await callProcessor(url, serviceRole, anon, processorSecret, {
    op: "complete",
    userId,
    scopeKey: sk,
    assignmentRevision,
    snapshot: snapshotToPiJson(snap),
  });
  console.info("[YTQA:pi] complete", {
    status: done.status,
    kind: done.body?.kind || null,
    snapshotId: red(String((done.body as { snapshotId?: string })?.snapshotId || "")),
  });

  const again = await callProcessor(url, serviceRole, anon, processorSecret, {
    op: "complete",
    userId,
    scopeKey: sk,
    assignmentRevision,
    snapshot: snapshotToPiJson(snap),
  });
  console.info("[YTQA:pi] idempotent_repeat", {
    status: again.status,
    kind: again.body?.kind || null,
  });

  const { data: current } = await client
    .from("prop_performance_intelligence_current")
    .select("scope_key,snapshot_id,status")
    .eq("user_id", userId)
    .eq("scope_key", sk)
    .maybeSingle();
  console.info("[YTQA:pi] current_projection", {
    present: !!current?.snapshot_id,
    status: current?.status || null,
    snapshot: red(current?.snapshot_id),
  });

  if (snap.status !== "current" && snap.status !== "incomplete_data") {
    process.exitCode = 3;
  }
}

main().catch((err) => {
  console.error("[YTQA:pi] FAIL", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
