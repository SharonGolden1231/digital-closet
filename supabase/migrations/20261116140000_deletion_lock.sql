-- An account that asked to be deleted: stops counting against the release cap,
-- its unused invite codes stop working, and cancelling needs room under the cap.
-- (The app side locks the account too: see api/_lib/gate.ts.)
-- Apply to DEV first. Never apply to production before the preview test passes.

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

  -- The person who owns this code has asked to delete their account.
  if c.created_by is not null and exists (
       select 1 from public.profiles p
        where p.id = c.created_by and p.deletion_requested_at is not null) then
    return 'invalid';
  end if;

  cap := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'user_cap'), 0);
  used := (select count(*) from auth.users u
            where not exists (select 1 from public.profiles p
                               where p.id = u.id and p.deletion_requested_at is not null))
        + (select count(*) from public.invite_codes
            where redeemed_at is null and claimed_at > now() - interval '10 minutes');
  if used >= cap then
    return 'full';
  end if;

  update public.invite_codes set claimed_at = now() where code = c.code;
  return 'ok';
end;
$$;

create or replace function public.invite_capacity()
returns table(cap int, used int, pending int)
language sql
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'user_cap'), 0),
         (select count(*)::int from auth.users u
           where not exists (select 1 from public.profiles p
                              where p.id = u.id and p.deletion_requested_at is not null)),
         (select count(*)::int from public.invite_codes
           where redeemed_at is null and claimed_at > now() - interval '10 minutes');
$$;

-- Cancelling a deletion now answers 'ok' or 'full' (no room under the cap).
drop function if exists public.cancel_account_deletion();
create function public.cancel_account_deletion()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cap int;
  used int;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  perform pg_advisory_xact_lock(7314001);

  -- Nothing to cancel.
  if not exists (select 1 from public.profiles
                  where id = uid and deletion_requested_at is not null) then
    return 'ok';
  end if;

  cap := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'user_cap'), 0);
  used := (select count(*) from auth.users u
            where not exists (select 1 from public.profiles p
                               where p.id = u.id and p.deletion_requested_at is not null))
        + (select count(*) from public.invite_codes
            where redeemed_at is null and claimed_at > now() - interval '10 minutes');
  if used >= cap then
    return 'full';
  end if;

  update public.profiles set deletion_requested_at = null where id = uid;
  return 'ok';
end;
$$;

revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;
