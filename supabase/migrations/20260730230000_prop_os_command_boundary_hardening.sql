-- Phase 2B remediation — harden internal command boundary.
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_2B.md (hardening section)
--
-- Adds: server allowlist + command kill switch, attempt_number uniqueness,
-- hardened SECURITY DEFINER search_path, schema-qualified refs, sanitized errors.

-- ---------------------------------------------------------------------------
-- Server-authoritative command gate (local/staging; not App UI)
-- ---------------------------------------------------------------------------

create table if not exists public.prop_os_command_gate (
  id smallint primary key default 1 check (id = 1),
  commands_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0'
);

insert into public.prop_os_command_gate (id, commands_enabled)
values (1, true)
on conflict (id) do nothing;

create table if not exists public.prop_os_command_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note text,
  schema_version text not null default 'prop-os-schema-v0'
);

alter table public.prop_os_command_gate enable row level security;
alter table public.prop_os_command_gate force row level security;
alter table public.prop_os_command_allowlist enable row level security;
alter table public.prop_os_command_allowlist force row level security;

revoke all on table public.prop_os_command_gate from public, anon, authenticated;
revoke all on table public.prop_os_command_allowlist from public, anon, authenticated;
grant all on table public.prop_os_command_gate to postgres, service_role;
grant all on table public.prop_os_command_allowlist to postgres, service_role;
-- No authenticated SELECT/DML — gate is server-only; App cannot forge eligibility.

comment on table public.prop_os_command_gate is
  'Phase 2B: authoritative command kill switch. When commands_enabled=false, prop_os_cmd_* reject new mutations. Reads unaffected.';
comment on table public.prop_os_command_allowlist is
  'Phase 2B: server-side allowlist for internal commands. Preference/App UI allowlist is not authoritative.';

-- ---------------------------------------------------------------------------
-- Deterministic attempt numbers
-- ---------------------------------------------------------------------------

alter table public.prop_challenges
  add column if not exists attempt_number integer;

-- Backfill existing rows per account by started_at, id
with ranked as (
  select
    id,
    row_number() over (partition by account_id order by started_at asc, id asc) as rn
  from public.prop_challenges
)
update public.prop_challenges c
set attempt_number = ranked.rn
from ranked
where c.id = ranked.id
  and c.attempt_number is null;

update public.prop_challenges
set attempt_number = 1
where attempt_number is null;

alter table public.prop_challenges
  alter column attempt_number set not null;

create unique index if not exists prop_challenges_account_attempt_uidx
  on public.prop_challenges (account_id, attempt_number);

-- Auto-allocate attempt_number for service/test seed inserts that omit it.
-- Command RPCs set attempt_number explicitly under account row lock.
create or replace function public.prop_challenges_assign_attempt_number()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  if new.attempt_number is null then
    select coalesce(max(c.attempt_number), 0) + 1
      into new.attempt_number
    from public.prop_challenges as c
    where c.account_id = new.account_id;
  end if;
  return new;
end;
$$;

drop trigger if exists prop_challenges_assign_attempt_number on public.prop_challenges;
create trigger prop_challenges_assign_attempt_number
  before insert on public.prop_challenges
  for each row
  execute function public.prop_challenges_assign_attempt_number();

revoke all on function public.prop_challenges_assign_attempt_number() from public, anon, authenticated;
grant execute on function public.prop_challenges_assign_attempt_number() to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Hardened authorization helper
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_assert_authorized()
returns uuid
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  enabled boolean;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'prop_os: forbidden' using errcode = '42501';
  end if;

  select g.commands_enabled
    into enabled
  from public.prop_os_command_gate as g
  where g.id = 1;

  if enabled is distinct from true then
    raise exception 'prop_os: forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.prop_os_command_allowlist as a
    where a.user_id = uid
  ) then
    raise exception 'prop_os: forbidden' using errcode = '42501';
  end if;

  return uid;
end;
$$;

revoke all on function public.prop_os_cmd_assert_authorized() from public;
revoke all on function public.prop_os_cmd_assert_authorized() from anon;
revoke all on function public.prop_os_cmd_assert_authorized() from authenticated;
grant execute on function public.prop_os_cmd_assert_authorized() to authenticated;
grant execute on function public.prop_os_cmd_assert_authorized() to service_role;
grant execute on function public.prop_os_cmd_assert_authorized() to postgres;

