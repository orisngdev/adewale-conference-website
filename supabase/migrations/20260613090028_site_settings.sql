-- Site-wide settings the admin edits from the portal (key/value). First use:
-- 'home_video_url' — a YouTube video shown on the portal home for every role.
-- Readable by any signed-in user; writable by admins only. Idempotent.

create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select to authenticated using (true);

drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
