#!/usr/bin/env node
/**
 * Release Command Center — shared utilities.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const REPORT_DIR = path.join(ROOT, "scripts/release-command-center/reports");
export const SIGNOFF_DIR = path.join(ROOT, "docs/release-signoffs");

export function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

export function readJson(rel, fallback = null) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

export function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
    timeout: opts.timeout ?? 600_000,
    ...opts,
  });
}

export function tryRun(cmd, args, opts = {}) {
  try {
    const out = run(cmd, args, opts);
    return { ok: true, out, code: 0 };
  } catch (e) {
    return {
      ok: false,
      out: String(e.stdout || ""),
      err: String(e.stderr || e.message || ""),
      code: e.status ?? 1,
    };
  }
}

export function stepResult(id, title, checks, blockers = []) {
  const fails = checks.filter((c) => c.status === "FAIL").length;
  const warns = checks.filter((c) => c.status === "WARNING").length;
  let status = "PASS";
  if (fails > 0 || blockers.length > 0) status = "FAIL";
  else if (warns > 0) status = "WARNING";
  return { id, title, status, checks, fails, warns, blockers };
}

export function check(id, name, status, detail = "") {
  return { id, name, status, detail };
}

export function sectionBlocked(step) {
  return step.status === "FAIL";
}

export function collectBlockers(steps) {
  const blockers = [];
  for (const s of steps) {
    if (s.blockers?.length) blockers.push(...s.blockers.map((b) => `[${s.title}] ${b}`));
    for (const c of s.checks || []) {
      if (c.status === "FAIL") blockers.push(`[${s.title}] ${c.name}${c.detail ? `: ${c.detail}` : ""}`);
    }
  }
  return blockers;
}

export function printStep(step) {
  const icon = step.status === "PASS" ? "✅" : step.status === "FAIL" ? "❌" : "⚠️";
  console.log(`\n${icon} ${step.title} — ${step.status} (${step.fails} fail, ${step.warns} warn)`);
  for (const c of step.checks || []) {
    const ci = c.status === "PASS" ? "✅" : c.status === "FAIL" ? "❌" : "⚠️";
    console.log(`  ${ci} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  if (step.blockers?.length) {
    for (const b of step.blockers) console.log(`  ❌ BLOCKER: ${b}`);
  }
}

export function loadSignoff(name) {
  const p = path.join(SIGNOFF_DIR, `${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function parseArgs(argv) {
  const args = { mode: "testflight", dryRun: false, skipBuild: false, version: null };
  const rest = [...argv];
  if (rest[0] === "testflight" || rest[0] === "production" || rest[0] === "release") {
    args.mode = rest.shift();
  }
  if (args.mode === "release" && rest[0] && /^\d+\.\d+\.\d+/.test(rest[0])) {
    args.version = rest.shift();
  }
  for (const a of rest) {
    if (a === "--dry-run") args.dryRun = true;
    if (a === "--skip-build") args.skipBuild = true;
  }
  return args;
}
