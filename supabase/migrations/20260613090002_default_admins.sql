-- Default admins. Run in Supabase → SQL Editor (after supabase-schema.sql).
-- Any email in ADMIN_EMAILS becomes an admin automatically on first sign-in,
-- and any already-registered profile with that email is upgraded immediately.
--
-- 👉 EDIT the email list below to your real admins, then run the whole file.

-- 1. Re-create the signup trigger so listed emails get the 'admin' role.
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
    -- add more admin emails here
  ];
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    case when new.email = any(admin_emails) then 'admin'::user_role
         else 'student'::user_role end
  );
  return new;
end;
$$;

-- 2. Backfill: upgrade any admin emails that already signed up.
update public.profiles
set role = 'admin'
where email in (
  'oris@joinoris.com',
  'destinyerhabor6@gmail.com',
  'adewaleconference@gmail.com'
  -- keep this list in sync with the array above
);
