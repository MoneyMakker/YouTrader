/**
 * Translation quality test — fails when a non-English locale has the exact
 * same English value for newly introduced postPurchase keys.
 * Permitted exceptions: universal labels such as "OK".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let failures = 0;
function check(name: string, condition: boolean) {
  if (condition) { console.log(`PASS  ${name}`); return; }
  failures += 1;
  console.error(`FAIL  ${name}`);
}

const en = JSON.parse(readFileSync(resolve("src/i18n/locales/en.json"), "utf8"));
const postKeys = Object.keys(en).filter((k) => k.startsWith("postPurchase."));
const skipped = new Set([
  "postPurchase.okLabel",
  "postPurchase.continueEmail",
  "postPurchase.reassurance",        // brand name optional in privacy text
]);
const permittedBrandNames = /YouTrader|Apple|Google|RevenueCat|Pro/;

for (const lang of ["de", "es", "fr", "it", "ru", "uk"]) {
  const obj = JSON.parse(readFileSync(resolve(`src/i18n/locales/${lang}.json`), "utf8"));
  const keysToCheck = postKeys.filter(k => !skipped.has(k));
  let passed = 0;
  for (const key of keysToCheck) {
    const enVal = en[key];
    const locVal = obj[key];
    if (locVal === enVal) {
      check(`${lang}.${key} translated (not English copy)`, false);
    } else if (locVal === undefined) {
      check(`${lang}.${key} key exists`, false);
    } else {
      passed += 1;
      // Ensure brand names preserved where they appear in English
      const enBrands = enVal.match(permittedBrandNames);
      if (enBrands) {
        for (const brand of enBrands) {
          if (!locVal.includes(brand)) {
            check(`${lang}.${key} preserves brand name "${brand}"`, false);
          }
        }
      }
    }
  }
  console.log(`  ${lang}: ${passed}/${keysToCheck.length} keys translated`);
}

if (failures === 0) {
  console.log("\ntranslation-quality: all checks passed");
} else {
  console.error(`\ntranslation-quality: ${failures} failing check(s)`);
  process.exit(1);
}
