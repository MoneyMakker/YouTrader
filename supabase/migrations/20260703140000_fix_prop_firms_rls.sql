-- Fix prop_firms read access: anon + authenticated can SELECT active templates only.

alter table public.prop_firms
  add column if not exists is_active boolean not null default true;

update public.prop_firms
set is_active = true
where is_active is null;

grant usage on schema public to anon, authenticated;
grant select on public.prop_firms to anon, authenticated;

revoke insert, update, delete on public.prop_firms from anon, authenticated;

alter table public.prop_firms enable row level security;

drop policy if exists "Prop firm templates are readable" on public.prop_firms;
drop policy if exists "Anon can read active prop firm templates" on public.prop_firms;
drop policy if exists "Authenticated can read active prop firm templates" on public.prop_firms;

create policy "Anon can read active prop firm templates"
on public.prop_firms
for select
to anon
using (is_active = true);

create policy "Authenticated can read active prop firm templates"
on public.prop_firms
for select
to authenticated
using (is_active = true);
