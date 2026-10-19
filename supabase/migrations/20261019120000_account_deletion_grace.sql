-- =====================================================================
-- Vestry / Digital Closet: account deletion grace period
-- Builds on 20261013130000_phase1_foundation.sql (never edit that file).
-- Apply to DEV first, then test, then production together with migration 1.
--
-- How the grace period works:
--  * A deletion request only sets profiles.deletion_requested_at (server only).
--  * While set, the account is LOCKED: the database refuses new items, image
--    records, match attempts, and color profile changes, even if a server
--    route forgets to check. Consent withdrawals and events stay allowed so
--    the request itself, a restore, and consent withdrawal can still be logged.
--  * The face-derived color profile is deleted immediately by server code
--    (a delete, which the lock does not block).
--  * After 14 days a scheduled server job purges: it asks the functions below
--    which accounts / trashed items are due, deletes stored files through the
--    Storage API, then deletes the account (cascade removes every row).
--  * "Delete permanently now" skips the wait; server code runs the same purge.
-- The 14-day value is the default of the functions below; the job passes no
-- argument, so changing the period means a new migration.
-- =====================================================================

alter table public.profiles add column deletion_requested_at timestamptz;
-- Browsers cannot set it: profiles only grants UPDATE on display_name.

create index profiles_deletion_due_idx
  on public.profiles (deletion_requested_at)
  where deletion_requested_at is not null;

-- ---------- account lock ----------
create function public.enforce_account_not_locked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.user_id
      and p.deletion_requested_at is not null
  ) then
    raise exception 'account_pending_deletion: no new data while an account is scheduled for deletion';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_account_not_locked() from public, anon, authenticated;

create trigger closet_items_account_lock
  before insert on public.closet_items
  for each row execute function public.enforce_account_not_locked();
create trigger item_images_account_lock
  before insert on public.item_images
  for each row execute function public.enforce_account_not_locked();
create trigger match_attempts_account_lock
  before insert on public.match_attempts
  for each row execute function public.enforce_account_not_locked();
create trigger color_profiles_account_lock
  before insert or update on public.color_profiles
  for each row execute function public.enforce_account_not_locked();

-- ---------- purge lists (server job only) ----------
create function public.accounts_due_for_purge(grace interval default interval '14 days')
returns table (user_id uuid, requested_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select p.id as user_id, p.deletion_requested_at as requested_at
  from public.profiles p
  where p.deletion_requested_at is not null
    and p.deletion_requested_at <= now() - grace
  order by p.deletion_requested_at
$$;
revoke execute on function public.accounts_due_for_purge(interval) from public, anon, authenticated;
grant execute on function public.accounts_due_for_purge(interval) to service_role;

create function public.items_due_for_purge(grace interval default interval '14 days')
returns table (item_id uuid, user_id uuid, deleted_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select i.id as item_id, i.user_id as user_id, i.deleted_at as deleted_at
  from public.closet_items i
  where i.deleted_at is not null
    and i.deleted_at <= now() - grace
  order by i.deleted_at
$$;
revoke execute on function public.items_due_for_purge(interval) from public, anon, authenticated;
grant execute on function public.items_due_for_purge(interval) to service_role;
