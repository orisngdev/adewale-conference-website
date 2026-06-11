-- Lets admins change any profile's role (powers the admin → Users page).
-- Run once in Supabase → SQL Editor. Already included in supabase-schema.sql.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
