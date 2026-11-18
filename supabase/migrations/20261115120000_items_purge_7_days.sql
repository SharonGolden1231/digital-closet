-- Removed items are permanently deleted 7 days after removal (it was 14).
-- Only the default of items_due_for_purge changes; the nightly purge job
-- passes no argument, so this default is the single place the period lives.
-- Accounts keep their own 14-day grace period (accounts_due_for_purge).

create or replace function public.items_due_for_purge(grace interval default interval '7 days')
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

-- Same access as before: the server job only.
revoke execute on function public.items_due_for_purge(interval) from public, anon, authenticated;
grant execute on function public.items_due_for_purge(interval) to service_role;

-- rollback (reference only): re-run the function above with interval '14 days'.
