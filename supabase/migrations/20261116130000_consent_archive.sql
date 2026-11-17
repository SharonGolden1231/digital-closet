-- Keeps proof of consent after an account is deleted.
-- Only what is needed to prove "this person accepted this text version on this
-- date": hashed user id and hashed email (so a dispute can be matched by the
-- person's own email, but the table holds no readable identity), the consent
-- type, the text version, the decision and its date. Nothing else.
-- Retention period: to be set with the lawyer (none is enforced yet).
-- Apply to DEV first. Never apply to production before the preview test passes.

create table if not exists public.consent_archive (
  id bigint generated always as identity primary key,
  user_ref text not null,          -- sha256 of the user id
  email_ref text,                  -- sha256 of the lowercase email
  consent_type text not null,
  policy_version text not null,
  granted boolean not null,
  granted_at timestamptz not null, -- when the user made the choice
  archived_at timestamptz not null default now()
);
create index if not exists consent_archive_user_ref_idx on public.consent_archive (user_ref);
create index if not exists consent_archive_email_ref_idx on public.consent_archive (email_ref);

alter table public.consent_archive enable row level security;
revoke all on public.consent_archive from anon, authenticated;

-- Copies a user's consent rows into the archive. Safe to run twice: rows
-- already archived for the same user, type, version, decision and date are
-- skipped. Returns how many rows were added.
create or replace function public.archive_consent_for_user(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uref text := encode(sha256(convert_to(p_user_id::text, 'utf8')), 'hex');
  eref text;
  added int;
begin
  select encode(sha256(convert_to(lower(btrim(email)), 'utf8')), 'hex')
    into eref from auth.users where id = p_user_id;

  insert into public.consent_archive
    (user_ref, email_ref, consent_type, policy_version, granted, granted_at)
  select uref, eref, c.consent_type, c.policy_version, c.granted, c.created_at
    from public.consent_records c
   where c.user_id = p_user_id
     and not exists (
       select 1 from public.consent_archive a
        where a.user_ref = uref
          and a.consent_type = c.consent_type
          and a.policy_version = c.policy_version
          and a.granted = c.granted
          and a.granted_at = c.created_at
     );
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.archive_consent_for_user(uuid) from public, anon, authenticated;
grant execute on function public.archive_consent_for_user(uuid) to service_role;
