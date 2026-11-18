-- Consent proof now uses KEYED hashes (HMAC-SHA256). The server computes them
-- with CONSENT_HASH_KEY, which lives only in Vercel, never in the database.
-- Before this change the archive held plain SHA-256 of the email and user id,
-- which anyone with a copy of the database could match against a list of
-- emails. With a keyed hash, the database alone reveals nothing; proof for a
-- dispute is still possible by hashing the person's email with the key.
-- Apply to DEV first. Never apply to production before the preview test passes.

alter table public.consent_archive
  add column if not exists hash_scheme text not null default 'sha256-unkeyed';

-- Rows written before this change use the weak plain hash. Only DEV test data
-- exists (production never had this table), so they are removed rather than
-- kept in a reversible form.
delete from public.consent_archive where hash_scheme = 'sha256-unkeyed';

alter table public.consent_archive
  alter column hash_scheme set default 'hmac-sha256-v1';

alter table public.consent_archive
  drop constraint if exists consent_archive_refs_hex;
alter table public.consent_archive
  add constraint consent_archive_refs_hex check (
    user_ref ~ '^[0-9a-f]{64}$'
    and (email_ref is null or email_ref ~ '^[0-9a-f]{64}$')
  );

-- The old version hashed inside the database (no key). It is replaced by one
-- that only stores the keyed references the server passes in.
drop function if exists public.archive_consent_for_user(uuid);

create function public.archive_consent_for_user(
  p_user_id uuid,
  p_user_ref text,
  p_email_ref text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  added int;
begin
  if p_user_id is null
     or p_user_ref is null or p_user_ref !~ '^[0-9a-f]{64}$'
     or (p_email_ref is not null and p_email_ref !~ '^[0-9a-f]{64}$') then
    raise exception 'archive_consent_for_user: invalid arguments';
  end if;

  -- Safe to run twice: rows already archived for the same person, type,
  -- version, decision and date are skipped.
  insert into public.consent_archive
    (user_ref, email_ref, consent_type, policy_version, granted, granted_at, hash_scheme)
  select p_user_ref, p_email_ref, c.consent_type, c.policy_version, c.granted,
         c.created_at, 'hmac-sha256-v1'
    from public.consent_records c
   where c.user_id = p_user_id
     and not exists (
       select 1 from public.consent_archive a
        where a.user_ref = p_user_ref
          and a.consent_type = c.consent_type
          and a.policy_version = c.policy_version
          and a.granted = c.granted
          and a.granted_at = c.created_at
     );
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.archive_consent_for_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.archive_consent_for_user(uuid, text, text) to service_role;
