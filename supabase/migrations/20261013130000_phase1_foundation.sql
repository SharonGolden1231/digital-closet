-- =====================================================================
-- Vestry / Digital Closet: Phase 1 foundation, aligned to Build Plan v1
-- Apply to DEV ONLY first. Never edit this file after it has been applied
-- anywhere: write a new migration instead.
--
-- Rules baked in:
--  * RLS on every table. anon gets nothing.
--  * Owners can READ their own rows. ALL writes go through server code
--    (service role), except: display_name on profiles, and uploads into
--    their own folder of the private bucket. Reason: every event, match
--    and deletion must be logged / cleaned up by the server, and a browser
--    must not be able to fake a "web_confirmed" image.
--  * product_catalog is invisible to the browser, so web image URLs are
--    never exposed to other users (owner-only rule).
--  * The selfie is never stored: no image column exists for it anywhere.
--  * Category taxonomy lives in a versioned code file (per plan), so
--    category/subcategory are plain text here, not foreign keys.
-- =====================================================================

-- ---------- helpers ----------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  -- Allowlist for unlicensed web images (plan: dev + pilot users only).
  -- Server-managed: users cannot change it.
  web_image_pilot   boolean not null default false,
  created_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- consent_records (append-only: grants and withdrawals are new rows) ----------
create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  consent_type    text not null
    check (consent_type in ('storage', 'model_training', 'selfie_analysis')),
  policy_version  text not null,
  granted         boolean not null,
  created_at      timestamptz not null default now(),
  unique (id, user_id)
);
create index consent_records_user_idx
  on public.consent_records (user_id, consent_type, created_at desc);
alter table public.consent_records enable row level security;
revoke all on public.consent_records from anon, authenticated;
grant select on public.consent_records to authenticated;
create policy consent_records_select_own on public.consent_records
  for select to authenticated using (user_id = (select auth.uid()));
-- No update/delete anywhere: the record is permanent.

-- ---------- archetypes (shared, server-written, generic images recolored in code) ----------
create table public.archetypes (
  id               uuid primary key default gen_random_uuid(),
  category         text not null,
  subcategory      text not null,
  variant          text not null default 'solid',   -- stripes/prints/plaids need their own archetype
  base_image_path  text not null,
  recolorable      boolean not null default true,
  source           text check (source in ('commissioned', 'ai_generated')),  -- open decision
  license_note     text,
  created_at       timestamptz not null default now(),
  unique (category, subcategory, variant)
);
alter table public.archetypes enable row level security;
revoke all on public.archetypes from anon, authenticated;
grant select on public.archetypes to authenticated;
create policy archetypes_read on public.archetypes
  for select to authenticated using (true);

-- ---------- product_catalog (shared, server-written, NOT readable by browsers) ----------
create table public.product_catalog (
  id               uuid primary key default gen_random_uuid(),
  brand            text not null,
  style_code       text,
  barcode          text,
  name             text,
  color_name       text,
  composition      text,
  source           text,
  source_url       text,
  image_url        text,
  image_licensed   boolean not null default false,   -- false = unlicensed = purgeable
  retrieved_at     timestamptz,
  created_at       timestamptz not null default now(),
  -- provenance on every image: no image without its source and retrieval time
  constraint image_needs_provenance check (
    image_url is null or (source_url is not null and retrieved_at is not null)
  )
);
create unique index product_catalog_identity
  on public.product_catalog (lower(brand), coalesce(style_code, ''), coalesce(color_name, ''));
create index product_catalog_unlicensed_images
  on public.product_catalog (image_licensed) where image_url is not null;
alter table public.product_catalog enable row level security;
revoke all on public.product_catalog from anon, authenticated;
-- No policy + no grant = invisible to browsers. Only the service role reads/writes it.

-- ---------- closet_items ----------
create table public.closet_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text,
  category              text,
  subcategory           text,
  brand                 text,
  material              text,
  pattern               text,
  season                text,
  formality             text,
  size                  text,
  ingestion_channel     text not null
    check (ingestion_channel in ('camera', 'tag', 'brand_import', 'manual')),
  model_confidence      numeric(4, 3),
  model_version         text,
  raw_model_output      jsonb,
  user_confirmed        boolean not null default false,
  is_complete           boolean not null default false,
  catalog_id            uuid references public.product_catalog(id) on delete restrict,
  match_status          text not null default 'not_attempted'
    check (match_status in ('not_attempted', 'no_match', 'confirmed', 'rejected')),
  match_confidence      numeric(4, 3),
  archetype_id          uuid references public.archetypes(id),
  display_image_source  text not null
    check (display_image_source in ('web_catalog', 'user_cutout', 'user_original', 'archetype', 'emoji')),
  emoji                 text,
  color_hex             text check (color_hex ~ '^#[0-9a-fA-F]{6}$'),
  color_palette         jsonb,
  color_names           text[],
  color_confidence      numeric(4, 3),
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, user_id),

  -- a web image is shown only after the USER confirmed the match
  constraint web_catalog_needs_confirmed_match check (
    display_image_source <> 'web_catalog'
    or (catalog_id is not null and match_status = 'confirmed')
  ),
  constraint archetype_needs_archetype check (
    display_image_source <> 'archetype' or archetype_id is not null
  ),
  -- emoji: explicit choice, needs category + color swatch, always incomplete
  constraint emoji_rules check (
    display_image_source <> 'emoji'
    or (emoji is not null
        and category is not null
        and color_hex is not null
        and is_complete = false)
  )
);
create index closet_items_user_idx on public.closet_items (user_id) where deleted_at is null;
create trigger closet_items_updated_at
  before update on public.closet_items
  for each row execute function public.set_updated_at();
