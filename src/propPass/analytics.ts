import { trackEvent } from "../observability/analytics";
import { redactId } from "../propOs/activation/diagnostics";

const ALLOWED = new Set([
  "prop_pass_entry_visible",
  "prop_pass_opened",
  "prop_pass_ui_state_resolved",
  "prop_pass_challenge_selection_required",
  "prop_pass_stale_snapshot_displayed",
  "prop_pass_incomplete_data_displayed",
  "prop_pass_repository_fallback_displayed",
  "prop_pass_internal_preview_closed",
  "prop_pass_onboarding_opened",
  "prop_pass_template_selected",
  "prop_pass_rule_confirmation_displayed",
  "prop_pass_account_create_succeeded",
  "prop_pass_account_create_failed",
  "prop_pass_challenge_create_succeeded",
  "prop_pass_challenge_create_failed",
  "prop_pass_default_account_changed",
  "prop_pass_challenge_selection_changed",
  "prop_pass_account_archived",
  "prop_pass_command_conflict",
  "prop_pass_command_forbidden",
  "prop_pass_command_latency",
]);

export function trackPropPassEvent(
  name: string,
  props?: {
    kind?: string;
    mode?: string;
    userId?: string | null;
    reasonCodes?: string[];
  },
): void {
  if (!ALLOWED.has(name)) return;
  trackEvent(name, {
    kind: props?.kind ?? null,
    mode: props?.mode ?? null,
    user_ref: props?.userId ? redactId(props.userId) : null,
    reason_codes: props?.reasonCodes?.slice(0, 6).join(",") ?? null,
  });
}