-- Keep require_uid as thin alias for compatibility; now enforces gate+allowlist.
create or replace function public.prop_os_cmd_require_uid()
returns uuid
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
begin
  return public.prop_os_cmd_assert_authorized();
end;
$$;

revoke all on function public.prop_os_cmd_require_uid() from public;
revoke all on function public.prop_os_cmd_require_uid() from anon;
grant execute on function public.prop_os_cmd_require_uid() to authenticated;
grant execute on function public.prop_os_cmd_require_uid() to service_role;
grant execute on function public.prop_os_cmd_require_uid() to postgres;

-- ---------------------------------------------------------------------------
-- Receipt helpers (hardened)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_lookup_receipt(
  p_user_id uuid,
  p_request_id text,
  p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  rec public.prop_os_command_receipts%rowtype;
begin
  -- Caller must already be authorized; never accept foreign user_id from client
  -- except when equal to auth.uid().
  if p_user_id is distinct from (select auth.uid()) then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select * into rec
  from public.prop_os_command_receipts as r
  where r.user_id = p_user_id
    and r.client_request_id = p_request_id;

  if not found then
    return null;
  end if;

  if rec.request_hash is distinct from p_hash then
    return jsonb_build_object(
      'kind', 'conflict',
      'reasonCode', 'idempotency_hash_mismatch'
    );
  end if;

  return jsonb_build_object(
    'kind', rec.result_status,
    'value', rec.result_body,
    'reasonCode', rec.reason_code
  );
end;
$$;

revoke all on function public.prop_os_cmd_lookup_receipt(uuid, text, text) from public;
revoke all on function public.prop_os_cmd_lookup_receipt(uuid, text, text) from anon;
revoke all on function public.prop_os_cmd_lookup_receipt(uuid, text, text) from authenticated;
grant execute on function public.prop_os_cmd_lookup_receipt(uuid, text, text) to service_role;
grant execute on function public.prop_os_cmd_lookup_receipt(uuid, text, text) to postgres;

create or replace function public.prop_os_cmd_store_receipt(
  p_user_id uuid,
  p_request_id text,
  p_command_type text,
  p_hash text,
  p_status text,
  p_body jsonb,
  p_reason text,
  p_entities jsonb
)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  if p_user_id is distinct from (select auth.uid()) then
    raise exception 'prop_os: forbidden' using errcode = '42501';
  end if;

  insert into public.prop_os_command_receipts (
    user_id, client_request_id, command_type, request_hash,
    result_status, result_body, reason_code, entity_ids
  ) values (
    p_user_id, p_request_id, p_command_type, p_hash,
    p_status, coalesce(p_body, '{}'::jsonb), p_reason, coalesce(p_entities, '{}'::jsonb)
  )
  on conflict (user_id, client_request_id) do nothing;
end;
$$;

revoke all on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb) from public;
revoke all on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb) from anon;
revoke all on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb) from authenticated;
grant execute on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb) to service_role;
grant execute on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb) to postgres;

-- ---------------------------------------------------------------------------
-- create account (hardened)
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_create_account(
  p_request_id text,
  p_request_hash text,
  p_label text,
  p_firm_key text,
  p_account_size_minor bigint,
  p_currency text,
  p_firm_timezone text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acc_id uuid;
  body jsonb;
begin
  uid := public.prop_os_cmd_assert_authorized();
  -- Serialize same request id
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':create_account:' || p_request_id, 0)
  );

  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('label', 'required'));
  end if;
  if p_account_size_minor is null or p_account_size_minor <= 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('accountSizeMinor', 'must_be_positive'));
  end if;
  if p_firm_timezone is null or length(btrim(p_firm_timezone)) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('firmTimezone', 'required'));
  end if;

  acc_id := gen_random_uuid();
  insert into public.prop_accounts (
    id, user_id, firm_key, label, account_size_minor, currency, firm_timezone,
    status, source, schema_version
  ) values (
    acc_id, uid, nullif(p_firm_key, ''), btrim(p_label), p_account_size_minor,
    coalesce(nullif(p_currency, ''), 'USD'), btrim(p_firm_timezone),
    'active', 'user_created', 'prop-os-schema-v0'
  );

  body := jsonb_build_object(
    'account', jsonb_build_object(
      'id', acc_id,
      'userId', uid,
      'label', btrim(p_label),
      'firmKey', nullif(p_firm_key, ''),
      'accountSizeMinor', p_account_size_minor,
      'currency', coalesce(nullif(p_currency, ''), 'USD'),
      'firmTimezone', btrim(p_firm_timezone),
      'status', 'active'
    )
  );

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'create_account', p_request_hash,
    'success', body, null, jsonb_build_object('accountId', acc_id)
  );

  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_create_account(text, text, text, text, bigint, text, text) from public;
