-- The principal is an educator too: the public form stages school_members rows
-- for BOTH the coordinating teacher and the principal (see portal-registration),
-- and signup now recognises a school membership as grounds for the coordinator
-- role — so a principal signing up with their own email lands as an educator
-- with access to their school, no claim/activation needed.
-- REPLACES handle_new_user from …004 (same body + the membership clause).
-- 👉 keep the admin list in sync with …002/…004. Idempotent. Run after …025.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  admin_emails text[] := array[
    'oris@joinoris.com',
    'destinyerhabor6@gmail.com',
    'adewaleconference@gmail.com'
  ];
  v_role user_role := 'student';
begin
  if new.email = any(admin_emails) then
    v_role := 'admin';
  elsif exists (
    select 1 from public.registrations
    where contact_email = new.email and owner_id is null
  ) or exists (
    -- Staged as a school educator (teacher or principal) by a registration.
    select 1 from public.school_members
    where lower(email) = lower(new.email)
  ) then
    v_role := 'coordinator';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role);

  -- Auto-link any unclaimed registrations that match their email.
  update public.registrations
  set owner_id = new.id
  where contact_email = new.email and owner_id is null;

  return new;
end;
$$;

-- ── Backfill: principals (or any staged member) who signed up before this ────
update public.profiles p
set role = 'coordinator'
from public.school_members sm
where lower(sm.email) = lower(p.email) and p.role = 'student';

-- Link memberships to their profiles where the email already has an account.
update public.school_members sm
set profile_id = p.id
from public.profiles p
where lower(sm.email) = lower(p.email) and sm.profile_id is null;
