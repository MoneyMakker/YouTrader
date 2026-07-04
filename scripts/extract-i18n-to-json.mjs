#!/usr/bin/env node
/**
 * One-time extractor: App.tsx I18N + I18N_ADDITIONS → src/i18n/locales/*.json
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "App.tsx");
const source = fs.readFileSync(appPath, "utf8");

function extractObjectBody(marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing: ${marker}`);
  const start = source.indexOf("{", markerIndex);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed object: ${marker}`);
}

function parseLangEntries(objStr, lang) {
  const marker = `${lang}:`;
  const idx = objStr.indexOf(marker);
  if (idx === -1) return {};
  const start = objStr.indexOf("{", idx);
  let depth = 0;
  let end = start;
  for (let i = start; i < objStr.length; i++) {
    if (objStr[i] === "{") depth++;
    if (objStr[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = objStr.slice(start + 1, end);
  const entries = {};
  const keyValueRe = /([A-Za-z][A-Za-z0-9_]*)\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
  let m;
  while ((m = keyValueRe.exec(body))) {
    const key = m[1];
    let val = m[2].slice(1, -1);
    val = val.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
    entries[key] = val;
  }
  return entries;
}

const langs = ["en", "ru", "es", "fr", "it", "uk", "de"];
const i18nObj = extractObjectBody("const I18N:");
const addObj = extractObjectBody("const I18N_ADDITIONS:");

const merged = {};
for (const lang of langs) {
  merged[lang] = {
    ...parseLangEntries(i18nObj, lang),
    ...parseLangEntries(addObj, lang),
  };
}

// English is source of truth — fill missing keys from en
const enKeys = Object.keys(merged.en);
for (const lang of langs) {
  if (lang === "en") continue;
  for (const key of enKeys) {
    if (!merged[lang][key]) merged[lang][key] = merged.en[key];
  }
}

const outDir = path.join(root, "src/i18n/locales");
fs.mkdirSync(outDir, { recursive: true });
for (const lang of langs) {
  const sorted = Object.fromEntries(
    Object.keys(merged[lang])
      .sort()
      .map((k) => [k, merged[lang][k]]),
  );
  fs.writeFileSync(path.join(outDir, `${lang}.json`), `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`${lang}.json — ${Object.keys(sorted).length} keys`);
}
