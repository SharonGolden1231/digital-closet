-- 2a-core follow-up: two attributes the app already records for every item.
-- Additive only (no existing rows or constraints change). Column-level grants
-- mirror the first closet-save migration: users may write these two columns on
-- their own rows, nothing else is widened.

alter table public.closet_items
  add column fit text,
  add column subcategory_confidence text;

grant insert (fit, subcategory_confidence) on public.closet_items to authenticated;
grant update (fit, subcategory_confidence) on public.closet_items to authenticated;

-- rollback (reference only):
--   revoke insert (fit, subcategory_confidence), update (fit, subcategory_confidence) on public.closet_items from authenticated;
--   alter table public.closet_items drop column fit, drop column subcategory_confidence;
