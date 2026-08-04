#!/usr/bin/env bash
# Preflight for migration 20260730230000 allowlist table before production apply.
# Does not modify the migration hash. STOP if unexpected rows exist.
set -euo pipefail
PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
[[ -n "$PROJECT_REF" ]] || { echo "SUPABASE_PROJECT_REF required"; exit 2; }
[[ "$PROJECT_REF" != "izzrlsgumyabdvlmwlwn" || "${ALLOW_PRODUCTION_PREFLIGHT:-}" == "1" ]] || {
  echo "REFUSE: set ALLOW_PRODUCTION_PREFLIGHT=1 to run against production"; exit 2;
}
echo "preflight target project=$PROJECT_REF"
echo "This script is documentation/command template; use MCP/SQL against the target."
echo "SQL:"
cat <<'SQL'
select
  to_regclass('public.prop_os_command_allowlist') is not null as table_exists,
  coalesce((select count(*) from public.prop_os_command_allowlist), 0) as row_count;
-- If table_exists and row_count > 0 → STOP (unexpected allowlist rows).
-- If not table_exists → OK (migration creates empty table).
-- If table_exists and row_count = 0 → OK.
SQL
