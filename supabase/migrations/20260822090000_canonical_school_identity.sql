-- Canonical school identity. Adopts the ASC-XXXXXX School ID from the reconciled
-- 2022-2026 registration workbook as the stable natural key for a school, and adds
-- the columns the zonal finals results need. Run before scripts/canonical/*.
--
-- The schools table has no unique key on any natural column today, and five separate
-- code paths each find-or-create with a different normalizer, so 741 rows describe
-- 534 real schools. school_code fixes identity; school_norm_name is the single
-- normalizer every path will share.
--
-- The unique index on school_norm_name(name) is deliberately NOT here: it cannot be
-- created while the duplicates exist. It lands in a follow-up migration once
-- scripts/canonical/merge-schools.mjs has been applied — its successful creation is
-- the proof the merge is complete. Idempotent.

-- ── schools: canonical identity ──────────────────────────────────────────────
alter table public.schools
  add column if not exists school_code      text,
  add column if not exists exclusion_reason text,
  add column if not exists updated_at       timestamptz not null default now();

comment on column public.schools.school_code is
  'Canonical ASC-XXXXXX School ID from the reconciled registration workbook. Null means the row is not a canonical school — see exclusion_reason.';
comment on column public.schools.exclusion_reason is
  'Why this row carries no school_code, in the cleanup workbook''s own vocabulary: "Unresolved - junk entry", "Excluded - demo record", "Test record", "Sat exam, never registered".';

alter table public.schools drop constraint if exists schools_school_code_unique;
alter table public.schools add  constraint schools_school_code_unique unique (school_code);

-- ── the one normalizer ───────────────────────────────────────────────────────
-- Character-for-character equal to normalizeSchoolName() in src/lib/school-identity.ts
-- and scripts/canonical/lib.mjs. Marked immutable so it can be indexed.
create or replace function public.school_norm_name(p text)
returns text
language sql
immutable
strict
as $$
  select btrim(regexp_replace(lower(replace(p, '&', ' and ')), '[^a-z0-9]+', ' ', 'g'))
$$;

-- ── merge audit trail ────────────────────────────────────────────────────────
-- One row per absorbed school, so a merge can always be explained after the fact
-- and the absorbed airtable_id is not lost.
create table if not exists public.school_merges (
  id                   uuid primary key default gen_random_uuid(),
  survivor_id          uuid not null references public.schools on delete cascade,
  school_code          text,
  absorbed_id          uuid not null,
  absorbed_name        text not null,
  absorbed_lga         text,
  absorbed_category    text,
  absorbed_airtable_id text,
  moved_registrations  int not null default 0,
  moved_members        int not null default 0,
  dropped_members      int not null default 0,
  moved_students       int not null default 0,
  deactivated_students int not null default 0,
  moved_other          jsonb,
  note                 text,
  merged_at            timestamptz not null default now()
);
create index if not exists school_merges_survivor_idx on public.school_merges (survivor_id);
create index if not exists school_merges_absorbed_idx on public.school_merges (absorbed_id);

alter table public.school_merges enable row level security;
drop policy if exists "school_merges_read"        on public.school_merges;
drop policy if exists "school_merges_admin_write" on public.school_merges;
-- Read-only for admins; writes come from the service-role merge script.
create policy "school_merges_read" on public.school_merges
  for select using (public.is_admin());
create policy "school_merges_admin_write" on public.school_merges
  for all using (public.is_admin()) with check (public.is_admin());

-- ── richer result shape for the zonal finals import ──────────────────────────
-- School totals in the workbook carry a rank within the LGA and within the state,
-- and a qualification route normalised across the four years' differing wording.
alter table public.registration_stage_results
  add column if not exists lga_rank           int,
  add column if not exists state_rank         int,
  add column if not exists qualification_type text;

-- Student results span four editions, but students_active_name_uniq allows a school
-- only ONE active row per student name — so a student who sat in two years has one
-- active row plus deactivated ones, and results must be keyed by year to coexist.
alter table public.student_stage_results
  add column if not exists edition_year int,
  add column if not exists breakdown    jsonb;

comment on column public.student_stage_results.breakdown is
  'Per-subject scores where the source has them. Only 2022 does: Mathematics, General Knowledge, Biology, Chemistry, Physics, Computer.';

alter table public.student_stage_results
  drop constraint if exists student_stage_results_student_id_stage_key;
alter table public.student_stage_results
  drop constraint if exists student_stage_results_student_stage_year_key;
alter table public.student_stage_results
  add  constraint student_stage_results_student_stage_year_key
  unique (student_id, stage, edition_year);

alter table public.students
  add column if not exists exam_id text;

comment on column public.students.exam_id is
  'Exam number as printed on the zonal finals result sheet for the student''s edition.';

-- ── canonical registration key ───────────────────────────────────────────────
-- airtable_id already carries three unrelated formats (rec…, sheet:asc-history:…,
-- null), so canonical re-imports get their own idempotency key: asc-reg:<year>:<row>.
alter table public.registrations
  add column if not exists source_key text;

alter table public.registrations drop constraint if exists registrations_source_key_unique;
alter table public.registrations add  constraint registrations_source_key_unique unique (source_key);
