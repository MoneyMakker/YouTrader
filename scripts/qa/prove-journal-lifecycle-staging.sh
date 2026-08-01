#!/usr/bin/env bash
# Lane A — unique-marker journal edit/delete with staging backend before/after dumps.
# No reseed between edit and delete. Fixed sleep is not the correctness mechanism.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
UDID="${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}"
ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-logs}"
SHOT_DIR="${YT_QA_SCREENSHOT_DIR:-$ROOT/docs/releases/1.6.1/phase4f-screenshots}"
mkdir -p "$ART_DIR" "$SHOT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MARKER="S11-$(date -u +%H%M%S)"
NOTES="QA-${MARKER}"
NOTES_EDITED="QA-${MARKER}-EDITED"
LOG="$ART_DIR/journal_lifecycle_s11_${MARKER}.log"
FLOW="$ROOT/.maestro/yt3/lane_a_journal_lifecycle_s11.yaml"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"
log() { echo "$*" | tee -a "$LOG"; }

log "journal_lifecycle_s11_start marker=$MARKER stamp=$STAMP"

bash scripts/qa/bootstrap-email-session-staging.sh 2>&1 | tee -a "$LOG"

dump_backend() {
  local label="$1"
  local out="$ART_DIR/journal_backend_${MARKER}_${label}.json"
  set -a
  # shellcheck disable=SC1091
  source ios/.xcode.env.staging
  set +a
  DATA_DIR="$(xcrun simctl get_app_container "$UDID" com.youtrader.pro data 2>/dev/null || true)"
  FIXTURE="${DATA_DIR}/Documents/qa-fixtures/email-login.json"
  if [[ ! -f "$FIXTURE" ]]; then
    log "BACKEND_DUMP_SKIP missing_fixture label=$label"
    return 0
  fi
  MARKER_Q="$MARKER" OUT="$out" FIXTURE="$FIXTURE" npx tsx - <<'TS' 2>&1 | tee -a "$LOG"
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const anon =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const marker = process.env.MARKER_Q || "";
const out = process.env.OUT || "";
const fixturePath = process.env.FIXTURE || "";
if (!url.includes("zleojeqkzizeyerhjpur")) {
  console.error("REFUSE_NON_STAGING", url);
  process.exit(2);
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const allow = fixture.allow || fixture.roles?.allow;
if (!allow?.email || !allow?.password) {
  console.error("NO_ALLOW_CREDS");
  process.exit(3);
}
const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: allow.email,
  password: allow.password,
});
if (authErr || !auth.user) {
  console.error("AUTH_FAIL", authErr?.message);
  process.exit(4);
}
const { data, error } = await sb
  .from("trade_journal")
  .select("id,client_id,notes,pnl,entry,exit,contracts,updated_at,deleted_at,created_at")
  .eq("user_id", auth.user.id)
  .ilike("notes", `%${marker}%`)
  .order("updated_at", { ascending: false });
if (error) {
  console.error("QUERY_FAIL", error.message);
  process.exit(5);
}
const payload = {
  marker,
  userPrefix: auth.user.id.slice(0, 8),
  count: (data || []).length,
  active: (data || []).filter((r) => !r.deleted_at).length,
  rows: data || [],
};
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log("BACKEND_DUMP", out, "count=", payload.count, "active=", payload.active);
for (const r of payload.rows) {
  console.log(
    JSON.stringify({
      idPrefix: String(r.id).slice(0, 12),
      clientPrefix: String(r.client_id || "").slice(0, 16),
      notes: r.notes,
      pnl: r.pnl,
      entry: r.entry,
      exit: r.exit,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
    }),
  );
}
await sb.auth.signOut();
TS
}

cat > "$FLOW" <<YAML
appId: com.youtrader.pro
---
# Unique marker ${MARKER} — edit then delete, no reseed
- launchApp:
    clearState: false
- openLink: youtrader://qa/email-login?role=allow
- repeat:
    times: 12
    commands:
      - runFlow:
          when:
            visible: "Dismiss"
          commands:
            - tapOn: "Dismiss"
      - runFlow:
          when:
            visible: "Unlock Your Trading Edge"
          commands:
            - tapOn:
                id: "acquisition-paywall-close"
- extendedWaitUntil:
    visible: "Journal"
    timeout: 90000
- tapOn: "Journal"
- assertVisible: "Journal"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_precondition

- openLink: "youtrader://qa/seed-trade?marker=${MARKER}&pnl=50&notes=${NOTES}"
- waitForAnimationToEnd
- scrollUntilVisible:
    element: ".*notes:${NOTES}.*"
    direction: DOWN
    timeout: 25000
    visibilityPercentage: 10
- assertVisible: ".*notes:${NOTES}.*"
- assertVisible: ".*\\\\+\\\\\$50\\\\.00.*"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_journal_create

