import { isValidEmail, normalizeEmail } from "./emailOtpValidation";
import { EMAIL_PASSWORD_MESSAGES, mapEmailPasswordError } from "./emailPasswordMessages";

export type QaResult = { name: string; pass: boolean; detail?: string };

export function runEmailPasswordQa(): QaResult[] {
  const results: QaResult[] = [];

  results.push({
    name: "valid_email",
    pass: isValidEmail("trader@example.com"),
  });
  results.push({
    name: "invalid_email",
    pass: !isValidEmail("not-an-email"),
  });
  results.push({
    name: "normalize_email",
    pass: normalizeEmail("  Trader@Example.COM ") === "trader@example.com",
  });
  results.push({
    name: "password_min_length_message",
    pass: EMAIL_PASSWORD_MESSAGES.passwordMinLength.includes("8"),
  });
  results.push({
    name: "invalid_credentials_mapping",
    pass: mapEmailPasswordError({ message: "Invalid login credentials" }) === EMAIL_PASSWORD_MESSAGES.signInFailed,
  });
  results.push({
    name: "email_not_confirmed_mapping",
    pass: mapEmailPasswordError({ code: "email_not_confirmed" }) === EMAIL_PASSWORD_MESSAGES.emailNotConfirmed,
  });

  return results;
}

export function runEmailPasswordQaOrThrow(): QaResult[] {
  const results = runEmailPasswordQa();
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    throw new Error(`email-password QA failed: ${failed.map((f) => f.name).join(", ")}`);
  }
  return results;
}
