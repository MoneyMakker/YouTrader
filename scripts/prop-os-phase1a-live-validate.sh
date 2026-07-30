#!/usr/bin/env bash
# Phase 1A live validation against isolated local PostgreSQL.
# Requires: postgresql@16 on PATH, server on localhost:55432
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:${PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PGHOST=localhost
PGPORT=55432
PGUSER=postgres
export PGHOST PGPORT PGUSER
echo "Using $(psql --version)"
echo "vector.control=$(pg_config --sharedir)/extension/vector.control"

mkdir -p .tmp

cat > .tmp/bootstrap_supabase_roles.sql <<'SQL'
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create extension if not exists pgcrypto;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to service_role;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  instance_id uuid,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz,
  metadata jsonb
);

-- Supabase storage helper used by policies
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;
SQL

psql_db() {
  local db="$1"; shift
  psql -d "$db" -v ON_ERROR_STOP=1 "$@"
}

recreate_db() {
  local db="$1"
  psql -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists ${db} with (force);"
  psql -d postgres -v ON_ERROR_STOP=1 -c "create database ${db};"
}

apply_migrations() {
  local db="$1"
  local stop_before="${2:-}"
  psql_db "$db" -f .tmp/bootstrap_supabase_roles.sql >/dev/null
  local f
  for f in $(ls supabase/migrations/*.sql | sort); do
    local base
    base="$(basename "$f")"
    if [[ -n "$stop_before" && "$base" == "$stop_before" ]]; then
      echo "STOP_BEFORE $base"
      return 0
    fi
    if psql_db "$db" -f "$f" >".tmp/apply_${db}_${base}.log" 2>&1; then
      echo "OK $base"
    else
      echo "FAIL $base"
      tail -30 ".tmp/apply_${db}_${base}.log"
      return 1
    fi
  done
}

assert_prop_tables() {
  local db="$1"
  psql_db "$db" -Atc "
    select count(*) from information_schema.tables
    where table_schema='public' and table_name in (
      'prop_accounts','prop_challenges','prop_challenge_rule_snapshots','prop_trade_assignments',
      'prop_executions','prop_account_events','prop_challenge_transitions','prop_engine_snapshots',
      'prop_score_snapshots','prop_violation_records','prop_data_quality_flags','prop_correction_events'
    );
  " | grep -qx 12
}

echo "=== A1 clean apply #1 ==="
recreate_db prop_os_clean1
apply_migrations prop_os_clean1
assert_prop_tables prop_os_clean1
echo "CLEAN1_TABLES_OK"

echo "=== A2 clean apply #2 (repeatability) ==="
recreate_db prop_os_clean2
apply_migrations prop_os_clean2
assert_prop_tables prop_os_clean2
echo "CLEAN2_TABLES_OK"

echo "=== B existing-schema upgrade ==="
recreate_db prop_os_upgrade
apply_migrations prop_os_upgrade "20260730190000_prop_os_database_foundation.sql"
# seed legacy journal
psql_db prop_os_upgrade <<'SQL'
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com')
on conflict (id) do nothing;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
insert into public.trade_journal (user_id, client_id, trade_date, symbol, direction, contracts, pnl)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'legacy-upgrade-1', current_date, 'ES', 'LONG', 1, 12.5)
on conflict (user_id, client_id) do nothing;
commit;
SQL
LEGACY_BEFORE=$(psql_db prop_os_upgrade -Atc "select count(*) from public.trade_journal where client_id='legacy-upgrade-1';")
psql_db prop_os_upgrade -f supabase/migrations/20260730190000_prop_os_database_foundation.sql >.tmp/apply_upgrade_1a.log 2>&1
LEGACY_AFTER=$(psql_db prop_os_upgrade -Atc "select count(*) from public.trade_journal where client_id='legacy-upgrade-1';")
ASSIGNED=$(psql_db prop_os_upgrade -Atc "select count(*) from public.prop_trade_assignments;")
test "$LEGACY_BEFORE" = "1"
test "$LEGACY_AFTER" = "1"
test "$ASSIGNED" = "0"
assert_prop_tables prop_os_upgrade
echo "UPGRADE_OK legacy=$LEGACY_AFTER assignments=$ASSIGNED"

echo "=== C-E live assertions on clean2 ==="
psql_db prop_os_clean2 -f supabase/tests/prop_os_phase1a_live_assertions.sql >.tmp/live_assertions.out 2>&1
SUMMARY=$(rg -n "passed \| failed|^\s+[CE][0-9A-Z_]+ \| (PASS|FAIL)" .tmp/live_assertions.out | tail -40 || true)
echo "$SUMMARY"
FAILS=$(rg -c "\| FAIL \|" .tmp/live_assertions.out || true)
if rg -q "\| FAIL \|" .tmp/live_assertions.out; then
  echo "ASSERTIONS_HAVE_FAILURES"
  exit 1
fi
echo "ASSERTIONS_OK"

echo "ALL_APPLY_PHASES_OK"
