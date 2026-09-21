-- Centre staff who mark attendance without holding a portal account.
-- Idempotent. See docs/adr/0011-attendance-is-marked-without-an-account.md.
--
-- These are Fellows (src/lib/fellows.ts), recruited per centre for one exam day.
-- Minting an auth user each would mean 40-odd accounts created and revoked in a
-- week, a profiles.role that means nothing outside that day, and a password
-- reset at 6am at a centre with no signal. They identify by email against a row
-- an admin added instead.

create table if not exists public.centre_leads (
  id                uuid primary key default gen_random_uuid(),
  edition_year      int  not null references public.editions(year),
  centre_id         uuid not null references public.exam_centres on delete cascade,
  name              text not null check (btrim(name) <> ''),
  email             text not null check (btrim(email) <> ''),
  phone             text,
  role              text not null default 'invigilator'
                      check (role in ('centre_lead','invigilator','materials_officer')),
  is_active         boolean not null default true,
  last_signed_in_at timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- Case-insensitive, so a lead who types Tunde@ cannot become a second row.
-- One person may staff two centres; they pick which at sign-in.
create unique index if not exists centre_leads_email_uniq
  on public.centre_leads (edition_year, centre_id, lower(email));

create index if not exists centre_leads_centre_idx
  on public.centre_leads (centre_id) where is_active;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Admin-only, same reasoning as exam_centres: the sign-in path runs on the
-- service-role key and scopes itself in application code.
alter table public.centre_leads enable row level security;
drop policy if exists "centre_leads_admin" on public.centre_leads;
create policy "centre_leads_admin" on public.centre_leads
  for all using (public.is_admin()) with check (public.is_admin());
