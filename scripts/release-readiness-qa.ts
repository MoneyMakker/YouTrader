#!/usr/bin/env npx tsx
/**
 * Release-readiness smoke checks — run before App Store submission.
 * Usage: npm run test:release-readiness
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FREE_MONTHLY_TRADE_LIMIT } from "../src/config/monetization";
import { runUsageLimitsQa } from "../src/config/usageLimitsEngine";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

type Check = { name: string; pass: boolean; detail: string };

function run(cmd: string) {
  execSync(cmd, { stdio: "pipe", encoding: "utf8" });
}

function envPresent(key: string) {
  const value = (process.env[key] || "").trim();
  return value.length > 0 && !value.toLowerCase().includes("your_");
}

const checks: Check[] = [];

try {
  run("npm run typecheck");
  checks.push({ name: "typecheck", pass: true, detail: "tsc --noEmit passed" });
} catch (error) {
  checks.push({ name: "typecheck", pass: false, detail: String(error) });
}

try {
  run("npm run security:check");
  checks.push({ name: "security_check", pass: true, detail: "no tracked secret patterns" });
} catch (error) {
  checks.push({ name: "security_check", pass: false, detail: String(error) });
}

try {
  run("npm run test:export-rate-limit");
  checks.push({ name: "export_rate_limit_qa", pass: true, detail: "7 scenarios passed" });
} catch (error) {
  checks.push({ name: "export_rate_limit_qa", pass: false, detail: String(error) });
}

try {
  run("npm run test:email-password");
  checks.push({ name: "email_password_qa", pass: true, detail: "email password flow scenarios passed" });
} catch (error) {
  checks.push({ name: "email_password_qa", pass: false, detail: String(error) });
}

const usageResults = runUsageLimitsQa();
const usageFailed = usageResults.filter((r) => !r.pass);
checks.push({
  name: "usage_limits_qa",
  pass: usageFailed.length === 0,
  detail: usageFailed.length ? usageFailed.map((r) => r.name).join(", ") : `${usageResults.length} scenarios passed`,
});

checks.push({
  name: "supabase_env",
  pass: envPresent("EXPO_PUBLIC_SUPABASE_URL") && envPresent("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  detail: "EXPO_PUBLIC_SUPABASE_URL + publishable key",
});
checks.push({
  name: "revenuecat_env",
  pass: envPresent("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY") && envPresent("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID"),
  detail: "iOS RevenueCat key + entitlement id",
});
checks.push({
  name: "google_signin_env",
  pass: envPresent("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID") && envPresent("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"),
  detail: "Google web + iOS client ids (required for native Google Sign-In on iOS builds)",
});
checks.push({
  name: "free_trade_limit",
  pass: FREE_MONTHLY_TRADE_LIMIT === 15,
  detail: `FREE_MONTHLY_TRADE_LIMIT=${FREE_MONTHLY_TRADE_LIMIT}`,
});

let failed = 0;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  if (!check.pass) failed += 1;
  console.log(`${status} ${check.name} — ${check.detail}`);
}

if (failed > 0) {
  console.error(`\n${failed} release-readiness check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} release-readiness checks passed.`);
