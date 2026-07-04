import type { Session } from "@supabase/supabase-js";
import { supabase } from "../config/appConfig";
import { EMAIL_MAGIC_LINK_FINISH_MESSAGE } from "./authErrors";
import { logEmailAuth, logSupabaseAuthResponse, serializeSupabaseError } from "./emailAuthDebug";

/**
 * The only place in the app that calls supabase.auth.exchangeCodeForSession.
 * Caller must validate PKCE preconditions before invoking.
 */
export async function exchangePkceCodeForSession(code: string, failLine: string): Promise<Session> {
  if (!supabase) {
    throw new Error("Account sign-in is not configured in this build.");
  }

  logEmailAuth("exchange_pkce_start", { failLine, codeLength: code.length });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  logSupabaseAuthResponse("exchangeCodeForSession", failLine, {
    sessionUserId: data.session?.user.id,
    error,
  });

  if (error) {
    const serialized = serializeSupabaseError(error);
    const isFlowState =
      serialized?.code?.includes("flow_state") ||
      String(serialized?.message || "")
        .toLowerCase()
        .includes("flow state");
    if (isFlowState) {
      throw Object.assign(new Error(EMAIL_MAGIC_LINK_FINISH_MESSAGE), {
        code: "flow_state_not_found",
        flow: "exchangeCodeForSession",
        failLine,
        supabaseError: serialized,
      });
    }
    throw error;
  }

  if (!data.session) {
    throw new Error(EMAIL_MAGIC_LINK_FINISH_MESSAGE);
  }

  return data.session;
}
