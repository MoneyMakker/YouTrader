import type { Session } from "@supabase/supabase-js";
import { supabase } from "../config/appConfig";
import { logger } from "../lib/logger";
import { getEmailConfirmRedirectUri, getPasswordResetRedirectUri } from "./authConfig";
import { EMAIL_PASSWORD_MESSAGES, mapEmailPasswordError } from "./emailPasswordMessages";
import { isValidEmail, normalizeEmail } from "./emailOtpValidation";

export { isValidEmail, normalizeEmail } from "./emailOtpValidation";

const LOG_TAG = "[YouTrader:email-password-auth]";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Account sign-in is not configured in this build.");
  }
  return supabase;
}

export function userHasPasswordSet(session: Session | null): boolean {
  if (!session?.user) return false;
  const meta = session.user.user_metadata as { has_password?: boolean } | undefined;
  return meta?.has_password === true || session.user.app_metadata?.provider === "email";
}

export async function signInWithEmailPassword(email: string, password: string): Promise<Session> {
  logger.info(`${LOG_TAG} sign_in_started`);
  const client = requireSupabase();
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) throw Object.assign(new Error(mapEmailPasswordError(error)), { cause: error });
    if (!data.session) throw new Error(EMAIL_PASSWORD_MESSAGES.signInFailed);
    const { data: refreshed } = await client.auth.getSession();
    const session = refreshed.session || data.session;
    logger.info(`${LOG_TAG} sign_in_success`);
    return session;
  } catch (error) {
    logger.warn(`${LOG_TAG} sign_in_failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export type SignUpResult = "confirmation_sent" | Session;

export async function signUpWithEmailPassword(email: string, password: string): Promise<SignUpResult> {
  logger.info(`${LOG_TAG} sign_up_started`);
  const client = requireSupabase();
  try {
    const { data, error } = await client.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        emailRedirectTo: getEmailConfirmRedirectUri(),
        data: { has_password: true },
      },
    });
    if (error) throw Object.assign(new Error(mapEmailPasswordError(error)), { cause: error });
    if (data.session) {
      logger.info(`${LOG_TAG} sign_up_success`, { confirmed: true });
      return data.session;
    }
    logger.info(`${LOG_TAG} sign_up_success`, { confirmed: false, confirmationRequired: true });
    return "confirmation_sent";
  } catch (error) {
    logger.warn(`${LOG_TAG} sign_up_failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function updateUserPassword(newPassword: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({
    password: newPassword,
    data: { has_password: true },
  });
  if (error) throw Object.assign(new Error(mapEmailPasswordError(error)), { cause: error });
}

export async function updateUserEmail(newEmail: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({
    email: normalizeEmail(newEmail),
  });
  if (error) throw Object.assign(new Error(mapEmailPasswordError(error)), { cause: error });
}

export async function requestPasswordResetEmail(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: getPasswordResetRedirectUri(),
  });
  if (error) throw Object.assign(new Error(mapEmailPasswordError(error)), { cause: error });
}