revoke all on function public.prop_os_cmd_create_account(text, text, text, text, bigint, text, text) from anon;
grant execute on function public.prop_os_cmd_create_account(text, text, text, text, bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create challenge attempt (atomic + attempt_number + advisory lock)
-- Kill-switch / allowlist checked once at entry. Mid-flight gate flip:
-- in-flight transaction completes atomically under initial authorization
-- (no partial mutation). Documented in PROP_OS_PHASE_2B.md.
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_create_challenge_attempt(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_template_id text,
  p_template_version text,
  p_rule_snapshot jsonb,
  p_phase text,
  p_started_at timestamptz,
  p_reset_of uuid
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  ch_id uuid;
  rule_id uuid;
  rule_ver text;
  start_bal bigint;
  attempt_n int;
  body jsonb;
  prior_ch public.prop_challenges%rowtype;
  started_at timestamptz;
begin
  uid := public.prop_os_cmd_assert_authorized();

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':create_challenge:' || p_request_id, 0)
  );

  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  if p_rule_snapshot is null or jsonb_typeof(p_rule_snapshot) <> 'object' then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('ruleSnapshot', 'required'));
  end if;
  if not (p_rule_snapshot ? 'version') then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('ruleSnapshot', 'version_required'));
  end if;
  if coalesce(p_phase, 'evaluation') not in ('evaluation', 'funded') then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('phase', 'invalid'));
  end if;

  -- Lock account row for attempt allocation + ownership
  select * into acct
  from public.prop_accounts as a
  where a.id = p_account_id
  for update;

  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if acct.status in ('archived', 'closed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'archived');
  end if;

  if p_reset_of is not null then
    select * into prior_ch from public.prop_challenges as c where c.id = p_reset_of;
    if not found or prior_ch.user_id is distinct from uid then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    if prior_ch.account_id is distinct from p_account_id then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'reset_account_mismatch');
    end if;
    if prior_ch.status in ('active', 'at_risk') then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'reset_of_active');
    end if;
  end if;

  select coalesce(max(c.attempt_number), 0) + 1
    into attempt_n
  from public.prop_challenges as c
  where c.account_id = p_account_id;

  rule_ver := p_rule_snapshot ->> 'version';
  start_bal := acct.account_size_minor;
  ch_id := gen_random_uuid();
  rule_id := gen_random_uuid();
  started_at := coalesce(p_started_at, now());

  insert into public.prop_challenges (
    id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
    started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version, attempt_number
  ) values (
    ch_id, uid, p_account_id, coalesce(p_phase, 'evaluation'), 'active', rule_ver, start_bal,
    started_at, null, p_reset_of, false, 'prop-os-schema-v0', attempt_n
  );

  insert into public.prop_challenge_rule_snapshots (
    id, user_id, challenge_id, rule_set_version, snapshot, template_key,
    template_version_at_capture, captured_at, schema_version
  ) values (
    rule_id, uid, ch_id, rule_ver, p_rule_snapshot, p_template_id,
    p_template_version, started_at, 'prop-os-schema-v0'
  );

  insert into public.prop_challenge_transitions (
    id, user_id, challenge_id, from_status, to_status, reason_code, evidence, actor, at, schema_version
  ) values (
    gen_random_uuid(), uid, ch_id, null, 'active', 'challenge_created',
    jsonb_build_object(
      'templateId', p_template_id,
      'templateVersion', p_template_version,
      'requestId', p_request_id,
      'attemptNumber', attempt_n
    ),
    'user', started_at, 'prop-os-schema-v0'
  );

  body := jsonb_build_object(
    'challenge', jsonb_build_object(
      'id', ch_id,
      'userId', uid,
      'accountId', p_account_id,
      'phase', coalesce(p_phase, 'evaluation'),
      'status', 'active',
      'ruleSetVersion', rule_ver,
      'attemptNumber', attempt_n
    ),
    'ruleSnapshot', jsonb_build_object(
      'id', rule_id,
      'challengeId', ch_id,
      'ruleSetVersion', rule_ver,
      'templateKey', p_template_id,
      'templateVersionAtCapture', p_template_version
    ),
    'attemptNumber', attempt_n
  );

  -- Receipt only after all mutations; never report success before this point.
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'create_challenge_attempt', p_request_hash,
    'success', body, null,
    jsonb_build_object(
      'accountId', p_account_id,
      'challengeId', ch_id,
      'ruleSnapshotId', rule_id,
      'attemptNumber', attempt_n
    )
  );

  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when unique_violation then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'attempt_number_conflict');
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_create_challenge_attempt(text, text, uuid, text, text, jsonb, text, timestamptz, uuid) from public;
revoke all on function public.prop_os_cmd_create_challenge_attempt(text, text, uuid, text, text, jsonb, text, timestamptz, uuid) from anon;
grant execute on function public.prop_os_cmd_create_challenge_attempt(text, text, uuid, text, text, jsonb, text, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Remaining commands: reaffirm hardened path + assert_authorized
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_set_default_account(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  sel uuid;
  body jsonb;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':set_default:' || p_request_id, 0)
  );
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  if p_account_id is not null then
    select * into acct from public.prop_accounts as a where a.id = p_account_id for update;
    if not found or acct.user_id is distinct from uid then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    if acct.status in ('archived', 'closed') then
      return jsonb_build_object('kind', 'conflict', 'reasonCode', 'archived');
    end if;
  end if;

  insert into public.prop_os_user_preferences (user_id, default_account_id, updated_at, schema_version)
  values (uid, p_account_id, now(), 'prop-os-schema-v0')
  on conflict (user_id) do update
    set default_account_id = excluded.default_account_id,
        updated_at = now();

  select p.selected_challenge_id into sel
  from public.prop_os_user_preferences as p
  where p.user_id = uid;

  body := jsonb_build_object('defaultAccountId', p_account_id, 'selectedChallengeId', sel);
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'set_default_account', p_request_hash,
    'success', body, null, jsonb_build_object('accountId', p_account_id)
  );
  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when sqlstate '23514' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_set_default_account(text, text, uuid) from public;
