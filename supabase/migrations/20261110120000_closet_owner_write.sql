-- 2a-core: closet saving.
--
-- Lets a signed-in user INSERT and UPDATE only their own closet rows.
--   * RLS stays on for both tables (policies below pin every row to auth.uid()).
--   * Column-level grants limit WHICH columns a user-token client may write.
--     Server-owned columns (catalog_id, match_status, match_confidence,
--     archetype_id) are deliberately NOT granted, so a user-token client can
--     never create a web_catalog or archetype item; those are written later by
--     server code that uses the service role.
--   * There is no DELETE grant or policy. Items are soft-deleted by setting
--     deleted_at; the server-side deletion job purges them.
--   * The existing BEFORE INSERT account_lock triggers keep working.

-- ---------------------------------------------------------------- closet_items

create policy closet_items_insert_own
  on public.closet_items
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy closet_items_update_own
  on public.closet_items
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant insert (
  id, user_id, name, category, subcategory, brand, material, pattern,
  season, formality, size, ingestion_channel, model_confidence,
  model_version, raw_model_output, user_confirmed, is_complete,
  display_image_source, emoji, color_hex, color_palette, color_names,
  color_confidence
) on public.closet_items to authenticated;

grant update (
  name, category, subcategory, brand, material, pattern, season, formality,
  size, model_confidence, model_version, raw_model_output, user_confirmed,
  is_complete, display_image_source, emoji, color_hex, color_palette,
  color_names, color_confidence, deleted_at
) on public.closet_items to authenticated;

-- ----------------------------------------------------------------- item_images

create policy item_images_insert_own
  on public.item_images
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy item_images_update_own
  on public.item_images
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant insert (item_id, user_id, storage_path, image_type, processing_status)
  on public.item_images to authenticated;

grant update (processing_status)
  on public.item_images to authenticated;

-- Allow one small thumbnail per item for fast closet grids.
alter table public.item_images
  drop constraint item_images_image_type_check;

alter table public.item_images
  add constraint item_images_image_type_check
  check (image_type = any (array['photo', 'tag', 'product', 'cutout', 'thumb']));

-- One image row per type per item, so a retried save cannot create duplicates.
create unique index item_images_item_type_key
  on public.item_images (item_id, image_type);

-- ------------------------------------------------------------------- rollback
-- (for reference only; not run by the migration)
--   drop policy closet_items_insert_own on public.closet_items;
--   drop policy closet_items_update_own on public.closet_items;
--   drop policy item_images_insert_own on public.item_images;
--   drop policy item_images_update_own on public.item_images;
--   revoke insert, update on public.closet_items from authenticated;
--   revoke insert, update on public.item_images from authenticated;
--   drop index public.item_images_item_type_key;
--   alter table public.item_images drop constraint item_images_image_type_check;
--   alter table public.item_images add constraint item_images_image_type_check
--     check (image_type = any (array['photo','tag','product','cutout']));
