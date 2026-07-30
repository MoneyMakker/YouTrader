-- Phase 2B — Internal Prop OS command RPCs (additive).
-- PREPARE ONLY. Do NOT apply to production without separate Ops approval.
-- Contract: docs/architecture/PROP_OS_PHASE_2B.md
--
-- Authenticated clients call prop_os_cmd_* only.
-- No generic INSERT/UPDATE/DELETE grants on prop_* tables.

-- ---------------------------------------------------------------------------
-- Preferences: selected challenge (preference only — not authorization)
-- ---------------------------------------------------------------------------

alter table public.prop_os_user_preferences
  add column if not exists selected_challenge_id uuid
    references public.prop_challenges(id) on delete set null;

create or replace function public.prop_os_enforce_pref_selected_challenge()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
  acct uuid;
begin
  if new.selected_challenge_id is null then
    return new;
  end if;
  select user_id, account_id into owner, acct
    from public.prop_challenges where id = new.selected_challenge_id;
  if owner is null or owner is distinct from new.user_id then
    raise exception 'prop_os: selected_challenge_id must belong to preference owner'
      using errcode = '23514';
  end if;
  if new.default_account_id is not null and acct is distinct from new.default_account_id then
    -- Selection may target a non-default account; only reject if challenge missing.
    null;
  end if;
  return new;
end;
$$;

revoke all on function public.prop_os_enforce_pref_selected_challenge() from public, anon, authenticated;
grant execute on function public.prop_os_enforce_pref_selected_challenge() to postgres, service_role;

drop trigger if exists prop_os_user_preferences_selected_challenge on public.prop_os_user_preferences;
create trigger prop_os_user_preferences_selected_challenge
  before insert or update on public.prop_os_user_preferences
  for each row execute function public.prop_os_enforce_pref_selected_challenge();

-- ---------------------------------------------------------------------------
-- Command receipts (idempotency + audit; no client DML)
-- ---------------------------------------------------------------------------

create table if not exists public.prop_os_command_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text not null,
  command_type text not null,
  request_hash text not null,
  result_status text not null,
  result_body jsonb not null default '{}'::jsonb,
  reason_code text,
  entity_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  schema_version text not null default 'prop-os-schema-v0',
  primary key (user_id, client_request_id),
  constraint prop_os_command_receipts_request_id_len check (
    char_length(client_request_id) >= 8 and char_length(client_request_id) <= 128
  )
);

create index if not exists prop_os_command_receipts_user_created_idx
  on public.prop_os_command_receipts (user_id, created_at desc);

alter table public.prop_os_command_receipts enable row level security;
alter table public.prop_os_command_receipts force row level security;
revoke all on table public.prop_os_command_receipts from public, anon, authenticated;
grant all on table public.prop_os_command_receipts to postgres, service_role;
grant select on table public.prop_os_command_receipts to authenticated;

drop policy if exists prop_os_command_receipts_select_own on public.prop_os_command_receipts;
create policy prop_os_command_receipts_select_own
  on public.prop_os_command_receipts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_require_uid()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'prop_os: unauthenticated' using errcode = '42501';
  end if;
  return uid;
end;
$$;

revoke all on function public.prop_os_cmd_require_uid() from public, anon;
grant execute on function public.prop_os_cmd_require_uid() to authenticated, service_role, postgres;

create or replace function public.prop_os_cmd_lookup_receipt(
  p_user_id uuid,
  p_request_id text,
  p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.prop_os_command_receipts%rowtype;
begin
  select * into rec
    from public.prop_os_command_receipts
   where user_id = p_user_id and client_request_id = p_request_id;
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

revoke all on function public.prop_os_cmd_lookup_receipt(uuid, text, text) from public, anon, authenticated;
grant execute on function public.prop_os_cmd_lookup_receipt(uuid, text, text) to postgres, service_role;

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
set search_path = public
as $$
begin
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

revoke all on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.prop_os_cmd_store_receipt(uuid, text, text, text, text, jsonb, text, jsonb)
  to postgres, service_role;

-- ---------------------------------------------------------------------------
-- create account
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
set search_path = public
as $$
declare
  uid uuid := public.prop_os_cmd_require_uid();
  prior jsonb;
  acc_id uuid;
  body jsonb;
begin
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  if p_label is null or length(trim(p_label)) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('label', 'required'));
  end if;
  if p_account_size_minor is null or p_account_size_minor <= 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('accountSizeMinor', 'must_be_positive'));
  end if;
  if p_firm_timezone is null or length(trim(p_firm_timezone)) = 0 then
    return jsonb_build_object('kind', 'validation_error', 'fieldErrors', jsonb_build_object('firmTimezone', 'required'));
  end if;

  acc_id := gen_random_uuid();
  insert into public.prop_accounts (
    id, user_id, firm_key, label, account_size_minor, currency, firm_timezone,
    status, source, schema_version
  ) values (
    acc_id, uid, nullif(p_firm_key, ''), trim(p_label), p_account_size_minor,
    coalesce(nullif(p_currency, ''), 'USD'), trim(p_firm_timezone),
    'active', 'user_created', 'prop-os-schema-v0'
  );

  body := jsonb_build_object(
    'account', jsonb_build_object(
      'id', acc_id,
      'userId', uid,
      'label', trim(p_label),
      'firmKey', nullif(p_firm_key, ''),
      'accountSizeMinor', p_account_size_minor,
      'currency', coalesce(nullif(p_currency, ''), 'USD'),
      'firmTimezone', trim(p_firm_timezone),
      'status', 'active'
    )
  );

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'create_account', p_request_hash,
    'success', body, null, jsonb_build_object('accountId', acc_id)
  );

  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when insufficient_privilege then
    return jsonb_build_object('kind', 'forbidden');
  when others then
    if sqlstate = '42501' then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    return jsonb_build_object('kind', 'unexpected_error', 'correlationId', null);
