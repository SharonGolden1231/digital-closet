-- More intro-question options (Sharon, 2026-11-18):
--  weekdays: evenings out / dinners, gym / workout (up to 4 picks)
--  styles: street casual, modest / conservative, luxurious, quiet luxury,
--          boho, preppy, trendy, vintage (current style and style wanted)
--  goals: dress to impress, find a new style, dress for my body shape (up to 3)
-- Apply to DEV first. Never apply to production before the preview test passes.

alter table public.style_profiles drop constraint if exists style_profiles_weekdays_check;
alter table public.style_profiles add constraint style_profiles_weekdays_check check (
  cardinality(weekdays) <= 4 and weekdays <@ array[
  'office_formal', 'business_casual', 'creative', 'remote', 'on_feet', 'student',
  'home_with_kids', 'other', 'evenings_out', 'gym_workout']::text[]);

alter table public.style_profiles drop constraint if exists style_profiles_style_now_check;
alter table public.style_profiles add constraint style_profiles_style_now_check check (
  cardinality(style_now) <= 3 and style_now <@ array[
  'classic', 'minimal', 'relaxed', 'polished', 'edgy', 'romantic', 'sporty', 'bold',
  'street_casual', 'modest', 'luxe', 'quiet_luxury', 'boho', 'preppy', 'trendy', 'vintage']::text[]);

alter table public.style_profiles drop constraint if exists style_profiles_style_toward_check;
alter table public.style_profiles add constraint style_profiles_style_toward_check check (
  cardinality(style_toward) <= 3 and style_toward <@ array[
  'classic', 'minimal', 'relaxed', 'polished', 'edgy', 'romantic', 'sporty', 'bold',
  'street_casual', 'modest', 'luxe', 'quiet_luxury', 'boho', 'preppy', 'trendy', 'vintage']::text[]);

alter table public.style_profiles drop constraint if exists style_profiles_goals_check;
alter table public.style_profiles add constraint style_profiles_goals_check check (
  cardinality(goals) <= 3 and goals <@ array[
  'dress_faster', 'wear_more_closet', 'put_together', 'buy_smarter', 'find_style', 'new_stage',
  'dress_to_impress', 'new_style', 'body_shape']::text[]);
