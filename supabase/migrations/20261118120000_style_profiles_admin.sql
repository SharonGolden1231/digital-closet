-- Phase 3a: intro questions (style profile), admin flag, the central closet
-- access check (stylist foundation), and no new AI consent while an account
-- is scheduled for deletion.
-- Apply to DEV first. Never apply to production before the preview test passes.

-- ------------------------------------------------ central access check
-- One place that answers "may the signed-in person see this person's closet
-- data?". Owner only for now. When stylist sharing is built, this function
-- gains the shared-access rule and every policy that uses it follows.
create or replace function public.can_access_closet(p_owner uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_owner is not null and p_owner = (select auth.uid());
$$;
revoke all on function public.can_access_closet(uuid) from public, anon;
grant execute on function public.can_access_closet(uuid) to authenticated, service_role;

-- ------------------------------------------------ admin flag
-- Server-managed: users can read their own flag but never change it (the only
-- column users may update on profiles is display_name).
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ------------------------------------------------ style profile
create table if not exists public.style_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  first_name     text check (first_name is null or char_length(first_name) between 1 and 40),
  adult_confirmed boolean not null default false,
  age_band       text check (age_band is null or age_band in
                   ('18-24', '25-34', '35-44', '45-54', '55-64', '65+')),
  shops_for      text check (shops_for is null or shops_for in ('womenswear', 'menswear', 'both')),
  weekdays       text[] not null default '{}' check (
                   cardinality(weekdays) <= 2 and weekdays <@ array[
                   'office_formal', 'business_casual', 'creative', 'remote',
                   'on_feet', 'student', 'home_with_kids', 'other']::text[]),
  weekends       text[] not null default '{}' check (
                   weekends <@ array['errands', 'outdoors_sport', 'going_out', 'events', 'family']::text[]),
  style_now      text[] not null default '{}' check (
                   cardinality(style_now) <= 3 and style_now <@ array[
                   'classic', 'minimal', 'relaxed', 'polished', 'edgy', 'romantic', 'sporty', 'bold']::text[]),
  style_toward   text[] not null default '{}' check (
                   cardinality(style_toward) <= 3 and style_toward <@ array[
                   'classic', 'minimal', 'relaxed', 'polished', 'edgy', 'romantic', 'sporty', 'bold']::text[]),
  style_icon     text check (style_icon is null or char_length(style_icon) between 1 and 80),
  goals          text[] not null default '{}' check (
                   cardinality(goals) <= 2 and goals <@ array[
                   'dress_faster', 'wear_more_closet', 'put_together',
                   'buy_smarter', 'find_style', 'new_stage']::text[]),
  brand_tiers    text[] not null default '{}' check (
                   brand_tiers <@ array['fast_fashion', 'mid_market', 'premium', 'luxury', 'resale_vintage']::text[]),
  brands         text[] not null default '{}' check (cardinality(brands) <= 20),
  height_cm      smallint check (height_cm is null or height_cm between 120 and 230),
  fit_issues     text[] not null default '{}' check (
                   fit_issues <@ array['waist', 'hips', 'chest', 'shoulders', 'length', 'sleeves', 'none']::text[]),
  colors_love    text[] not null default '{}' check (cardinality(colors_love) <= 12),
  colors_avoid   text[] not null default '{}' check (cardinality(colors_avoid) <= 12),
  onboarding_completed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists style_profiles_updated_at on public.style_profiles;
create trigger style_profiles_updated_at
  before update on public.style_profiles
  for each row execute function public.set_updated_at();

alter table public.style_profiles enable row level security;
revoke all on public.style_profiles from anon, authenticated;
grant select, insert, update on public.style_profiles to authenticated;

-- Reading goes through the central check (a stylist may read later).
-- Writing stays owner-only, always.
drop policy if exists style_profiles_select on public.style_profiles;
create policy style_profiles_select on public.style_profiles
  for select to authenticated
  using ((select public.can_access_closet(user_id)));

drop policy if exists style_profiles_insert_own on public.style_profiles;
create policy style_profiles_insert_own on public.style_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists style_profiles_update_own on public.style_profiles;
create policy style_profiles_update_own on public.style_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------ consent while deleting
-- An account scheduled for deletion may WITHDRAW consent but not grant it.
-- Enforced here because signed-in users can call this function directly.
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
  if p_granted and exists (
       select 1 from public.profiles p
        where p.id = uid and p.deletion_requested_at is not null) then
    raise exception 'account_deleting';
  end if;
  insert into public.consent_records (user_id, consent_type, policy_version, granted)
  values (uid, p_type, p_version, p_granted);
end;
$$;
revoke all on function public.record_consent(text, text, boolean) from public, anon;
grant execute on function public.record_consent(text, text, boolean) to authenticated;