end;
$$;

revoke all on function public.prop_os_cmd_create_account(text, text, text, text, bigint, text, text)
  from public, anon;
grant execute on function public.prop_os_cmd_create_account(text, text, text, text, bigint, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- create challenge attempt (atomic with rule snapshot + transition)
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
set search_path = public
as $$
declare
  uid uuid := public.prop_os_cmd_require_uid();
  prior jsonb;
  acct public.prop_accounts%rowtype;
  ch_id uuid;
  rule_id uuid;
  rule_ver text;
  start_bal bigint;
  attempt_n int;
  body jsonb;
  prior_ch public.prop_challenges%rowtype;
begin
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

  select * into acct from public.prop_accounts where id = p_account_id;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if acct.status in ('archived', 'closed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'archived');
  end if;

  if p_reset_of is not null then
    select * into prior_ch from public.prop_challenges where id = p_reset_of;
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

  rule_ver := p_rule_snapshot ->> 'version';
  start_bal := acct.account_size_minor;
  ch_id := gen_random_uuid();
  rule_id := gen_random_uuid();

  insert into public.prop_challenges (
    id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
    started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version
  ) values (
    ch_id, uid, p_account_id, coalesce(p_phase, 'evaluation'), 'active', rule_ver, start_bal,
    coalesce(p_started_at, now()), null, p_reset_of, false, 'prop-os-schema-v0'
  );

  insert into public.prop_challenge_rule_snapshots (
    id, user_id, challenge_id, rule_set_version, snapshot, template_key,
    template_version_at_capture, captured_at, schema_version
  ) values (
    rule_id, uid, ch_id, rule_ver, p_rule_snapshot, p_template_id,
    p_template_version, coalesce(p_started_at, now()), 'prop-os-schema-v0'
  );

  insert into public.prop_challenge_transitions (
    id, user_id, challenge_id, from_status, to_status, reason_code, evidence, actor, at, schema_version
  ) values (
    gen_random_uuid(), uid, ch_id, null, 'active', 'challenge_created',
    jsonb_build_object('templateId', p_template_id, 'templateVersion', p_template_version, 'requestId', p_request_id),
    'user', coalesce(p_started_at, now()), 'prop-os-schema-v0'
  );

  select count(*)::int into attempt_n from public.prop_challenges where account_id = p_account_id;

  body := jsonb_build_object(
    'challenge', jsonb_build_object(
      'id', ch_id,
      'userId', uid,
      'accountId', p_account_id,
      'phase', coalesce(p_phase, 'evaluation'),
      'status', 'active',
      'ruleSetVersion', rule_ver
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

  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'create_challenge_attempt', p_request_hash,
    'success', body, null,
    jsonb_build_object('accountId', p_account_id, 'challengeId', ch_id, 'ruleSnapshotId', rule_id)
  );

  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when others then
    if sqlstate = '42501' then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    -- Transaction rolls back automatically on unhandled exception paths when we re-raise;
    -- return unexpected without leaking SQL detail.
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_create_challenge_attempt(text, text, uuid, text, text, jsonb, text, timestamptz, uuid)
  from public, anon;
grant execute on function public.prop_os_cmd_create_challenge_attempt(text, text, uuid, text, text, jsonb, text, timestamptz, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- set default account
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_set_default_account(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.prop_os_cmd_require_uid();
  prior jsonb;
  acct public.prop_accounts%rowtype;
  sel uuid;
  body jsonb;
begin
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  if p_account_id is not null then
    select * into acct from public.prop_accounts where id = p_account_id;
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

  select selected_challenge_id into sel from public.prop_os_user_preferences where user_id = uid;
  body := jsonb_build_object('defaultAccountId', p_account_id, 'selectedChallengeId', sel);
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'set_default_account', p_request_hash,
    'success', body, null, jsonb_build_object('accountId', p_account_id)
  );
  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when others then
    if sqlstate = '42501' or sqlstate = '23514' then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_set_default_account(text, text, uuid) from public, anon;
grant execute on function public.prop_os_cmd_set_default_account(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- archive account
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_archive_account(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_confirm_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.prop_os_cmd_require_uid();
  prior jsonb;
  acct public.prop_accounts%rowtype;
  active_count int;
  body jsonb;
begin
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into acct from public.prop_accounts where id = p_account_id;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select count(*)::int into active_count
    from public.prop_challenges
   where account_id = p_account_id and status in ('active', 'at_risk');

  if active_count > 0 and coalesce(p_confirm_active, false) is not true then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'active_challenge_confirmation_required');
  end if;

  update public.prop_accounts
     set status = 'archived',
         archived_at = now(),
         updated_at = now()
   where id = p_account_id;

  update public.prop_os_user_preferences
     set default_account_id = case when default_account_id = p_account_id then null else default_account_id end,
         selected_challenge_id = case
           when selected_challenge_id in (
             select id from public.prop_challenges where account_id = p_account_id
           ) then null else selected_challenge_id end,
         updated_at = now()
   where user_id = uid;

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
  when others then
    if sqlstate = '42501' then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_archive_account(text, text, uuid, boolean) from public, anon;
grant execute on function public.prop_os_cmd_archive_account(text, text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- select / clear challenge selection
-- ---------------------------------------------------------------------------

create or replace function public.prop_os_cmd_select_challenge(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.prop_os_cmd_require_uid();
  prior jsonb;
  acct public.prop_accounts%rowtype;
  ch public.prop_challenges%rowtype;
  def uuid;
  body jsonb;
begin
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into acct from public.prop_accounts where id = p_account_id;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;
  if acct.status in ('archived', 'closed') then
    return jsonb_build_object('kind', 'conflict', 'reasonCode', 'archived');
  end if;

  select * into ch from public.prop_challenges where id = p_challenge_id;
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

  select default_account_id into def from public.prop_os_user_preferences where user_id = uid;
  body := jsonb_build_object('defaultAccountId', def, 'selectedChallengeId', p_challenge_id);
  perform public.prop_os_cmd_store_receipt(
    uid, p_request_id, 'select_active_challenge', p_request_hash,
    'success', body, null,
    jsonb_build_object('accountId', p_account_id, 'challengeId', p_challenge_id)
  );
  return jsonb_build_object('kind', 'success', 'value', body);
exception
  when others then
    if sqlstate = '42501' or sqlstate = '23514' then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_select_challenge(text, text, uuid, uuid) from public, anon;
grant execute on function public.prop_os_cmd_select_challenge(text, text, uuid, uuid) to authenticated;

create or replace function public.prop_os_cmd_clear_challenge_selection(
  p_request_id text,
  p_request_hash text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.prop_os_cmd_require_uid();
  prior jsonb;
  acct public.prop_accounts%rowtype;
  sel uuid;
  def uuid;
  body jsonb;
begin
  prior := public.prop_os_cmd_lookup_receipt(uid, p_request_id, p_request_hash);
  if prior is not null then
    return prior;
  end if;

  select * into acct from public.prop_accounts where id = p_account_id;
  if not found or acct.user_id is distinct from uid then
    return jsonb_build_object('kind', 'forbidden');
  end if;

  select selected_challenge_id, default_account_id into sel, def
    from public.prop_os_user_preferences where user_id = uid;

  if sel is not null then
    if exists (
      select 1 from public.prop_challenges c
       where c.id = sel and c.account_id = p_account_id
    ) or not exists (select 1 from public.prop_challenges where id = sel) then
      update public.prop_os_user_preferences
         set selected_challenge_id = null, updated_at = now()
       where user_id = uid;
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
  when others then
    if sqlstate = '42501' then
      return jsonb_build_object('kind', 'forbidden');
    end if;
    return jsonb_build_object('kind', 'unexpected_error');
end;
$$;

revoke all on function public.prop_os_cmd_clear_challenge_selection(text, text, uuid) from public, anon;
grant execute on function public.prop_os_cmd_clear_challenge_selection(text, text, uuid) to authenticated;

comment on function public.prop_os_cmd_create_account is
  'Phase 2B: authenticated owner create Prop account. user_id from auth.uid() only.';
comment on function public.prop_os_cmd_create_challenge_attempt is
  'Phase 2B: atomic challenge + immutable rule snapshot + transition. No generic DML.';
