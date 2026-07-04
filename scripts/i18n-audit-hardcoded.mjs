#!/usr/bin/env node
/** Audit remaining hardcoded English UI strings in src/ */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const allowPatterns = [
  /^YouTrader$/,
  /^YouTrader Pro$/,
  /^P&L$/,
  /^Profit Factor$/,
  /^Trading Radar$/,
  /^DNA Score$/,
  /^Heatmap$/,
  /^ORB$/,
  /^Stop Loss$/,
  /^Take Profit$/,
  /^ES$|^NQ$|^MNQ$|^MES$|^MGC$|^MCL$|^GC$|^CL$/,
  /^PRO$|^LIVE$|^HIGH$|^MED$|^LOW$/,
  /^Evaluation$|^Funded$|^Challenge$/,
  /^OK$|^N\/A$|^YES$|^NO$/,
  /^Offline$|^TBD$/,
  /^Finnhub$|^Yahoo Finance$/,
  /^Market desk$/,
  /^Version /,
  /^\d+K$/,
  /^\$[\d.]+/,
  /^—$/,
];

const skipFiles = [
  "src/i18n/locales/",
  "src/auth/emailPassword.qa.ts",
  "src/reports/weeklyReportHtml.ts",
];

let hits = [];
try {
  const raw = execSync(
    `rg -n '"[A-Z][a-zA-Z ,./%$&:!?\\-]{4,}"' src App.tsx --glob '!**/*.json' --glob '!**/*.qa.ts' 2>/dev/null || true`,
    { cwd: root, encoding: "utf8", maxBuffer: 10_000_000 },
  );
  for (const line of raw.split("\n").filter(Boolean)) {
    if (skipFiles.some((s) => line.includes(s))) continue;
    const m = line.match(/"([A-Z][^"]{3,})"/);
    if (!m) continue;
    const text = m[1];
    if (allowPatterns.some((p) => p.test(text))) continue;
    if (text.includes("Fed rate") || text.includes("Oil inventory") || text.includes("Crude Oil") || text.includes("FOMC") || text.includes("Payrolls")) continue;
    hits.push(line.trim());
  }
} catch {
  hits = ["audit rg failed"];
}

const unique = [...new Set(hits)];
console.log(`=== Hardcoded EN UI audit: ${unique.length} potential hits ===\n`);
unique.slice(0, 80).forEach((h) => console.log(h));
if (unique.length > 80) console.log(`... and ${unique.length - 80} more`);
