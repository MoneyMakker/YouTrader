/**
 * Parse combined stdout/stderr from `eas build` for RCC reporting.
 */

const QUOTA_PATTERN = /used its iOS builds from the Free plan/i;
const QUOTA_RESET_PATTERN = /which will reset in (\d+) days?\s*\(on ([^)]+)\)/i;
const BUILD_FAILED_PATTERN = /build command failed/i;

export function mergeEasOutput(stdout = "", stderr = "") {
  return [stdout, stderr]
    .filter((chunk) => chunk && chunk.trim())
    .join("\n")
    .trim();
}

export function analyzeEasBuildOutput(combined = "") {
  const fullOutput = combined || "";
  const result = {
    quotaExhausted: false,
    resetDate: null,
    resetInDays: null,
    summary: null,
    lastErrorLine: null,
    fullOutput,
  };

  if (QUOTA_PATTERN.test(fullOutput)) {
    result.quotaExhausted = true;
    const resetMatch = fullOutput.match(QUOTA_RESET_PATTERN);
    if (resetMatch) {
      result.resetInDays = Number(resetMatch[1]);
      result.resetDate = resetMatch[2].trim();
    }
    result.summary = "EAS iOS build quota exhausted.";
    if (result.resetDate) {
      result.summary += ` Quota resets on ${result.resetDate}.`;
    }
    return result;
  }

  const errorLines = fullOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^Error:/i.test(line) || BUILD_FAILED_PATTERN.test(line));

  if (errorLines.length) {
    result.lastErrorLine = errorLines[errorLines.length - 1];
    result.summary = result.lastErrorLine;
    return result;
  }

  const lines = fullOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  result.summary = lines[lines.length - 1] || "EAS build failed";
  return result;
}

export function isEasBuildFailure(combined = "", exitOk = true) {
  if (!exitOk) return true;
  if (BUILD_FAILED_PATTERN.test(combined)) return true;
  if (QUOTA_PATTERN.test(combined)) return true;
  return false;
}
