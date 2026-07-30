#!/usr/bin/env bash
# Phase 1C — isolated PostgreSQL shadow smoke (service write + authenticated deny).
# Uses local cluster from Phase 1A (.tmp/prop-os-pg :55432). Does NOT touch production.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:${PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PGHOST=localhost
PGPORT=55432
PGUSER=postgres
export PGHOST PGPORT PGUSER
DB=prop_os_shadow1c

if ! pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "prop-os-shadow-pg-qa: SKIP — local postgres :55432 not ready"
  exit 0
fi

if [[ ! -f .tmp/bootstrap_supabase_roles.sql ]]; then
  echo "prop-os-shadow-pg-qa: SKIP — missing .tmp/bootstrap_supabase_roles.sql (run Phase 1A live validate once)"
  exit 0
fi

echo "prop-os-shadow-pg-qa: using $(psql --version)"

dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"

psql -d "$DB" -v ON_ERROR_STOP=1 -f .tmp/bootstrap_supabase_roles.sql >/dev/null

while IFS= read -r f; do
  psql -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done < <(ls -1 supabase/migrations/*.sql | sort)

USER_ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ACC_ID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
CH_ID='cccccccc-cccc-4ccc-8ccc-cccccccccccc'

psql -d "$DB" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id, email) values ('$USER_ID', 'shadow@example.com');

insert into public.prop_accounts (
  id, user_id, firm_key, label, account_size_minor, currency, firm_timezone, status, source
) values (
  '$ACC_ID', '$USER_ID', 'fixture-firm', 'Shadow Acc', 5000000, 'USD', 'America/New_York', 'active', 'import'
);

insert into public.prop_challenges (
  id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor, started_at, breach_locked
) values (
  '$CH_ID', '$USER_ID', '$ACC_ID', 'evaluation', 'active', 'rs-shadow-v1', 5000000, '2026-01-05T14:00:00Z', false
);

insert into public.prop_challenge_rule_snapshots (
  id, user_id, challenge_id, rule_set_version, snapshot, captured_at
) values (
  gen_random_uuid(), '$USER_ID', '$CH_ID', 'rs-shadow-v1',
  '{"version":"rs-shadow-v1","firmKey":"fixture-firm","currency":"USD","firmTimezone":"America/New_York","tradingDayRolloverHour":0,"profitTargetMinor":300000,"dailyLossLimitMinor":1000000,"dailyLossBasis":"realized_only","dailyLossPolicyVersion":"daily-loss-v0","drawdown":{"kind":"static","amountMinor":2000000},"minimumTradingDays":0}'::jsonb,
  '2026-01-05T14:00:00Z'
);

insert into public.prop_executions (
  id, user_id, challenge_id, account_id, occurred_at, broker_sequence, realized_pnl_minor, fees_minor, contracts, voided, source
) values (
  'ex1', '$USER_ID', '$CH_ID', '$ACC_ID', '2026-01-06T15:00:00Z', 1, 5000, 0, 1, false, 'shadow_fixture'
);

set role service_role;
insert into public.prop_engine_snapshots (
  user_id, challenge_id, calculation_version, rule_set_version, input_revision,
  calculated_at, status, payload, confidence, limitations,
  readiness_model_version, confidence_policy_version
) values (
  '$USER_ID', '$CH_ID', 'calc-spec-v0', 'rs-shadow-v1', 'shadow-rev:test',
  '2026-01-06T16:00:00Z', 'active', '{"runnerVersion":"shadow-runner-v0"}'::jsonb,
  '{"sampleSize":1,"confidence":"low","confidencePolicyVersion":"confidence-policy-v0","limitations":[]}'::jsonb,
  '[]'::jsonb, null, 'confidence-policy-v0'
);
reset role;

do \$\$
declare
  denied boolean := false;
begin
  begin
    execute 'set local role authenticated';
    insert into public.prop_engine_snapshots (
      user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations, confidence_policy_version
    ) values (
      '$USER_ID', '$CH_ID', 'calc-spec-v0', 'rs-shadow-v1', 'shadow-rev:auth-deny',
      '2026-01-06T17:00:00Z', 'active', '{}'::jsonb,
      '{}'::jsonb, '[]'::jsonb, 'confidence-policy-v0'
    );
  exception when others then
    denied := true;
  end;
  if not denied then
    raise exception 'authenticated write unexpectedly succeeded';
  end if;
  raise notice 'AUTH_DENY_PASS';
end \$\$;

select count(*)::int as engine_snaps from public.prop_engine_snapshots where challenge_id = '$CH_ID';
SQL

echo "prop-os-shadow-pg-qa: PASS"
