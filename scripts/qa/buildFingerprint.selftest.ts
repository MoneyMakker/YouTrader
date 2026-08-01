/**
 * Staging build fingerprint helpers — Node-testable.
 * Run: npx tsx scripts/qa/buildFingerprint.selftest.ts
 */
import assert from "node:assert/strict";
import {
  buildFingerprintDiagnosticLines,
  buildFingerprintSearchToken,
  isStagingBuildFingerprintVisible,
  resolveBuildFingerprint,
} from "../../src/config/buildFingerprint";

const prev = { ...process.env };
try {
  process.env.EXPO_PUBLIC_APP_ENV = "staging";
  process.env.EXPO_PUBLIC_YT_SHOW_BUILD_FP = "1";
  // Clear env overrides so generated stub / empty values are visible when empty.
  delete process.env.EXPO_PUBLIC_YT_GIT_SHA;
  delete process.env.EXPO_PUBLIC_YT_BUILD_TIME;
  delete process.env.EXPO_PUBLIC_YT_XCODE_CONFIG;
  delete process.env.EXPO_PUBLIC_YT_BUNDLE_MARKER;

  assert.equal(isStagingBuildFingerprintVisible(), true);

  process.env.EXPO_PUBLIC_YT_GIT_SHA = "abc1234";
  process.env.EXPO_PUBLIC_YT_BUILD_TIME = "2026-08-01T20:00:00Z";
  process.env.EXPO_PUBLIC_YT_APP_VERSION = "1.6.1";
  process.env.EXPO_PUBLIC_YT_BUILD_NUMBER = "113";
  process.env.EXPO_PUBLIC_YT_XCODE_CONFIG = "Release-Staging";
  process.env.EXPO_PUBLIC_YT_BUNDLE_MARKER = "embedded-main.jsbundle";

  const fp = resolveBuildFingerprint();
  assert.equal(fp.gitSha, "abc1234");
  assert.equal(fp.buildNumber, "113");
  const token = buildFingerprintSearchToken(fp);
  assert.equal(token, "YT_BUILD_FP_v1:abc1234:113:Release-Staging");
  const lines = buildFingerprintDiagnosticLines(fp);
  assert.ok(lines.some((l) => l.includes(token)));

  process.env.EXPO_PUBLIC_APP_ENV = "production";
  assert.equal(isStagingBuildFingerprintVisible(), false);
} finally {
  process.env = prev;
}

console.log("buildFingerprint.selftest PASS");
