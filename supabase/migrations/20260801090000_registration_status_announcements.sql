-- Manual registration status announcements. The registration open/close toggle
-- remains silent; this table records explicit admin sends and powers the
-- 24-hour duplicate-send guard.

create table if not exists public.edition_registration_announcements (
  id                uuid primary key default gen_random_uuid(),
  edition_year      int not null references public.editions(year) on delete cascade,
  registration_open boolean not null,
  sent_by           uuid references public.profiles(id) on delete set null,
  sent_at           timestamptz not null default now(),
  recipient_count   int not null default 0
);

create index if not exists edition_registration_announcements_recent_idx
  on public.edition_registration_announcements
  (edition_year, registration_open, sent_at desc);

alter table public.edition_registration_announcements enable row level security;

drop policy if exists "edition_registration_announcements_admin_read"
  on public.edition_registration_announcements;
drop policy if exists "edition_registration_announcements_admin_insert"
  on public.edition_registration_announcements;

create policy "edition_registration_announcements_admin_read"
  on public.edition_registration_announcements
  for select using (public.is_admin());

create policy "edition_registration_announcements_admin_insert"
  on public.edition_registration_announcements
  for insert with check (public.is_admin());
