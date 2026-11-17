-- Invite codes with a release cap, account deletion requests, AI consent records.
-- Apply to DEV first. Never apply to production until the preview test passes.

-- ---------------------------------------------------------------- settings
-- Server-only key/value settings (the release cap lives here).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values
  ('user_cap', '10'::jsonb),
  ('invites_per_user', '3'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------ invite codes
create table if not exists public.invite_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_by uuid references auth.users(id) on delete cascade, -- null = founder
  created_at timestamptz not null default now(),
  claimed_at timestamptz,   -- set while a sign-up is in progress
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz
);
create index if not exists invite_codes_created_by_idx on public.invite_codes (created_by);

alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;
grant select on public.invite_codes to authenticated;
drop policy if exists invite_codes_select_own on public.invite_codes;
create policy invite_codes_select_own on public.invite_codes
  for select to authenticated
  using (created_by = (select auth.uid()));

-- Throttle for the public redeem route (hashed addresses only).
create table if not exists public.invite_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists invite_attempts_lookup_idx on public.invite_attempts (ip_hash, created_at);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from anon, authenticated;

-- ---------------------------------------------------------------- functions
create or replace function public.make_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 symbols
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  idx int[] := array[0,1,2,3,4,5,9,10,11,12]; -- skips the fixed version bytes
  out text := '';
  i int;
begin
  foreach i in array idx loop
    out := out || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;

create or replace function public.issue_invite_codes(p_owner uuid, p_count int)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  made int := 0;
  c text;
begin
  while made < p_count loop
    c := public.make_invite_code();
    begin
      insert into public.invite_codes (code, created_by) values (c, p_owner);
      made := made + 1;
      return next c;
    exception when unique_violation then
      null; -- extremely unlikely; draw again
    end;
  end loop;
end;
$$;

-- Reserve a code for a sign-up in progress. Returns 'ok', 'invalid' or 'full'.
create or replace function public.claim_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.invite_codes%rowtype;
  cap int;
  used int;
begin
  perform pg_advisory_xact_lock(7314001);

  select * into c from public.invite_codes
   where code = upper(btrim(p_code)) for update;
  if not found
     or c.revoked_at is not null
     or c.redeemed_at is not null
     or (c.claimed_at is not null and c.claimed_at > now() - interval '10 minutes') then
    return 'invalid';
  end if;

  cap := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'user_cap'), 0);
  used := (select count(*) from auth.users)
        + (select count(*) from public.invite_codes
            where redeemed_at is null and claimed_at > now() - interval '10 minutes');
  if used >= cap then
    return 'full';
  end if;

  update public.invite_codes set claimed_at = now() where code = c.code;
  return 'ok';
end;
$$;

create or replace function public.release_invite(p_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invite_codes set claimed_at = null
   where code = upper(btrim(p_code)) and redeemed_at is null;
$$;

-- Completes a sign-up: marks the code used and gives the new user their codes.
create or replace function public.finish_invite(p_code text, p_user_id uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.invite_codes
     set redeemed_by = p_user_id, redeemed_at = now()
   where code = upper(btrim(p_code)) and redeemed_at is null;
  if not found then
    raise exception 'invite not claimable';
  end if;
  n := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'invites_per_user'), 3);
  return query select public.issue_invite_codes(p_user_id, n);
end;
$$;

create or replace function public.invite_attempt_allowed(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  delete from public.invite_attempts where created_at < now() - interval '1 day';
  select count(*) into recent from public.invite_attempts
   where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  if recent >= 10 then
    return false;
  end if;
  insert into public.invite_attempts (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- Release status for the founder: used spots, pending claims, and the cap.
create or replace function public.invite_capacity()
returns table(cap int, used int, pending int)
language sql
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'user_cap'), 0),
         (select count(*)::int from auth.users),
         (select count(*)::int from public.invite_codes
           where redeemed_at is null and claimed_at > now() - interval '10 minutes');
$$;

-- --------------------------------------------------------- account deletion
create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ts timestamptz;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  insert into public.profiles (id, deletion_requested_at) values (uid, now())
  on conflict (id) do update
    set deletion_requested_at = coalesce(public.profiles.deletion_requested_at, now())
  returning deletion_requested_at into ts;
  return ts;
end;
$$;

create or replace function public.cancel_account_deletion()
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
  update public.profiles set deletion_requested_at = null where id = uid;
end;
$$;

-- ----------------------------------------------------------------- consent
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
  if p_type not in ('ai_processing', 'terms', 'privacy') then
    raise exception 'unknown consent type';
  end if;
  if p_version is null or length(p_version) = 0 or length(p_version) > 40 then
    raise exception 'invalid version';
  end if;
  insert into public.consent_records (user_id, consent_type, policy_version, granted)
  values (uid, p_type, p_version, p_granted);
end;
$$;

-- ------------------------------------------------------------------ rights
-- Server-only functions: service_role only.
revoke all on function public.make_invite_code() from public, anon, authenticated;
revoke all on function public.issue_invite_codes(uuid, int) from public, anon, authenticated;
revoke all on function public.claim_invite(text) from public, anon, authenticated;
revoke all on function public.release_invite(text) from public, anon, authenticated;
revoke all on function public.finish_invite(text, uuid) from public, anon, authenticated;
revoke all on function public.invite_attempt_allowed(text) from public, anon, authenticated;
revoke all on function public.invite_capacity() from public, anon, authenticated;
grant execute on function public.make_invite_code() to service_role;
grant execute on function public.issue_invite_codes(uuid, int) to service_role;
grant execute on function public.claim_invite(text) to service_role;
grant execute on function public.release_invite(text) to service_role;
grant execute on function public.finish_invite(text, uuid) to service_role;
grant execute on function public.invite_attempt_allowed(text) to service_role;
grant execute on function public.invite_capacity() to service_role;

-- Signed-in users: only their own deletion and consent.
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
revoke all on function public.record_consent(text, text, boolean) from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.record_consent(text, text, boolean) to authenticated;

-- The table already allows storage / model_training / selfie_analysis. Add the
-- consent types the app now records. Safe to run more than once.
alter table public.consent_records drop constraint if exists consent_records_consent_type_check;
alter table public.consent_records add constraint consent_records_consent_type_check
  check (consent_type = any (array[
    'storage', 'model_training', 'selfie_analysis',
    'ai_processing', 'terms', 'privacy'
  ]));

-- Index for the per-user lookups used by consent checks.
create index if not exists consent_records_user_type_idx
  on public.consent_records (user_id, consent_type, created_at desc);
