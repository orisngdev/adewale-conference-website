-- The venues a zonal exam is actually sat at, as rows rather than as a string.
-- Idempotent.
--
-- registrations.qualification_zone stores the eight TOWN names in
-- ZONAL_FINALS_OPTIONS, while 2026 runs at ten venues named by school. Rather
-- than repoint the stored values (src/lib/forms.ts warns that every past
-- allocation would read as unallocated), `legacy_zone` carries the mapping:
-- eight venues claim their town, Iko Gateway claims Idiroko's, and Arigbajo and
-- Imeko are new for 2026 and claim nothing — no existing allocation can reach
-- them, so schools sitting there need exam_centre_id set by hand.

create table if not exists public.exam_centres (
  id           uuid primary key default gen_random_uuid(),
  edition_year int  not null references public.editions(year),
  -- The host school, and the town, because three school names repeat across
  -- towns. Together they are how a centre is named to a human.
  name         text not null check (btrim(name) <> ''),
  town         text not null check (btrim(town) <> ''),
  legacy_zone  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (edition_year, name, town)
);

-- One venue per legacy zone, or the school→centre lookup is ambiguous.
create unique index if not exists exam_centres_legacy_zone_uniq
  on public.exam_centres (edition_year, legacy_zone)
  where legacy_zone is not null;

create index if not exists exam_centres_edition_idx
  on public.exam_centres (edition_year) where is_active;

-- Allocation by id, which is the only way to reach Arigbajo and Imeko. Read
-- ahead of qualification_zone; nothing but attendance writes it yet.
alter table public.registrations
  add column if not exists exam_centre_id uuid references public.exam_centres;
create index if not exists registrations_exam_centre_idx
  on public.registrations (exam_centre_id) where exam_centre_id is not null;

-- ── the ten 2026 venues ─────────────────────────────────────────────────────
-- Mirrors ZONAL_CENTRES_2026 in src/lib/forms.ts. Skipped entirely when the
-- 2026 edition row is absent, so this is safe on a fresh database.
insert into public.exam_centres (edition_year, name, town, legacy_zone)
select 2026, v.name, v.town, v.legacy_zone
from (values
  ('Abeokuta Grammar School',                    'Abeokuta',  'Abeokuta'),
  ('Ansar Ud Deen Comprehensive Senior College', 'Ota',       'Ota'),
  ('Pakoto High School',                         'Ifo',       'Ifo'),
  ('Iko Gateway Grammar School',                 'Iko',       'Idiroko'),
  ('Methodist High School',                      'Arigbajo',  null),
  ('Comprehensive High School',                  'Ayetoro',   'Ayetoro'),
  ('Yewa (Egbado) College, Senior',              'Ilaro',     'Ilaro'),
  ('Nazareth High School',                       'Imeko',     null),
  ('Methodist Comprehensive College, Senior',    'Sagamu',    'Sagamu'),
  ('Adeola Odutola College',                     'Ijebu Ode', 'Ijebu Ode')
) as v(name, town, legacy_zone)
where exists (select 1 from public.editions where year = 2026)
on conflict (edition_year, name, town) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Admin-only. The centre-lead pages have no auth user and reach this through
-- the service-role key, so there is no anon policy to get wrong.
alter table public.exam_centres enable row level security;
drop policy if exists "exam_centres_admin" on public.exam_centres;
create policy "exam_centres_admin" on public.exam_centres
  for all using (public.is_admin()) with check (public.is_admin());
