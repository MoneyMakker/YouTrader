import { t } from "../i18n";

export const EMAIL_PASSWORD_MESSAGES = {
  get invalidEmail() {
    return t("authInvalidEmail");
  },
  get passwordMinLength() {
    return t("authPasswordMinLength");
  },
  get passwordMismatch() {
    return t("authPasswordMismatch");
  },
  get passwordUpdated() {
    return t("passwordUpdated");
  },
  get passwordResetSent() {
    return t("authPasswordResetSent");
  },
  get signInFailed() {
    return t("authSignInFailedBody");
  },
  get signUpFailed() {
    return t("authSignUpFailed");
  },
  get emailChangeSent() {
    return t("emailChangeSent");
  },
  get emailNotConfirmed() {
    return t("authEmailNotConfirmed");
  },
  get rateLimited() {
    return t("authRateLimited");
  },
} as const;

export function mapEmailPasswordError(error: unknown): string {
  const record = error as { message?: string; code?: string };
  const message = String(record?.message || "").toLowerCase();
  const code = String(record?.code || "").toLowerCase();

  if (message.includes("invalid email") || code === "email_address_invalid") {
    return EMAIL_PASSWORD_MESSAGES.invalidEmail;
  }
  if (message.includes("email not confirmed") || code === "email_not_confirmed") {
    return EMAIL_PASSWORD_MESSAGES.emailNotConfirmed;
  }
  if (
    message.includes("invalid login") ||
    message.includes("invalid credentials") ||
    code === "invalid_credentials"
  ) {
    return EMAIL_PASSWORD_MESSAGES.signInFailed;
  }
  if (message.includes("rate") || message.includes("too many")) {
    return EMAIL_PASSWORD_MESSAGES.rateLimited;
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return t("authEmailAlreadyExists");
  }
  return EMAIL_PASSWORD_MESSAGES.signInFailed;
}