revoke all on function public.prop_os_cmd_set_default_account(text, text, uuid) from anon;
grant execute on function public.prop_os_cmd_set_default_account(text, text, uuid) to authenticated;

create or replace function public.prop_os_cmd_archive_account(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_confirm_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  active_count int;
  body jsonb;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':archive:' || p_request_id, 0)
  );
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into acct from public.prop_accounts as a where a.id = p_account_id for update;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select count(*)::int into active_count
  from public.prop_challenges as c
  where c.account_id = p_account_id and c.status in ('active', 'at_risk');

  if active_count > 0 and coalesce(p_confirm_active, false) is not true then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'active_challenge_confirmation_required');
  end if;

  update public.prop_accounts as a
     set status = 'archived',
         archived_at = now(),
         updated_at = now()
   where a.id = p_account_id;

  update public.prop_os_user_preferences as p
     set default_account_id = case when p.default_account_id = p_account_id then null else p.default_account_id end,
         selected_challenge_id = case
           when p.selected_challenge_id in (
             select c.id from public.prop_challenges as c where c.account_id = p_account_id
           ) then null else p.selected_challenge_id end,
         updated_at = now()
   where p.user_id = uid;

  body := jsonb_build_object(
    'account', jsonb_build_object(
      'id', p_account_id,
      'userId', uid,
      'status', 'archived',
      'label', acct.label
    )
  );
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'archive_account', p_request_hash,
    'success', body, null, jsonb_build_object('accountId', p_account_id)
  );
  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_archive_account(text, text, uuid, boolean) from public;
revoke all on function public.prop_os_cmd_archive_account(text, text, uuid, boolean) from anon;
grant execute on function public.prop_os_cmd_archive_account(text, text, uuid, boolean) to authenticated;