alter table public.closet_items enable row level security;
revoke all on public.closet_items from anon, authenticated;
grant select on public.closet_items to authenticated;
create policy closet_items_select_own on public.closet_items
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- item_images ----------
create table public.item_images (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  storage_path      text not null,
  image_type        text not null check (image_type in ('photo', 'tag', 'product', 'cutout')),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'done', 'failed')),
  created_at        timestamptz not null default now(),
  -- the image's owner must be the item's owner
  foreign key (item_id, user_id) references public.closet_items (id, user_id) on delete cascade,
  -- path must be USER_ID/ITEM_ID/filename (what the storage policy relies on)
  constraint path_matches_owner check (
    storage_path like user_id::text || '/' || item_id::text || '/%'
  )
);
create index item_images_item_idx on public.item_images (item_id);
alter table public.item_images enable row level security;
revoke all on public.item_images from anon, authenticated;
grant select on public.item_images to authenticated;
create policy item_images_select_own on public.item_images
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- match_attempts (decode accuracy and web-match accuracy kept separate) ----------
create table public.match_attempts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  item_id               uuid references public.closet_items(id) on delete set null,
  brand                 text,
  decoded_fields        jsonb,
  decode_ok             boolean not null,
  decode_method         text,
  search_query          text,
  candidate_catalog_id  uuid references public.product_catalog(id) on delete set null,
  candidate             jsonb,
  confidence            numeric(4, 3),
  -- only the user can accept or reject; null = pending or no candidate. No auto-accept value exists.
  user_decision         text check (user_decision in ('accepted', 'rejected')),
  response_ms           integer,
  cost_usd              numeric(10, 6) not null default 0,
  created_at            timestamptz not null default now()
);
create index match_attempts_user_idx on public.match_attempts (user_id);
create index match_attempts_brand_idx on public.match_attempts (lower(brand), created_at);
alter table public.match_attempts enable row level security;
revoke all on public.match_attempts from anon, authenticated;
grant select on public.match_attempts to authenticated;
create policy match_attempts_select_own on public.match_attempts
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- color_profiles (derived attributes only; NO image data) ----------
create table public.color_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  skin_tone          text,
  undertone          text,
  hair_color         text,
  eye_color          text,
  contrast_level     text,
  source             text not null default 'derived' check (source in ('derived', 'user_edited')),
  user_confirmed     boolean not null default false,
  model_version      text,
  derived_at         timestamptz not null default now(),
  consent_record_id  uuid not null,
  updated_at         timestamptz not null default now(),
  -- the consent reference must be this user's own record
  foreign key (consent_record_id, user_id) references public.consent_records (id, user_id)
);
create trigger color_profiles_updated_at
  before update on public.color_profiles
  for each row execute function public.set_updated_at();

-- Database-level guard: no color profile write unless the user's latest
-- selfie_analysis consent is "granted".
create function public.enforce_selfie_consent()
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
    and c.consent_type = 'selfie_analysis'
  order by c.created_at desc, c.id desc
  limit 1;

  if latest_granted is distinct from true then
    raise exception 'selfie_analysis consent not granted for user %', new.user_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_selfie_consent() from public, anon, authenticated;
create trigger color_profiles_require_consent
  before insert or update on public.color_profiles
  for each row execute function public.enforce_selfie_consent();

alter table public.color_profiles enable row level security;
revoke all on public.color_profiles from anon, authenticated;
grant select on public.color_profiles to authenticated;
create policy color_profiles_select_own on public.color_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- events (append-only; feeds every metric in the plan) ----------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null check (length(event_type) > 0),
  item_id     uuid references public.closet_items(id) on delete set null,
  outfit_id   uuid,   -- no outfits table until Phase 5
  payload     jsonb not null default '{}'::jsonb,   -- before/after values live here
  created_at  timestamptz not null default now()
);
create index events_user_idx on public.events (user_id, created_at desc);
create index events_type_idx on public.events (event_type, created_at desc);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;
create policy events_select_own on public.events
  for select to authenticated using (user_id = (select auth.uid()));
-- No update/delete policy and no client insert: append-only, server-written.

-- ---------- private storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('closet-private', 'closet-private', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files live under "<user_id>/<item_id>/<file>". Users can read and upload in
-- their own folder only; deletion is server-side so item deletion can remove
-- every stored image, including cutouts.
create policy closet_private_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'closet-private'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy closet_private_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'closet-private'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
