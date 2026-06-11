-- Role-on-signup, the smart version. Run in Supabase → SQL Editor AFTER
-- supabase-schema.sql and supabase-bridge.sql (needs registrations.contact_email).
-- This REPLACES handle_new_user from supabase-schema.sql / supabase-admins.sql —
-- it folds in the admin allowlist AND coordinator-by-email matching.
--
-- At signup a user becomes:
--   • admin       — if their email is in the allowlist below
--   • coordinator — if their email matches an unclaimed registration's contact
--   • student     — otherwise (default)
-- and any registration whose contact_email matches is auto-linked to them.
-- The claim code remains the fallback when they sign up with a different email.

-- 👉 keep this admin list in sync with docs/supabase-admins.sql
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

-- ── Backfill existing users (in case some signed up before this) ─────────────
-- Promote students whose email matches a registration contact…
update public.profiles p
set role = 'coordinator'
from public.registrations r
where r.contact_email = p.email and p.role = 'student';

-- …and link those registrations to them.
update public.registrations r
set owner_id = p.id
from public.profiles p
where r.contact_email = p.email and r.owner_id is null;
