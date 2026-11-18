-- Request access (waiting list). People without an invite code leave their
-- email and a few answers; Sharon (admin) approves, which creates a founder
-- invite code for that person.
-- Nobody can read or write this table directly: only the server routes, with
-- the server key, after checking the admin flag where needed.
-- Apply to DEV first. Never apply to production before the preview test passes.

create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (char_length(email) between 5 and 254),
  phone_os     text check (phone_os is null or phone_os in ('iphone', 'android', 'other')),
  country      text check (country is null or char_length(country) between 1 and 60),
  heard_from   text check (heard_from is null or char_length(heard_from) between 1 and 200),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  invite_code  text,
  ip_hash      text,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references auth.users(id) on delete set null
);

-- One open request per email.
create unique index if not exists access_requests_pending_email
  on public.access_requests (lower(email)) where status = 'pending';
create index if not exists access_requests_ip_recent
  on public.access_requests (ip_hash, created_at desc);

alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;
-- No policies: only the server key (which bypasses row-level security) can use it.

-- Records a request. Answers 'ok' (also for a repeat of an open request, so
-- the form never reveals who already asked) or 'limited' (too many from one
-- network in the last hour).
create or replace function public.submit_access_request(
  p_email text,
  p_phone_os text,
  p_country text,
  p_heard_from text,
  p_ip_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
  e text := lower(btrim(p_email));
begin
  select count(*) into recent from public.access_requests
   where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  if recent >= 5 then
    return 'limited';
  end if;
  if exists (select 1 from public.access_requests where lower(email) = e and status = 'pending') then
    return 'ok';
  end if;
  insert into public.access_requests (email, phone_os, country, heard_from, ip_hash)
  values (e, p_phone_os, nullif(btrim(p_country), ''), nullif(btrim(p_heard_from), ''), p_ip_hash);
  return 'ok';
end;
$$;

revoke all on function public.submit_access_request(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_access_request(text, text, text, text, text) to service_role;
