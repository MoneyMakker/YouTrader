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
