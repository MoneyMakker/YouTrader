/**
 * Build 116 production compatibility smoke after Build 117 SQL+processor deploy.
 * Activation remains OFF for real users. Disposable identity only.
 * Target: izzrlsgumyabdvlmwlwn
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROD = "izzrlsgumyabdvlmwlwn";
const STAGING = "zleojeqkzizeyerhjpur";

if (!URL.includes(PROD) || URL.includes(STAGING) || !ANON || !SR) {
  console.error("REFUSE: production URL + anon + service_role required; staging forbidden");
  process.exit(2);
}

const results: Record<string, "PASS" | "FAIL"> = {};
const evidence: Record<string, string | number | boolean | null> = {
  productionHost: PROD,
  activationClientWakeups: "OFF",
  realUserBuild117Activation: "NOT_AUTHORIZED",
};

function mark(name: string, ok: boolean) {
  results[name] = ok ? "PASS" : "FAIL";
  if (!ok) throw new Error(`ASSERT FAIL: ${name}`);
}

const admin = createClient(URL, SR, { auth: { persistSession: false } });
const email = `yt-b117-prod-b116-${randomUUID().slice(0, 8)}@youtrader.qa`;
const password = `Qa!${randomUUID().replace(/-/g, "").slice(0, 20)}`;
let userId = "";

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { yt_disposable: true, yt_suite: "build117-b116-compat-production" },
  });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "createUser");
  userId = created.data.user.id;

  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const signed = await anon.auth.signInWithPassword({ email, password });
  mark("b116_auth", Boolean(signed.data.session && signed.data.user?.id === userId));

  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${signed.data.session!.access_token}` } },
    auth: { persistSession: false },
  });

  // No Prop Pass account required for Build 116 journal path
  const { count: propAccounts } = await admin
    .from("prop_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  mark("no_fabricated_prop_account", (propAccounts ?? 0) === 0);

  const tradeId = randomUUID();
  const clientId = `b116-${randomUUID().slice(0, 8)}`;
  const inserted = await client
    .from("trade_journal")
    .insert({
      id: tradeId,
      user_id: userId,
      client_id: clientId,
      trade_date: "2026-08-01",
      symbol: "MES",
      direction: "LONG",
      entry_time: "2026-08-01T14:30:00.000Z",
      exit_time: "2026-08-01T15:00:00.000Z",
      contracts: 1,
      entry: 5000,
      exit: 5001,
      pnl: 50,
    })
    .select("id,prop_pass_revision")
    .single();
  mark("b116_journal_create", !inserted.error && Boolean(inserted.data?.id));

  const read = await client.from("trade_journal").select("id,pnl").eq("id", tradeId).maybeSingle();
  mark("b116_journal_read", !read.error && read.data?.id === tradeId);

  const edited = await client
    .from("trade_journal")
    .update({ pnl: 75, exit: 5001.5 })
    .eq("id", tradeId)
    .eq("user_id", userId)
    .select("pnl,prop_pass_revision")
    .single();
  mark("b116_journal_edit", !edited.error && edited.data?.pnl === 75);

  // Without assignment, no Prop Pass queue residue is required
  const { count: events } = await admin
    .from("prop_processed_journal_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  mark("no_mandatory_b117_queue_for_unassigned", (events ?? 0) === 0);

  const softDelete = await client
    .from("trade_journal")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tradeId)
    .eq("user_id", userId);
  mark("b116_journal_delete", !softDelete.error);

  // Allowlist empty => commands denied for this disposable user
  const { count: allow } = await admin
    .from("prop_os_command_allowlist")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  mark("user_not_allowlisted", (allow ?? 0) === 0);

  const logout = await client.auth.signOut();
  mark("logout_routing_compatible", !logout.error);

  evidence.allowlistGlobal =
    (
      await admin.from("prop_os_command_allowlist").select("user_id", { count: "exact", head: true })
    ).count ?? null;
} catch (error) {
  evidence.error = error instanceof Error ? error.message.slice(0, 280) : "unknown";
  console.error("b116 compat failed:", evidence.error);
} finally {
  if (userId) {
    await admin.from("trade_journal").delete().eq("user_id", userId);
    await admin.from("prop_processed_journal_events").delete().eq("user_id", userId);
    await admin.auth.admin.updateUserById(userId, {
      email: `scrubbed-b116-${userId.slice(0, 8)}@youtrader.qa.invalid`,
      ban_duration: "876000h",
      user_metadata: { yt_suite: "build117-b116-compat-production-scrubbed" },
    });
    await admin.auth.admin.deleteUser(userId);
  }
  const { count: leftover } = userId
    ? await admin.from("trade_journal").select("id", { count: "exact", head: true }).eq("user_id", userId)
    : { count: 0 };
  results.cleanup = (leftover ?? 0) === 0 ? "PASS" : "FAIL";
  evidence.leftoverTrades = leftover ?? 0;
}

const required = [
  "b116_auth",
  "b116_journal_create",
  "b116_journal_read",
  "b116_journal_edit",
  "b116_journal_delete",
  "no_fabricated_prop_account",
  "no_mandatory_b117_queue_for_unassigned",
  "user_not_allowlisted",
  "logout_routing_compatible",
  "cleanup",
];
const outDir = join("docs/releases/1.6.1/evidence");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report = { suite: "prop-pass-b116-compat-production", productionProjectRef: PROD, results, evidence, stamp };
writeFileSync(join(outDir, `B116_COMPAT_PRODUCTION_${stamp}.json`), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "B116_COMPAT_PRODUCTION_LATEST.json"), JSON.stringify(report, null, 2));
const failed = required.filter((k) => results[k] !== "PASS");
console.log(JSON.stringify({ results, evidence }, null, 2));
if (failed.length) {
  console.error("FAILED:", failed.join(", "));
  process.exit(1);
}
console.log("prop-pass-b116-compat-production: PASS");
