import { check, stepResult, readText, tryRun } from "../lib.mjs";

const EXPECTED_BUNDLE = "com.youtrader.pro";
const EXPECTED_PROJECT = "02ed40d6-5ad8-4a6d-9716-5ba40ec714c6";
const LINKED_REF = "izzrlsgumyabdvlmwlwn";

export function versionValidation(targetVersion = null) {
  const checks = [];
  const blockers = [];

  const appJson = JSON.parse(readText("app.json"));
  const pkg = JSON.parse(readText("package.json"));
  const eas = JSON.parse(readText("eas.json"));

  const version = appJson.expo?.version;
  const build = appJson.expo?.ios?.buildNumber;
  const runtime = appJson.expo?.runtimeVersion?.policy || JSON.stringify(appJson.expo?.runtimeVersion);
  const bundle = appJson.expo?.ios?.bundleIdentifier;
  const projectId = appJson.expo?.extra?.eas?.projectId;

  checks.push(check("version", "expo.version", version ? "PASS" : "FAIL", version));
  checks.push(check("build", "iOS buildNumber", build ? "PASS" : "FAIL", build));
  checks.push(check("runtime", "runtimeVersion policy", runtime === "appVersion" ? "PASS" : "WARNING", String(runtime)));
  checks.push(check("bundle", "bundleIdentifier", bundle === EXPECTED_BUNDLE ? "PASS" : "FAIL", bundle));
  checks.push(check("pkg_version", "package.json version match", version === pkg.version ? "PASS" : "FAIL", `app ${version} / pkg ${pkg.version}`));
  checks.push(check("eas_preview", "EAS preview profile", eas.build?.preview ? "PASS" : "FAIL", eas.build.preview?.channel || ""));
  checks.push(check("eas_production", "EAS production profile", eas.build?.production ? "PASS" : "FAIL"));
  checks.push(check("eas_project", "EAS projectId", projectId === EXPECTED_PROJECT ? "PASS" : "FAIL", projectId));

  if (targetVersion && version !== targetVersion) {
    checks.push(check("target_version", `Target version ${targetVersion}`, "FAIL", `app is ${version}`));
    blockers.push(`Version mismatch: expected ${targetVersion}, got ${version}`);
  }

  const envExample = readText(".env.example");
  checks.push(check("revenuecat", "RevenueCat entitlement in .env.example", envExample.includes("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID") ? "PASS" : "WARNING"));

  let linkedRef = LINKED_REF;
  try {
    const linked = JSON.parse(readText("supabase/.temp/linked-project.json"));
    linkedRef = linked.ref || LINKED_REF;
  } catch {
    /* default */
  }
  checks.push(check("supabase", "Linked Supabase project", linkedRef === LINKED_REF ? "PASS" : "WARNING", linkedRef));

  if (bundle !== EXPECTED_BUNDLE) blockers.push(`Bundle ID changed: ${bundle}`);

  return stepResult("version", "Step 8 — Version Validation", checks, blockers);
}
