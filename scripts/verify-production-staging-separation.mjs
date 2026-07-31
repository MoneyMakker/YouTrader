#!/usr/bin/env node
/**
 * Verifies production Release and staging Release-Staging Xcode configs stay isolated.
 * Exit 0 on success; non-zero on assertion failure.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function extractArchiveBuildConfiguration(schemeXml) {
  const match = schemeXml.match(
    /<ArchiveAction[^>]*buildConfiguration\s*=\s*"([^"]+)"/,
  );
  return match?.[1] ?? null;
}

// Production scheme must archive with Release (not Release-Staging)
const productionScheme = read(
  "ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader.xcscheme",
);
const productionArchiveConfig =
  extractArchiveBuildConfiguration(productionScheme);
assert(
  productionArchiveConfig === "Release",
  `YouTrader.xcscheme ArchiveAction must use Release, got "${productionArchiveConfig}"`,
);
assert(
  productionArchiveConfig !== "Release-Staging",
  "Production scheme must NOT use Release-Staging for ArchiveAction",
);

// Staging scheme must archive with Release-Staging
const stagingScheme = read(
  "ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader-Staging.xcscheme",
);
const stagingArchiveConfig = extractArchiveBuildConfiguration(stagingScheme);
assert(
  stagingArchiveConfig === "Release-Staging",
  `YouTrader-Staging.xcscheme ArchiveAction must use Release-Staging, got "${stagingArchiveConfig}"`,
);

// Production app code: DEFAULT_ACTIVATION_CONFIG.mode stays off
const activationTypes = read("src/propOs/activation/types.ts");
assert(
  /DEFAULT_ACTIVATION_CONFIG[\s\S]*?mode:\s*"off"/.test(activationTypes),
  "DEFAULT_ACTIVATION_CONFIG.mode must remain off in types.ts",
);

// Staging env example uses staging_preview (not allowlist as sole mode name)
const stagingEnvExample = read("ios/.xcode.env.staging.example");
assert(
  stagingEnvExample.includes("EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE=staging_preview"),
  "ios/.xcode.env.staging.example must set EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE=staging_preview",
);
assert(
  !/EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE=allowlist\b/.test(stagingEnvExample),
  "ios/.xcode.env.staging.example must not hardcode allowlist as activation mode alone",
);

console.log("OK: production/staging Xcode separation verified");
process.exit(0);
