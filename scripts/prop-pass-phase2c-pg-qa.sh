#!/usr/bin/env bash
# Phase 2C — assignment RPC security + concurrency on isolated Postgres.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:${PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PGHOST=localhost
PGPORT=55432
PGUSER=postgres
export PGHOST PGPORT PGUSER
DB=prop_os_phase2c
export PROP_OS_PHASE2C_DB="$DB"

if ! pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "prop-pass-phase2c-pg-qa: SKIP — local postgres :55432 not ready"
  exit 0
fi

if [[ ! -f .tmp/bootstrap_supabase_roles.sql ]]; then
  echo "prop-pass-phase2c-pg-qa: SKIP — missing bootstrap"
  exit 0
fi

echo "prop-pass-phase2c-pg-qa: using $(psql --version)"
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -f .tmp/bootstrap_supabase_roles.sql >/dev/null
while IFS= read -r f; do
  psql -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done < <(ls -1 supabase/migrations/*.sql | sort)

node --import ./scripts/prop-os-register.mjs --experimental-strip-types --experimental-transform-types \
  scripts/prop-pass-phase2c-pg-qa.ts

echo "prop-pass-phase2c-pg-qa: PASS"
