#!/usr/bin/env node
/**
 * Backup AI configuration before Preview Deploy.
 * Stores code config + secret names (never values).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_DIR = path.join(ROOT, "scripts/ai-platform-v2/backups", stamp);

const FILES = [
  "supabase/functions/_shared/aiPlatform/config.default.json",
  "supabase/functions/_shared/aiPlatform/config.ts",
  "supabase/functions/_shared/aiProvider.ts",
  "supabase/functions/ai-coach/index.ts",
  ".env.example",
];

function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const manifest = {
    createdAt: new Date().toISOString(),
    purpose: "pre-preview-deploy-ai-coach",
    projectRef: null,
    secretNames: [],
    files: [],
    aiCoachVersionBefore: null,
  };

  try {
    const linked = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/.temp/linked-project.json"), "utf8"));
    manifest.projectRef = linked.ref;
  } catch {
    manifest.projectRef = "unknown";
  }

  try {
    const fnList = JSON.parse(execFileSync("supabase", ["functions", "list", "--output-format", "json"], { cwd: ROOT, encoding: "utf8" }));
    const coach = fnList.functions?.find((f) => f.slug === "ai-coach");
    manifest.aiCoachVersionBefore = coach?.version ?? null;
  } catch {
    /* optional */
  }

  try {
    const secrets = JSON.parse(execFileSync("supabase", ["secrets", "list"], { cwd: ROOT, encoding: "utf8" }));
    manifest.secretNames = (secrets.secrets || []).map((s) => s.name).sort();
  } catch {
    manifest.secretNames = [];
  }

  for (const rel of FILES) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(BACKUP_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    manifest.files.push(rel);
  }

  fs.writeFileSync(path.join(BACKUP_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(ROOT, "scripts/ai-platform-v2/backups/LATEST"), stamp + "\n");

  console.log("AI configuration backup created:");
  console.log(BACKUP_DIR);
  console.log(`ai-coach version before deploy: ${manifest.aiCoachVersionBefore ?? "unknown"}`);
  console.log(`secrets tracked (names only): ${manifest.secretNames.length}`);
}

main();