create or replace function public.prop_os_cmd_select_challenge(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  ch public.prop_challenges%rowtype;
  def uuid;
  body jsonb;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':select_challenge:' || p_request_id, 0)
  );
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into acct from public.prop_accounts as a where a.id = p_account_id for update;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if acct.status in ('archived', 'closed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'archived');
  end if;

  select * into ch from public.prop_challenges as c where c.id = p_challenge_id;
  if not found or ch.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if ch.account_id is distinct from p_account_id then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'cross_account_selection');
  end if;
  if ch.status not in ('active', 'at_risk') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'challenge_not_eligible');
  end if;

  insert into public.prop_os_user_preferences (user_id, selected_challenge_id, updated_at, schema_version)
  values (uid, p_challenge_id, now(), 'prop-os-schema-v0')
  on conflict (user_id) do update
    set selected_challenge_id = excluded.selected_challenge_id,
        updated_at = now();

  select p.default_account_id into def
  from public.prop_os_user_preferences as p
  where p.user_id = uid;

  body := jsonb_build_object('defaultAccountId', def, 'selectedChallengeId', p_challenge_id);
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'select_active_challenge', p_request_hash,
    'success', body, null,
    jsonb_build_object('accountId', p_account_id, 'challengeId', p_challenge_id)
  );
  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when sqlstate '23514' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_select_challenge(text, text, uuid, uuid) from public;
revoke all on function public.prop_os_cmd_select_challenge(text, text, uuid, uuid) from anon;
grant execute on function public.prop_os_cmd_select_challenge(text, text, uuid, uuid) to authenticated;

create or replace function public.prop_os_cmd_clear_challenge_selection(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  uid uuid;
  prior jsonb;
  acct public.prop_accounts%rowtype;
  sel uuid;
  def uuid;
  body jsonb;
begin
  uid := public.prop_os_cmd_assert_authorized();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':clear_selection:' || p_request_id, 0)
  );
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into acct from public.prop_accounts as a where a.id = p_account_id;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select p.selected_challenge_id, p.default_account_id into sel, def
  from public.prop_os_user_preferences as p
  where p.user_id = uid;

  if sel is not null then
    if exists (
      select 1 from public.prop_challenges as c
      where c.id = sel and c.account_id = p_account_id
    ) or not exists (select 1 from public.prop_challenges as c where c.id = sel) then
      update public.prop_os_user_preferences as p
         set selected_challenge_id = null, updated_at = now()
       where p.user_id = uid;
      sel := null;
    end if;
  end if;

  body := jsonb_build_object('defaultAccountId', def, 'selectedChallengeId', sel);
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'clear_active_challenge_selection', p_request_hash,
    'success', body, null, jsonb_build_object('accountId', p_account_id)
  );
  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when sqlstate '42501' then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_clear_challenge_selection(text, text, uuid) from public;
revoke all on function public.prop_os_cmd_clear_challenge_selection(text, text, uuid) from anon;
grant execute on function public.prop_os_cmd_clear_challenge_selection(text, text, uuid) to authenticated;

-- Ops helpers (service_role / postgres only) for local/staging gate management
create or replace function public.prop_os_cmd_admin_set_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  update public.prop_os_command_gate
     set commands_enabled = p_enabled,
         updated_at = now()
   where id = 1;
end;
$$;

create or replace function public.prop_os_cmd_admin_allowlist_add(p_user_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  insert into public.prop_os_command_allowlist (user_id, note)
  values (p_user_id, p_note)
  on conflict (user_id) do update set note = excluded.note;
end;
$$;

create or replace function public.prop_os_cmd_admin_allowlist_remove(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
begin
  delete from public.prop_os_command_allowlist where user_id = p_user_id;
end;
$$;

revoke all on function public.prop_os_cmd_admin_set_enabled(boolean) from public, anon, authenticated;
revoke all on function public.prop_os_cmd_admin_allowlist_add(uuid, text) from public, anon, authenticated;
revoke all on function public.prop_os_cmd_admin_allowlist_remove(uuid) from public, anon, authenticated;
grant execute on function public.prop_os_cmd_admin_set_enabled(boolean) to service_role, postgres;
grant execute on function public.prop_os_cmd_admin_allowlist_add(uuid, text) to service_role, postgres;
grant execute on function public.prop_os_cmd_admin_allowlist_remove(uuid) to service_role, postgres;
