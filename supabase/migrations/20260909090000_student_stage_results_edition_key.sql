-- Repair the per-rep stage-result write path. Idempotent.
--
-- 20260822090000 dropped `unique (student_id, stage)` for
-- `(student_id, stage, edition_year)`, but three upserts in admin/actions.ts
-- still named the old key, so PostgREST emitted ON CONFLICT against a
-- constraint that no longer exists → 42P10, swallowed by `if (error) return;`.
-- advanceStudent, cascadeAdvance and markSchoolAndReps have therefore written
-- no per-rep stage result since that migration. School-level rows key on
-- `registration_id,stage`, which still exists, so the breakage stayed hidden.
--
-- The app fix names the three-column key; this makes that key safe to conflict
-- on: backfill edition_year, collapse the duplicates that exposes, and re-add
-- the constraint as NULLS NOT DISTINCT (PG15+, see config.toml) so a row with
-- no year still participates in the conflict target.

-- ── 1. backfill the year from the rep's own edition ──────────────────────────
update public.student_stage_results r
set    edition_year = s.edition_year
from   public.students s
where  s.id = r.student_id
  and  r.edition_year is null
  and  s.edition_year is not null;

-- ── 2. collapse duplicates the backfill may have created ────────────────────
-- A rep can hold both a pre-20260822090000 null-year row and a year-stamped one
-- for the same stage; filling the null collides them. Keep the most recently
-- touched. coalesce() groups nulls too, since step 3 makes NULL a key value.
with ranked as (
  select ctid,
         row_number() over (
           partition by student_id, stage, coalesce(edition_year, -1)
           order by updated_at desc nulls last, created_at desc nulls last, ctid desc
         ) as rn
  from public.student_stage_results
)
delete from public.student_stage_results t
using ranked r
where t.ctid = r.ctid and r.rn > 1;

-- ── 3. re-add the key so NULL years conflict instead of duplicating ─────────
alter table public.student_stage_results
  drop constraint if exists student_stage_results_student_id_stage_key;
alter table public.student_stage_results
  drop constraint if exists student_stage_results_student_stage_year_key;
alter table public.student_stage_results
  add  constraint student_stage_results_student_stage_year_key
  unique nulls not distinct (student_id, stage, edition_year);

-- ── 4. make the score legible ───────────────────────────────────────────────
-- `score numeric` alone is ambiguous ("84" out of what?), which is why
-- <StageResults> renders a bare unlabelled figure today.
alter table public.student_stage_results      add column if not exists score_max numeric;
alter table public.registration_stage_results add column if not exists score_max numeric;

comment on column public.student_stage_results.score_max is
  'Denominator for score where the source has one (e.g. 100 for a paper exam). Null = a bare figure.';
comment on column public.registration_stage_results.score_max is
  'Denominator for score where the source has one. Null = a bare figure.';
