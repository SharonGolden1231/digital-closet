-- Optional body measurements (weight, chest, waist, hips, inseam).
-- Treated as sensitive: own table, owner-only (never shared with stylists, not
-- even through can_access_closet), and the database refuses to store them
-- unless the person's latest "body_measurements" consent is granted.
-- Withdrawing consent deletes the row (done by the server route).
-- Apply to DEV first. Never apply to production before the preview test passes.

-- Allow the new consent type.
alter table public.consent_records drop constraint if exists consent_records_consent_type_check;
alter table public.consent_records add constraint consent_records_consent_type_check
  check (consent_type = any (array[
    'storage', 'model_training', 'selfie_analysis',
    'ai_processing', 'terms', 'privacy', 'body_measurements'
  ]));

create or replace function public.record_consent(p_type text, p_version text, p_granted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_type not in ('ai_processing', 'terms', 'privacy', 'body_measurements') then
    raise exception 'unknown consent type';
  end if;
  if p_version is null or length(p_version) = 0 or length(p_version) > 40 then
    raise exception 'invalid version';
  end if;
  if p_granted and exists (
       select 1 from public.profiles p
        where p.id = uid and p.deletion_requested_at is not null) then
    raise exception 'account_deleting';
  end if;
  -- clock_timestamp(), not now(): two decisions in one transaction must still
  -- have a clear order, or "latest consent" would be ambiguous.
  insert into public.consent_records (user_id, consent_type, policy_version, granted, created_at)
  values (uid, p_type, p_version, p_granted, clock_timestamp());
end;
$$;
revoke all on function public.record_consent(text, text, boolean) from public, anon;
grant execute on function public.record_consent(text, text, boolean) to authenticated;

create table if not exists public.body_measurements (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  weight_kg   numeric(5,1) check (weight_kg is null or weight_kg between 30 and 300),
  chest_cm    numeric(5,1) check (chest_cm is null or chest_cm between 50 and 200),
  waist_cm    numeric(5,1) check (waist_cm is null or waist_cm between 40 and 200),
  hips_cm     numeric(5,1) check (hips_cm is null or hips_cm between 50 and 220),
  inseam_cm   numeric(5,1) check (inseam_cm is null or inseam_cm between 40 and 120),
  units       text not null default 'imperial' check (units in ('imperial', 'metric')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists body_measurements_updated_at on public.body_measurements;
create trigger body_measurements_updated_at
  before update on public.body_measurements
  for each row execute function public.set_updated_at();

-- No write unless the latest body_measurements consent is "granted".
create or replace function public.enforce_body_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_granted boolean;
begin
  select c.granted into latest_granted
    from public.consent_records c
   where c.user_id = new.user_id
     and c.consent_type = 'body_measurements'
   order by c.created_at desc, c.id desc
   limit 1;
  if latest_granted is distinct from true then
    raise exception 'body_measurements consent not granted';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_body_consent() from public, anon, authenticated;

drop trigger if exists body_measurements_require_consent on public.body_measurements;
create trigger body_measurements_require_consent
  before insert or update on public.body_measurements
  for each row execute function public.enforce_body_consent();

alter table public.body_measurements enable row level security;
revoke all on public.body_measurements from anon, authenticated;
grant select, insert, update, delete on public.body_measurements to authenticated;

-- Owner only. Deliberately NOT can_access_closet: sharing body data with a
-- stylist will need its own explicit grant.
drop policy if exists body_measurements_own on public.body_measurements;
create policy body_measurements_own on public.body_measurements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
