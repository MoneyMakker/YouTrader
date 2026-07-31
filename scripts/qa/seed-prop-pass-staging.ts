/**
 * Idempotent staging-only Prop Pass QA fixture seeder.
 * Uses approved command RPCs + processor when available.
 * Never prints credentials or full UUIDs.
 *
 * Usage:
 *   set -a; source ios/.xcode.env.staging; source .codex/secrets/staging-qa-credentials.env; source .codex/secrets/staging-api-keys.env; set +a
 *   npx tsx scripts/qa/seed-prop-pass-staging.ts
 *   npx tsx scripts/qa/seed-prop-pass-staging.ts --cleanup-qa-label
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { hashPropOsCommandPayload, newPropOsClientRequestId } from "../../src/propOs/commands/hash";

const STAGING_HOST = "zleojeqkzizeyerhjpur";
const PROD_HOST = "izzrlsgumyabdvlmwlwn";
const QA_LABEL_PREFIX = "YTQA Staging Fixture";

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

async function signIn(url: string, anon: string, email: string, password: string) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`signIn failed: ${error?.message || "no_session"}`);
  }
  return {
    userId: data.user.id,
    token: data.session.access_token,
    client: createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

async function callProcessor(
  url: string,
  serviceRole: string,
  anon: string,
  processorSecret: string | null,
  name: "prop-os-recalc-processor" | "prop-os-pi-processor",
  body: unknown,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serviceRole}`,
    apikey: anon,
    "Content-Type": "application/json",
  };
  // Optional shared secret; service-role bearer alone is accepted by the processor.
  if (processorSecret) headers["x-prop-os-processor-secret"] = processorSecret;
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

async function ensureAccount(client: SupabaseClient, label: string) {
  const { data: existing } = await client
    .from("prop_accounts")
    .select("id,label")
    .ilike("label", `${QA_LABEL_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (existing?.[0]?.id) {
    return { accountId: String(existing[0].id), created: false };
  }
  const cmd = {
    label,
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
    clientRequestId: newPropOsClientRequestId(),
  };
  const { data, error } = await client.rpc("prop_os_cmd_create_account", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("create_account", cmd),
    p_label: cmd.label,
    p_firm_key: cmd.firmKey,
    p_account_size_minor: cmd.accountSizeMinor,
    p_currency: cmd.currency,
    p_firm_timezone: cmd.firmTimezone,
  });
  if (error || (data as { kind?: string })?.kind !== "success") {
    throw new Error(`create_account failed: ${error?.message || JSON.stringify(data)}`);
  }
  const accountId = (data as { value: { account: { id: string } } }).value.account.id;
  return { accountId, created: true };
}

async function ensureChallenge(client: SupabaseClient, accountId: string) {
  const { data: existing } = await client
    .from("prop_challenges")
    .select("id,status,account_id")
    .eq("account_id", accountId)
    .in("status", ["active", "evaluation", "in_progress", "running"])
    .order("started_at", { ascending: false })
    .limit(5);
  // Also accept any open challenge for this account
  const { data: anyCh } = await client
    .from("prop_challenges")
    .select("id,status")
    .eq("account_id", accountId)
    .order("started_at", { ascending: false })
    .limit(1);
  if (existing?.[0]?.id || anyCh?.[0]?.id) {
    return {
      challengeId: String((existing?.[0] || anyCh?.[0])!.id),
      created: false,
      status: String((existing?.[0] || anyCh?.[0])!.status),
    };
  }

  const ruleSnapshot = {
    version: "rs-ytqa-staging",
    firmKey: "apex-demo",
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300000,
    dailyLossLimitMinor: 1000000,
    dailyLossBasis: "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: { kind: "static", amountMinor: 200000 },
    minimumTradingDays: 1,
  };
  const startedAtUtc = new Date().toISOString();
  const cmd = {
    accountId,
    templateId: "internal.apex-demo.eval.static",
    templateVersion: "v0",
    ruleSnapshot,
    phase: "evaluation",
    startedAtUtc,
    resetOfChallengeId: null,
    clientRequestId: newPropOsClientRequestId(),
  };
  const { data, error } = await client.rpc("prop_os_cmd_create_challenge_attempt", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("create_challenge_attempt", cmd),
    p_account_id: accountId,
    p_template_id: cmd.templateId,
    p_template_version: cmd.templateVersion,
    p_rule_snapshot: ruleSnapshot,
    p_phase: cmd.phase,
    p_started_at: startedAtUtc,
    p_reset_of: null,
  });
  if (error || (data as { kind?: string })?.kind !== "success") {
    throw new Error(`create_challenge failed: ${error?.message || JSON.stringify(data)}`);
  }
  const v = (data as { value: Record<string, unknown> }).value;
  const challengeId = String(
    (v.challenge as { id?: string } | undefined)?.id ?? v.challengeId ?? "",
  );
  if (!challengeId) throw new Error(`create_challenge missing id: ${JSON.stringify(data)}`);
  return { challengeId, created: true, status: "created" };
}

async function ensureTradeAndAssignment(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  challengeId: string,
) {
  const { data: ch } = await client
    .from("prop_challenges")
    .select("started_at,ended_at,status")
    .eq("id", challengeId)
    .maybeSingle();
  const startedAt = ch?.started_at ? new Date(String(ch.started_at)).getTime() : Date.now() - 86400000;
  // Trades must occur at/after challenge.started_at (server assignability).
  const base = Math.max(startedAt + 60_000, Date.now() - 3_600_000);
  const entryIso = new Date(base).toISOString();
  const exitIso = new Date(base + 30 * 60 * 1000).toISOString();
  const tradeDate = exitIso.slice(0, 10);
  const tradeClientId = `ytqa-${Date.now().toString(36)}`;

  const { error: tradeErr } = await client.from("trade_journal").insert({
    user_id: userId,
    client_id: tradeClientId,
    trade_date: tradeDate,
    symbol: "ES",
    direction: "LONG",
    entry_time: entryIso,
    exit_time: exitIso,
    contracts: 1,
    pnl: 250,
    notes: "YTQA staging fixture trade",
  });
  if (tradeErr) throw new Error(`trade insert failed: ${tradeErr.message}`);

  const cmd = {
    accountId,
    challengeId,
    tradeClientIds: [tradeClientId],
    source: "manual",
    reasonCode: null,
    allowReassign: true,
    clientRequestId: newPropOsClientRequestId(),
  };
  const { data, error } = await client.rpc("prop_os_cmd_assign_trades", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("assign_trades", cmd),
    p_account_id: accountId,
    p_challenge_id: challengeId,
    p_trade_client_ids: cmd.tradeClientIds,
    p_source: "manual",
    p_reason_code: null,
    p_allow_reassign: true,
  });
  if (error || (data as { kind?: string })?.kind !== "success") {
    return {
      assigned: false,
      detail: error?.message || JSON.stringify(data)?.slice(0, 180),
      assignmentRevision: null as number | null,
    };
  }
  const assignmentRevision = Number(
    (data as { value?: { assignmentRevision?: number } }).value?.assignmentRevision ?? 1,
  );
  return { assigned: true, detail: "ok", assignmentRevision };
}

async function cleanupQaLabel(client: SupabaseClient, admin: SupabaseClient | null) {
  // Soft cleanup: mark QA accounts' challenges ended when admin available; otherwise report only.
  const { data: accounts } = await client
    .from("prop_accounts")
    .select("id,label")
    .ilike("label", `${QA_LABEL_PREFIX}%`);
  const ids = (accounts || []).map((a) => String(a.id));
  if (!ids.length) {
    console.info("[YTQA:seed] cleanup nothing_to_do");
    return;
  }
  if (!admin) {
    console.info("[YTQA:seed] cleanup listed_accounts", { count: ids.length, prefixes: ids.map(red) });
    console.info("[YTQA:seed] cleanup skipped_mutations (no service role)");
    return;
  }
  for (const id of ids) {
    await admin
      .from("prop_challenges")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("account_id", id)
      .neq("status", "ended");
  }
  console.info("[YTQA:seed] cleanup ended_challenges", { accountCount: ids.length });
}

async function main() {
  const cleanup = process.argv.includes("--cleanup-qa-label");
  const url = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const anon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const processorSecret = (process.env.PROP_OS_PROCESSOR_SHARED_SECRET || "").trim();
  const host = urlHost(url);
  if (!url || !anon) throw new Error("missing SUPABASE_URL / anon key");
  if (host.includes(PROD_HOST)) {
    console.error("REFUSE: production host");
    process.exit(2);
  }
  if (!host.includes(STAGING_HOST)) {
    console.error(`REFUSE: expected staging host ${STAGING_HOST}, got ${host}`);
    process.exit(2);
  }

  const allowEmail = requireEnv("STAGING_QA_ALLOW_EMAIL");
  const allowPassword = requireEnv("STAGING_QA_ALLOW_PASSWORD");
  const expectedUid = (process.env.STAGING_QA_ALLOW_USER_ID || "").trim();

  const allow = await signIn(url, anon, allowEmail, allowPassword);
  if (expectedUid && allow.userId !== expectedUid) {
    throw new Error(`allow user mismatch expected=${red(expectedUid)} got=${red(allow.userId)}`);
  }
  console.info("[YTQA:seed] auth_ok", { user: red(allow.userId), host });

  const admin = serviceRole
    ? createClient(url, serviceRole, { auth: { persistSession: false } })
    : null;

  if (cleanup) {
    await cleanupQaLabel(allow.client, admin);
    return;
  }

  const label = `${QA_LABEL_PREFIX} ${new Date().toISOString().slice(0, 10)}`;
  const account = await ensureAccount(allow.client, label);
  console.info("[YTQA:seed] account", { id: red(account.accountId), created: account.created });

  // Read model resolves account via preferences.default_account_id — without it UI stays no_account.
  {
    const cmd = {
      accountId: account.accountId,
      clientRequestId: newPropOsClientRequestId(),
    };
    const { data, error } = await allow.client.rpc("prop_os_cmd_set_default_account", {
      p_request_id: cmd.clientRequestId,
      p_request_hash: hashPropOsCommandPayload("set_default_account", cmd),
      p_account_id: account.accountId,
    });
    console.info("[YTQA:seed] set_default_account", {
      ok: !error && (data as { kind?: string })?.kind === "success",
      detail: error?.message || (data as { kind?: string })?.kind || "ok",
    });
  }

  const challenge = await ensureChallenge(allow.client, account.accountId);
  console.info("[YTQA:seed] challenge", {
    id: red(challenge.challengeId),
    created: challenge.created,
    status: challenge.status,
  });

  {
    const cmd = {
      accountId: account.accountId,
      challengeId: challenge.challengeId,
      clientRequestId: newPropOsClientRequestId(),
    };
    const { data, error } = await allow.client.rpc("prop_os_cmd_select_challenge", {
      p_request_id: cmd.clientRequestId,
      p_request_hash: hashPropOsCommandPayload("select_active_challenge", cmd),
      p_account_id: account.accountId,
      p_challenge_id: challenge.challengeId,
    });
    console.info("[YTQA:seed] select_challenge", {
      ok: !error && (data as { kind?: string })?.kind === "success",
      detail: error?.message || (data as { kind?: string })?.kind || "ok",
    });
  }

  const assign = await ensureTradeAndAssignment(
    allow.client,
    allow.userId,
    account.accountId,
    challenge.challengeId,
  );
  console.info("[YTQA:seed] assignment", {
    assigned: assign.assigned,
    revision: assign.assignmentRevision,
    detail: assign.detail,
  });

  // Snapshot presence
  const { data: snap } = await allow.client
    .from("prop_engine_snapshots")
    .select("id,captured_at,challenge_id")
    .eq("challenge_id", challenge.challengeId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.info("[YTQA:seed] snapshot", {
    present: !!snap?.id,
    id: red(snap?.id),
    captured: snap?.captured_at ? "yes" : "no",
  });

  if (!snap?.id && serviceRole && assign.assignmentRevision != null) {
    const mark = await callProcessor(
      url,
      serviceRole,
      anon,
      processorSecret || null,
      "prop-os-recalc-processor",
      {
        op: "mark_running",
        challengeId: challenge.challengeId,
        assignmentRevision: assign.assignmentRevision,
      },
    );
    console.info("[YTQA:seed] processor_mark_running", {
      status: mark.status,
      kind: mark.body?.kind || null,
    });
    console.info("[YTQA:seed] processor_note", {
      hint: "full snapshot persist uses trusted recalc path (see qa artifacts snap log); mark_running proved service-role auth",
    });
  } else if (!snap?.id && !serviceRole) {
    console.info("[YTQA:seed] processor_skipped", {
      reason: "SUPABASE_SERVICE_ROLE_KEY missing — account/challenge/default prefs still fix no_account",
    });
  }

  // Verify gate-driving row for allowlisted user
  const { data: accountsNow } = await allow.client.from("prop_accounts").select("id").limit(5);
  console.info("[YTQA:seed] prop_accounts_visible", { count: accountsNow?.length || 0 });
  console.info("[YTQA:seed] done", {
    next_expected_gate: snap?.id ? "ready_or_buffers" : "no_shadow_snapshot_or_challenge_progress",
  });
}

main().catch((err) => {
  console.error("[YTQA:seed] FAIL", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
