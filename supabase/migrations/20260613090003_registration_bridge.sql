-- Registration → Supabase bridge (open-decision #2: Airtable = source of truth,
-- Supabase = thin linked mirror). Run in Supabase → SQL Editor. Idempotent.

-- Link Supabase schools back to their Airtable record (when known).
alter table public.schools add column if not exists airtable_id text;
create unique index if not exists schools_airtable_id_key
  on public.schools (airtable_id) where airtable_id is not null;

-- Mirrored registrations arrive owner-less; a coordinator claims them by code.
alter table public.registrations add column if not exists contact_email text;
alter table public.registrations add column if not exists claim_code text;
create index if not exists registrations_claim_code_idx
  on public.registrations (claim_code);

-- Claim: a signed-in user redeems a code → becomes the registration's owner and
-- is promoted to coordinator. SECURITY DEFINER so it can set owner_id past RLS,
-- but it only ever acts for the calling user (auth.uid()).
create or replace function public.claim_registration(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_reg_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.registrations
  set owner_id = auth.uid()
  where claim_code = p_code and owner_id is null
  returning id into v_reg_id;

  if v_reg_id is null then
    return null;  -- unknown code or already claimed
  end if;

  update public.profiles
  set role = 'coordinator'
  where id = auth.uid() and role = 'student';

  return v_reg_id;
end;
$$;

grant execute on function public.claim_registration(text) to authenticated;
