#!/usr/bin/env node
/** Restore ru.json from git HEAD App.tsx I18N blocks */
import { execSync } from "node:child_process";
import fs from "node:fs";

const src = execSync("git show HEAD:App.tsx", { encoding: "utf8" });

function extractConst(name) {
  const re = new RegExp(`const ${name}[^=]*=`);
  const idx = src.search(re);
  let start = src.indexOf("{", idx);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`Missing ${name}`);
}

function parseEntries(body) {
  const entries = {};
  const re = /([A-Za-z][A-Za-z0-9_]*)\s*:\s*("(?:\\.|[^"\\])*")/g;
  let m;
  while ((m = re.exec(body))) {
    entries[m[1]] = m[2].slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return entries;
}

function langBlock(objStr, lang) {
  const needle = `\n  ${lang}: {`;
  const idx = objStr.indexOf(needle);
  if (idx === -1) return {};
  const start = objStr.indexOf("{", idx);
  let depth = 0;
  for (let i = start; i < objStr.length; i++) {
    if (objStr[i] === "{") depth++;
    if (objStr[i] === "}") {
      depth--;
      if (depth === 0) return parseEntries(objStr.slice(start + 1, i));
    }
  }
  return {};
}

const i18n = extractConst("I18N");
const add = extractConst("I18N_ADDITIONS");
const en = { ...langBlock(i18n, "en"), ...langBlock(add, "en") };
let ru = { ...langBlock(i18n, "ru"), ...langBlock(add, "ru") };

// Apply ru patches from scripts/translations/ru.json if present
const patchPath = "scripts/translations/ru.json";
if (fs.existsSync(patchPath)) {
  ru = { ...ru, ...JSON.parse(fs.readFileSync(patchPath, "utf8")) };
}

for (const key of Object.keys(en)) {
  if (!ru[key]) ru[key] = en[key];
}

const sorted = Object.fromEntries(Object.keys(ru).sort().map((k) => [k, ru[k]]));
fs.writeFileSync("src/i18n/locales/ru.json", `${JSON.stringify(sorted, null, 2)}\n`);
const stillEn = Object.keys(en).filter((k) => sorted[k] === en[k]).length;
console.log(`ru.json restored — ${Object.keys(sorted).length} keys, ${stillEn} still English`);
