import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "App.tsx");
const source = fs.readFileSync(appPath, "utf8");

function extractObjectBody(marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing translation marker: ${marker}`);
  const start = source.indexOf("{", markerIndex);
  if (start === -1) throw new Error(`Missing object start for: ${marker}`);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  throw new Error(`Missing object end for: ${marker}`);
}

function extractLangBody(objectBody, lang) {
  const marker = `${lang}:`;
  const markerIndex = objectBody.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = objectBody.indexOf("{", markerIndex);
  if (start === -1) return "";
  let depth = 0;
  for (let index = start; index < objectBody.length; index += 1) {
    const char = objectBody[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return objectBody.slice(start + 1, index);
    }
  }
  return "";
}

function extractKeys(body) {
  const keys = new Set();
  const keyRegex = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm;
  let match;
  while ((match = keyRegex.exec(body))) keys.add(match[1]);
  return keys;
}

const languages = ["en", "ru", "es", "fr", "it", "uk", "de"];
const i18nBody = extractObjectBody("const I18N:");
const additionsBody = extractObjectBody("const I18N_ADDITIONS:");
const enKeys = new Set([
  ...extractKeys(extractLangBody(i18nBody, "en")),
  ...extractKeys(extractLangBody(additionsBody, "en")),
]);

const usedKeys = new Set();
const usageRegex = /\b(?:t|tText)\(\s*(?:lang,\s*)?["']([A-Za-z][A-Za-z0-9_]*)["']/g;
let usageMatch;
while ((usageMatch = usageRegex.exec(source))) usedKeys.add(usageMatch[1]);

const missingUsedKeys = [...usedKeys].filter((key) => !enKeys.has(key));
if (missingUsedKeys.length) {
  if (missingUsedKeys.length) {
    console.error("Translation keys used in App.tsx but missing from English dictionary:");
    for (const key of missingUsedKeys) console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log(`Translation check passed: ${enKeys.size} English keys available with fallback for ${languages.length} languages.`);
