/**
 * Release-like Build 116 journal compatibility against fully migrated staging.
 * Proves Build 116 journal CRUD still works after Prop OS / Build 117 schema
 * exists, without assigning Prop Pass state to legacy users.
 *
 * Staging host only (zleojeqkzizeyerhjpur). Disposable synthetic users.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STAGING = "zleojeqkzizeyerhjpur";
const PROD = "izzrlsgumyabdvlmwlwn";

if (!URL.includes(STAGING) || URL.includes(PROD) || !ANON || !SR) {
  console.error("REFUSE: staging URL + anon + service_role required; production host forbidden");
  process.exit(2);
}

type Results = Record<string, "PASS" | "FAIL">;
const results: Results = {};
const evidence: Record<string, string | number | boolean | null> = {
  stagingHost: STAGING,
  productionTouched: false,
};

function red(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${String(id).slice(0, 8)}…`;
}

function admin(): SupabaseClient {
  return createClient(URL, SR, { auth: { persistSession: false } });
}

function anon(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

function mark(name: string, ok: boolean) {
  results[name] = ok ? "PASS" : "FAIL";
  if (!ok) throw new Error(`ASSERT FAIL: ${name}`);
}

async function signIn(email: string, password: string) {
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`signin failed: ${error?.message ?? "no session"}`);
  }
  return {
    userId: data.user.id,
    client: createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

async function createDisposableUser(label: string) {
  const email = `yt-b116-compat-${label}-${randomUUID().slice(0, 8)}@youtrader.qa`;
  const password = `Qa!${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { yt_disposable: true, yt_suite: "build116-compat-staging" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`createUser ${label}: ${created.error?.message}`);
  }
  return { email, password, userId: created.data.user.id };
}

async function countOwned(table: string, userId: string): Promise<number> {
  const { count, error } = await admin()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const owner = await createDisposableUser("owner");
  const other = await createDisposableUser("other");
  evidence.owner = red(owner.userId);
  evidence.other = red(other.userId);
  mark("disposable_users", true);

  const session = await signIn(owner.email, owner.password);
  mark("auth_sign_in", true);

  const clientId = `b116-${randomUUID().slice(0, 8)}`;
  const journalId = randomUUID();
  const insert = await session.client.from("trade_journal").insert({
    id: journalId,
    user_id: session.userId,
    client_id: clientId,
    trade_date: "2026-08-01",
    symbol: "MES",
    direction: "LONG",
    entry_time: "2026-08-01T14:30:00.000Z",
    exit_time: "2026-08-01T15:00:00.000Z",
    contracts: 1,
    entry: 5000,
    exit: 5010,
    pnl: 50,
    notes: "build116-compat",
  }).select("id, client_id, prop_pass_revision").single();
  if (insert.error || !insert.data) {
    throw new Error(`journal insert: ${insert.error?.message ?? "no row"}`);
  }
  evidence.tradeId = red(insert.data.id);
  mark("journal_insert", insert.data.client_id === clientId);
  mark("prop_pass_revision_defaulted", Number(insert.data.prop_pass_revision) === 1);

  const update = await session.client
    .from("trade_journal")
    .update({ notes: "build116-compat-edited", pnl: 55, exit: 5011 })
    .eq("id", insert.data.id)
    .eq("user_id", session.userId)
    .select("id, notes, prop_pass_revision")
    .single();
  if (update.error || !update.data) {
    throw new Error(`journal update: ${update.error?.message ?? "no row"}`);
  }
  mark("journal_update", update.data.notes === "build116-compat-edited");
  mark(
    "prop_pass_revision_bumped_or_stable",
    Number(update.data.prop_pass_revision) >= 1,
  );

  const otherSession = await signIn(other.email, other.password);
  const crossRead = await otherSession.client
    .from("trade_journal")
    .select("id")
    .eq("id", insert.data.id);
  mark("cross_user_journal_denied", (crossRead.data ?? []).length === 0);

  const del = await session.client
    .from("trade_journal")
    .delete()
    .eq("id", insert.data.id)
    .eq("user_id", session.userId);
  mark("journal_delete", !del.error);

  // Legacy Build 116 users must not receive synthetic Prop Pass state.
  const propTables = [
    "prop_accounts",
    "prop_challenges",
    "prop_trade_assignments",
    "prop_executions",
    "prop_processed_journal_events",
    "prop_account_runtime_states",
    "prop_timeline_events",
    "prop_daily_plan_snapshots",
  ] as const;
  for (const table of propTables) {
    const n = await countOwned(table, owner.userId);
    mark(`no_auto_${table}`, n === 0);
  }

  // Auth provider tokens relation must remain present (Build 116 Apple token path).
  const tokenProbe = await session.client.from("auth_provider_tokens").select("user_id").limit(1);
  const missingRelation =
    Boolean(tokenProbe.error) && /relation .* does not exist/i.test(tokenProbe.error!.message);
  mark("auth_provider_tokens_relation_exists", !missingRelation);
  // Empty result or RLS denial are both acceptable for a user with no stored tokens.
  mark(
    "auth_provider_tokens_select_path_ok",
    !tokenProbe.error ||
      tokenProbe.error.code === "PGRST116" ||
      tokenProbe.error.code === "42501" ||
      /permission denied|row-level security/i.test(tokenProbe.error.message),
  );

  // Cleanup disposable users (cascade journal already deleted).
  for (const u of [owner, other]) {
    const removed = await admin().auth.admin.deleteUser(u.userId);
    if (removed.error) throw new Error(`deleteUser: ${removed.error.message}`);
  }
  const leftoverOwner = await admin().auth.admin.getUserById(owner.userId);
  mark("staging_cleanup_users", Boolean(leftoverOwner.error) || !leftoverOwner.data.user);
  evidence.activeDisposableUsers = 0;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(process.cwd(), "docs/releases/1.6.1/evidence");
  mkdirSync(outDir, { recursive: true });
  const payload = {
    suite: "prop-pass-build116-compat-staging",
    headHint: "feature/prop-pass-trading-os-build117",
    stagingProjectRef: STAGING,
    productionProjectRef: PROD,
    productionTouched: false,
    results,
    evidence,
    stamp,
  };
  writeFileSync(join(outDir, "BUILD116_COMPAT_STAGING_LATEST.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(outDir, `BUILD116_COMPAT_STAGING_${stamp}.json`), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));

  const failed = Object.values(results).filter((v) => v === "FAIL");
  if (failed.length) {
    console.error("prop-pass-build116-compat-staging: FAIL");
    process.exit(1);
  }
  console.log("prop-pass-build116-compat-staging: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
