/**
 * Staging-only idempotent email QA fixture preflight.
 * Validates staging host, allow/deny identities, Prop Pass eligibility,
 * and linked prop account — never prints credentials or full secrets.
 *
 * Usage (via preflight-email-fixture-staging.sh):
 *   npx tsx scripts/qa/preflight-email-fixture-staging.ts
 */
import { createClient } from "@supabase/supabase-js";

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

function allowlistPrefixes(env: NodeJS.ProcessEnv): string[] {
  const raw = (env.EXPO_PUBLIC_PROP_OS_ALLOWLIST || env.PROP_OS_ALLOWLIST || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlisted(userId: string, prefixes: string[]): boolean {
  const id = userId.toLowerCase();
  return prefixes.some((p) => id === p || id.startsWith(p));
}

type Role = "allow" | "deny";

async function ensureUser(
  url: string,
  serviceRole: string,
  email: string,
  password: string,
  expectedUid: string | null,
): Promise<{ userId: string; created: boolean; repaired: boolean }> {
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  if (expectedUid) {
    const existing = await admin.auth.admin.getUserById(expectedUid);
    if (existing.data.user?.id) {
      return { userId: existing.data.user.id, created: false, repaired: false };
    }
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(expectedUid ? { id: expectedUid } : {}),
  });
  if (!created.error && created.data.user?.id) {
    return { userId: created.data.user.id, created: true, repaired: false };
  }

  const msg = (created.error?.message || "").toLowerCase();
  if (!/already|registered|exists/i.test(msg)) {
    throw new Error(`createUser failed: ${created.error?.message || "no_user"}`);
  }

  // Email exists but password/sign-in failed — locate via paginated admin list (staging only).
  for (let page = 1; page <= 10; page += 1) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (list.error) throw new Error(`admin listUsers failed: ${list.error.message}`);
    const found = (list.data.users || []).find(
      (u) => (u.email || "").trim().toLowerCase() === email.trim().toLowerCase(),
    );
    if (found?.id) {
      if (expectedUid && found.id !== expectedUid) {
        throw new Error(
          `user id drift expected=${red(expectedUid)} got=${red(found.id)}`,
        );
      }
      return { userId: found.id, created: false, repaired: false };
    }
    if ((list.data.users || []).length < 200) break;
  }
  throw new Error(`createUser reported exists but email not found for ${email.split("@")[1] || "domain"}`);
}

async function signInOrRepair(
  url: string,
  anon: string,
  serviceRole: string | null,
  role: Role,
  email: string,
  password: string,
  expectedUid: string | null,
): Promise<{ userId: string; created: boolean; repaired: boolean }> {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (!error && data.user?.id) {
    if (expectedUid && data.user.id !== expectedUid) {
      throw new Error(
        `${role} uid mismatch expected=${red(expectedUid)} got=${red(data.user.id)}`,
      );
    }
    return { userId: data.user.id, created: false, repaired: false };
  }

  if (!serviceRole) {
    throw new Error(
      `${role} signIn failed (${error?.message || "no_session"}) and SUPABASE_SERVICE_ROLE_KEY missing for repair`,
    );
  }

  const ensured = await ensureUser(url, serviceRole, email, password, expectedUid);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  await admin.auth.admin.updateUserById(ensured.userId, {
    password,
    email_confirm: true,
  });

  const retry = await client.auth.signInWithPassword({ email, password });
  if (retry.error || !retry.data.user?.id) {
    throw new Error(
      `${role} signIn still failed after repair: ${retry.error?.message || "no_session"}`,
    );
  }
  if (expectedUid && retry.data.user.id !== expectedUid) {
    throw new Error(
      `${role} uid mismatch after repair expected=${red(expectedUid)} got=${red(retry.data.user.id)}`,
    );
  }
  return { userId: retry.data.user.id, created: ensured.created, repaired: true };
}

async function propAccountStatus(
  url: string,
  anon: string,
  email: string,
  password: string,
): Promise<{ visibleAccounts: number; defaultAccount: boolean }> {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { visibleAccounts: 0, defaultAccount: false };
  }
  const authed = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false },
  });
  const { data: accounts } = await authed.from("prop_accounts").select("id").limit(10);
  const { data: prefs } = await authed
    .from("prop_preferences")
    .select("default_account_id")
    .maybeSingle();
  return {
    visibleAccounts: accounts?.length || 0,
    defaultAccount: !!(prefs as { default_account_id?: string } | null)?.default_account_id,
  };
}

async function main() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
  const anon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || null;
  const host = urlHost(url);

  if (!url || !anon) throw new Error("missing SUPABASE_URL / anon key");
  if (host.includes(PROD_HOST)) {
    console.error("REFUSE: production host");
    process.exit(2);
  }
  if (!host.includes(STAGING_HOST)) {
    console.error(`REFUSE: expected staging host containing ${STAGING_HOST}, got=${host || "empty"}`);
    process.exit(2);
  }
  const appEnv = (process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || "").trim().toLowerCase();
  if (appEnv === "production" || appEnv === "prod") {
    console.error("REFUSE: production APP_ENV");
    process.exit(2);
  }

  const allowEmail = requireEnv("STAGING_QA_ALLOW_EMAIL");
  const allowPassword = requireEnv("STAGING_QA_ALLOW_PASSWORD");
  const denyEmail = requireEnv("STAGING_QA_DENY_EMAIL");
  const denyPassword = requireEnv("STAGING_QA_DENY_PASSWORD");
  const expectedAllow = (process.env.STAGING_QA_ALLOW_USER_ID || "").trim() || null;
  const expectedDeny = (process.env.STAGING_QA_DENY_USER_ID || "").trim() || null;
  const prefixes = allowlistPrefixes(process.env);

  const allow = await signInOrRepair(
    url,
    anon,
    serviceRole,
    "allow",
    allowEmail,
    allowPassword,
    expectedAllow,
  );
  const deny = await signInOrRepair(
    url,
    anon,
    serviceRole,
    "deny",
    denyEmail,
    denyPassword,
    expectedDeny,
  );

  const allowEligible = isAllowlisted(allow.userId, prefixes);
  const denyEligible = isAllowlisted(deny.userId, prefixes);
  if (!allowEligible) {
    throw new Error(
      `allow user ${red(allow.userId)} is not on Prop Pass allowlist (prefixes=${prefixes.length})`,
    );
  }
  if (denyEligible) {
    throw new Error(
      `deny user ${red(deny.userId)} unexpectedly matches Prop Pass allowlist`,
    );
  }

  const prop = await propAccountStatus(url, anon, allowEmail, allowPassword);

  console.info("[YTQA:preflight] ok", {
    host,
    appEnv: appEnv || "unset",
    allow: {
      user: red(allow.userId),
      created: allow.created,
      repaired: allow.repaired,
      propPassEligible: allowEligible,
      propAccounts: prop.visibleAccounts,
      defaultAccount: prop.defaultAccount,
    },
    deny: {
      user: red(deny.userId),
      created: deny.created,
      repaired: deny.repaired,
      propPassEligible: denyEligible,
    },
    serviceRolePresent: !!serviceRole,
  });
}

main().catch((err) => {
  console.error("[YTQA:preflight] FAIL", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
