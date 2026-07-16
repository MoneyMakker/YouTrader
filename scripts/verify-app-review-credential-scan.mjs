import { execFileSync } from "node:child_process";

const fixture = "APP_REVIEW_TEST_PASSWORD=synthetic-test-only-credential";
try {
  execFileSync("gitleaks", ["detect", "--pipe", "--config", ".gitleaks.toml", "--redact"], { input: fixture, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  throw new Error("The App Review credential rule did not reject a synthetic unsafe example.");
} catch (error) {
  if (error instanceof Error && error.message.includes("did not reject")) throw error;
  if (typeof error === "object" && error !== null && "status" in error && error.status !== 1) throw error;
  console.log("App Review credential detector rejected the synthetic unsafe example.");
}