- openLink: youtrader://qa/tab?id=stats
- waitForAnimationToEnd
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_stats_before_edit
- openLink: youtrader://qa/tab?id=calendar
- waitForAnimationToEnd
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_calendar_before_edit
- openLink: youtrader://qa/tab?id=journal
- waitForAnimationToEnd

- openLink: "youtrader://qa/apply-trade-edit?marker=${MARKER}&notes=${NOTES_EDITED}&pnl=125&exit=5225"
- waitForAnimationToEnd
- extendedWaitUntil:
    visible: "Update Trade"
    timeout: 25000
- assertVisible:
    id: "journal.trade.edit.pnl"
- scrollUntilVisible:
    element:
      id: "journal.trade.save"
    direction: DOWN
    timeout: 20000
    visibilityPercentage: 40
- tapOn:
    id: "journal.trade.save"
- waitForAnimationToEnd
- runFlow:
    when:
      visible: "Maybe later"
    commands:
      - tapOn: "Maybe later"
- runFlow:
    when:
      visible: "Close"
    commands:
      - tapOn: "Close"
- scrollUntilVisible:
    element: ".*notes:${NOTES_EDITED}.*"
    direction: DOWN
    timeout: 25000
    visibilityPercentage: 10
- assertVisible: ".*notes:${NOTES_EDITED}.*"
- assertVisible: ".*\\\\+\\\\\$125\\\\.00.*"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_journal_after_edit

- openLink: youtrader://qa/tab?id=stats
- waitForAnimationToEnd
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_stats_after_edit
- openLink: youtrader://qa/tab?id=calendar
- waitForAnimationToEnd
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_calendar_after_edit
- openLink: youtrader://qa/tab?id=journal
- waitForAnimationToEnd

# DELETE cancel
- openLink: "youtrader://qa/apply-trade-edit?marker=${MARKER}&notes=${NOTES_EDITED}&pnl=125&t=cancel1"
- waitForAnimationToEnd
- extendedWaitUntil:
    visible: "Update Trade"
    timeout: 20000
- scrollUntilVisible:
    element:
      id: "journal.trade.delete"
    direction: DOWN
    timeout: 20000
    visibilityPercentage: 40
- tapOn:
    id: "journal.trade.delete"
- extendedWaitUntil:
    visible:
      id: "journal.trade.delete.confirm"
    timeout: 10000
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_delete_sheet
- tapOn:
    id: "journal.trade.delete.cancel"
- waitForAnimationToEnd
- assertNotVisible:
    id: "journal.trade.delete.confirm"
- scrollUntilVisible:
    element: ".*notes:${NOTES_EDITED}.*"
    direction: DOWN
    timeout: 20000
    visibilityPercentage: 10
- assertVisible: ".*notes:${NOTES_EDITED}.*"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_after_delete_cancel

# DELETE confirm (no reseed)
- scrollUntilVisible:
    element: ".*notes:${NOTES_EDITED}.*"
    direction: DOWN
    timeout: 20000
    visibilityPercentage: 10
- longPressOn: ".*notes:${NOTES_EDITED}.*"
- extendedWaitUntil:
    visible:
      id: "journal.trade.actions.delete"
    timeout: 10000
- tapOn:
    id: "journal.trade.actions.delete"
- extendedWaitUntil:
    visible:
      id: "journal.trade.delete.confirm"
    timeout: 10000
- tapOn:
    id: "journal.trade.delete.confirm"
- waitForAnimationToEnd
- runFlow:
    when:
      visible: "Close"
    commands:
      - tapOn: "Close"
- assertNotVisible: ".*notes:${NOTES_EDITED}.*"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_journal_after_delete

- openLink: youtrader://qa/tab?id=stats
- waitForAnimationToEnd
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_stats_after_delete
- openLink: youtrader://qa/tab?id=calendar
- waitForAnimationToEnd
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_calendar_after_delete

- stopApp
- launchApp:
    clearState: false
- openLink: youtrader://qa/email-login?role=allow
- extendedWaitUntil:
    visible: "Journal"
    timeout: 90000
- openLink: youtrader://qa/tab?id=journal
- waitForAnimationToEnd
- assertNotVisible: ".*notes:${NOTES_EDITED}.*"
- assertNotVisible: ".*notes:${NOTES}.*"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s11_life_after_relaunch
YAML

# Trigger cloud sync chance after seed by opening app briefly before maestro heavy flow:
curl -s -X POST http://127.0.0.1:8081/reload >/dev/null || true
sleep 2

log "maestro_lifecycle_start"
if ! maestro --device "$UDID" test "$FLOW" 2>&1 | tee -a "$LOG"; then
  xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_life_FAIL_${MARKER}.png" 2>/dev/null || true
  dump_backend "after_fail" || true
  log "JOURNAL_LIFECYCLE_FAIL marker=$MARKER"
  exit 1
fi

dump_backend "after_lifecycle" || true
log "JOURNAL_LIFECYCLE_PASS marker=$MARKER"
exit 0
