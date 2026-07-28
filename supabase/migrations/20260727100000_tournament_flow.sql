-- School-team tournament operations. Registration approval remains the entry
-- decision; these tables model what happens after a school becomes a
-- Participant. Progress is still canonical in registration_stage_results.

alter table public.registrations
  add column if not exists qualification_zone text;

alter table public.registration_stage_results
  add column if not exists reason text;

create table if not exists public.tournament_groups (
  id            uuid primary key default gen_random_uuid(),
  edition_year  int not null references public.editions(year) on delete cascade,
  stage         text not null default 'Grand Finale Group Stage',
  name          text not null,
  sort_order    int not null default 0,
  advance_count int not null default 2 check (advance_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (edition_year, stage, name)
);

create table if not exists public.tournament_group_entries (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.tournament_groups on delete cascade,
  registration_id  uuid not null references public.registrations on delete cascade,
  seed             int,
  rank             int,
  score            numeric,
  note             text,
  advance_override boolean,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (group_id, registration_id),
  unique (registration_id)
);

create table if not exists public.tournament_matches (
  id                     uuid primary key default gen_random_uuid(),
  edition_year           int not null references public.editions(year) on delete cascade,
  stage                  text not null,
  kind                   text not null default 'knockout'
                           check (kind in ('group', 'knockout', 'face_off', 'bye')),
  team_a_registration_id uuid references public.registrations on delete set null,
  team_b_registration_id uuid references public.registrations on delete set null,
  team_a_score           numeric,
  team_b_score           numeric,
  winner_registration_id uuid references public.registrations on delete set null,
  status                 text not null default 'scheduled'
                           check (status in ('scheduled', 'in_progress', 'completed', 'needs_face_off', 'cancelled')),
  scheduled_at           timestamptz,
  venue                  text,
  note                   text,
  parent_match_id        uuid references public.tournament_matches on delete set null,
  slot                   int,
  superseded_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists tournament_groups_edition_idx
  on public.tournament_groups (edition_year, stage, sort_order);
create index if not exists tournament_group_entries_group_idx
  on public.tournament_group_entries (group_id, rank, seed);
create index if not exists tournament_matches_edition_idx
  on public.tournament_matches (edition_year, stage, kind, slot);
create index if not exists tournament_matches_team_a_idx
  on public.tournament_matches (team_a_registration_id);
create index if not exists tournament_matches_team_b_idx
  on public.tournament_matches (team_b_registration_id);
create index if not exists tournament_matches_winner_idx
  on public.tournament_matches (winner_registration_id);

create table if not exists public.individual_awards (
  id            uuid primary key default gen_random_uuid(),
  edition_year  int not null references public.editions(year) on delete cascade,
  student_id    uuid not null references public.students on delete cascade,
  registration_id uuid references public.registrations on delete set null,
  stage         text,
  title         text not null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists individual_awards_student_idx
  on public.individual_awards (student_id, edition_year);

alter table public.tournament_groups enable row level security;
alter table public.tournament_group_entries enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.individual_awards enable row level security;

drop policy if exists "tournament_groups_read" on public.tournament_groups;
drop policy if exists "tournament_groups_admin_write" on public.tournament_groups;
create policy "tournament_groups_read" on public.tournament_groups for select using (
  public.is_admin()
  or exists (
    select 1
    from public.tournament_group_entries e
    join public.registrations r on r.id = e.registration_id
    where e.group_id = tournament_groups.id
      and (r.owner_id = auth.uid() or r.school_id in (select public.my_school_ids()))
  )
);
create policy "tournament_groups_admin_write" on public.tournament_groups
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tournament_group_entries_read" on public.tournament_group_entries;
drop policy if exists "tournament_group_entries_admin_write" on public.tournament_group_entries;
create policy "tournament_group_entries_read" on public.tournament_group_entries for select using (
  public.is_admin()
  or exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and (r.owner_id = auth.uid() or r.school_id in (select public.my_school_ids()))
  )
);
create policy "tournament_group_entries_admin_write" on public.tournament_group_entries
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tournament_matches_read" on public.tournament_matches;
drop policy if exists "tournament_matches_admin_write" on public.tournament_matches;
create policy "tournament_matches_read" on public.tournament_matches for select using (
  public.is_admin()
  or exists (
    select 1 from public.registrations r
    where r.id in (team_a_registration_id, team_b_registration_id, winner_registration_id)
      and (r.owner_id = auth.uid() or r.school_id in (select public.my_school_ids()))
  )
);
create policy "tournament_matches_admin_write" on public.tournament_matches
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "individual_awards_read" on public.individual_awards;
drop policy if exists "individual_awards_admin_write" on public.individual_awards;
create policy "individual_awards_read" on public.individual_awards for select using (
  public.is_admin()
  or exists (
    select 1 from public.students s
    where s.id = student_id
      and (s.auth_user_id = auth.uid() or s.school_id in (select public.my_school_ids()))
  )
);
create policy "individual_awards_admin_write" on public.individual_awards
  for all using (public.is_admin()) with check (public.is_admin());

-- New editions get the default future flow. Round of 24 stays optional and is
-- inserted by admins only when an edition needs the play-in stage.
alter table public.editions
  alter column stages set default array[
    'Registration',
    'Qualifications',
    'Grand Finale Group Stage',
    'Round of 16',
    'Quarter Finals',
    'Semi Finals',
    'Finals',
    'Completed'
  ];

update public.editions
set stages = array[
    'Registration',
    'Qualifications',
    'Grand Finale Group Stage',
    'Round of 16',
    'Quarter Finals',
    'Semi Finals',
    'Finals',
    'Completed'
  ],
  current_stage = case
    when current_stage = 'Zonal Stage' then 'Qualifications'
    when current_stage = 'Grand Finale' then 'Grand Finale Group Stage'
    else current_stage
  end
where stages = array['Registration','Zonal Stage','Grand Finale','Completed'];
