-- Body measurement history + height and shoulders (Phase 2 of docs/design/sizes-and-fit.md)
-- Sharon 2026-11-26: every save adds a dated entry (kept unchanged); height and
-- shoulders added; nothing of the history is shown to the user in this version.
-- Same protection as body_measurements: owner only, and no write unless the
-- latest body_measurements consent is granted (existing enforce_body_consent()).
-- Withdrawing consent deletes the current row AND all entries (api/profile.ts).
-- Account deletion removes everything through "on delete cascade".

-- 1. Current values: add height and shoulders
alter table public.body_measurements
  add column height_cm   numeric(5,1) check (height_cm is null or height_cm between 100 and 230),
  add column shoulder_cm numeric(5,1) check (shoulder_cm is null or shoulder_cm between 30 and 70);

-- 2. Dated history
create table public.body_measurement_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  height_cm   numeric(5,1) check (height_cm   is null or height_cm   between 100 and 230),
  weight_kg   numeric(5,1) check (weight_kg   is null or weight_kg   between 30 and 300),
  chest_cm    numeric(5,1) check (chest_cm    is null or chest_cm    between 50 and 200),
  waist_cm    numeric(5,1) check (waist_cm    is null or waist_cm    between 40 and 200),
  hips_cm     numeric(5,1) check (hips_cm     is null or hips_cm     between 50 and 220),
  inseam_cm   numeric(5,1) check (inseam_cm   is null or inseam_cm   between 40 and 120),
  shoulder_cm numeric(5,1) check (shoulder_cm is null or shoulder_cm between 30 and 70),
  source      text not null default 'user' check (source in ('user')),
  created_at  timestamptz not null default now(),
  constraint body_measurement_entries_not_empty check (
    coalesce(height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoulder_cm) is not null
  )
);

create index body_measurement_entries_user_time_idx
  on public.body_measurement_entries (user_id, measured_at desc);

-- No write unless the latest body_measurements consent is granted
create trigger body_measurement_entries_require_consent
  before insert on public.body_measurement_entries
  for each row execute function public.enforce_body_consent();

-- Owner only; entries are never edited (no update grant), only added or deleted.
alter table public.body_measurement_entries enable row level security;
revoke all on public.body_measurement_entries from anon, authenticated;
grant select, insert, delete on public.body_measurement_entries to authenticated;

create policy body_measurement_entries_own on public.body_measurement_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3. Existing current values become each user's first history entry.
-- (Rows exist only while consent is granted: withdrawal deletes them.)
insert into public.body_measurement_entries
  (user_id, measured_at, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, source)
select user_id, updated_at, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, 'user'
  from public.body_measurements
 where coalesce(weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm) is not null;
