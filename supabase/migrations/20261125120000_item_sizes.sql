-- Item sizes and tag measurements (Phase 1 of docs/design/sizes-and-fit.md)
-- Sharon 2026-11-25: label size and tag measurements are saved and shown on
-- every item; comparing items with the user's own body happens only with the
-- body-measurements consent (enforced in the app/server, not stored here).
-- Users can correct size and measurements; the source of each is recorded.
--
-- The existing column `size` holds the size exactly as printed (e.g. "S",
-- "38", "W32 L34"). Row access is unchanged: the existing owner-only
-- select/insert/update policies on closet_items apply to the new columns.

alter table public.closet_items
  add column size_system      text
    check (size_system is null or size_system in
      ('letter', 'EU', 'US', 'UK', 'IT', 'FR', 'MX', 'JP', 'waist_length', 'kids', 'shoe', 'other')),
  add column size_equivalents jsonb
    check (size_equivalents is null or jsonb_typeof(size_equivalents) = 'array'),
  add column size_evidence    text
    check (size_evidence is null or length(size_evidence) <= 200),
  add column size_source      text
    check (size_source is null or size_source in ('label', 'user')),
  add column body_code_raw    text
    check (body_code_raw is null or length(body_code_raw) <= 40),
  add column fit_height_cm    numeric(5,1)
    check (fit_height_cm is null or fit_height_cm between 50 and 230),
  add column fit_chest_cm     numeric(5,1)
    check (fit_chest_cm is null or fit_chest_cm between 40 and 200),
  add column fit_waist_cm     numeric(5,1)
    check (fit_waist_cm is null or fit_waist_cm between 30 and 200),
  add column fit_hip_cm       numeric(5,1)
    check (fit_hip_cm is null or fit_hip_cm between 40 and 220),
  add column fit_source       text
    check (fit_source is null or fit_source in ('label', 'brand_chart', 'user'));

grant insert (
  size_system, size_equivalents, size_evidence, size_source, body_code_raw,
  fit_height_cm, fit_chest_cm, fit_waist_cm, fit_hip_cm, fit_source
) on public.closet_items to authenticated;

grant update (
  size_system, size_equivalents, size_evidence, size_source, body_code_raw,
  fit_height_cm, fit_chest_cm, fit_waist_cm, fit_hip_cm, fit_source
) on public.closet_items to authenticated;
