-- Rename the CBT domain: quizzes → assessments, quiz_attempts → assessment_attempts.
-- Adds mode ('practice'|'exam'), content_version (offline cache-bust), and per-attempt
-- mode + meta. In-place rename preserves rows, FKs, indexes, RLS policies, and grants.
-- Idempotent. Run after quiz_exam_mode.sql (…012).

-- 1. Rename tables (guarded so both a fresh apply and a re-run are safe).
do $$ begin
  if to_regclass('public.quizzes') is not null
     and to_regclass('public.assessments') is null then
    alter table public.quizzes rename to assessments;
  end if;
  if to_regclass('public.quiz_attempts') is not null
     and to_regclass('public.assessment_attempts') is null then
    alter table public.quiz_attempts rename to assessment_attempts;
  end if;
end $$;

-- 2. Rename the FK column quiz_id → assessment_id on attempts.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'assessment_attempts'
               and column_name = 'quiz_id') then
    alter table public.assessment_attempts rename column quiz_id to assessment_id;
  end if;
end $$;

-- 3. New columns.
alter table public.assessments add column if not exists mode text not null default 'exam';
alter table public.assessments add column if not exists content_version int not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assessments_mode_chk') then
    alter table public.assessments
      add constraint assessments_mode_chk check (mode in ('practice','exam'));
  end if;
end $$;

alter table public.assessment_attempts add column if not exists mode text not null default 'exam';
alter table public.assessment_attempts add column if not exists meta jsonb not null default '{}';

-- 4. Rename policies for clarity (SELECT policies OR together; writes go through
--    SECURITY DEFINER RPCs, so attempts keep only read policies).
alter table public.assessments enable row level security;
drop policy if exists "quizzes_admin"              on public.assessments;
drop policy if exists "quizzes_read_published"     on public.assessments;
drop policy if exists "assessments_admin"          on public.assessments;
drop policy if exists "assessments_read_published" on public.assessments;
create policy "assessments_admin" on public.assessments
  for all using (public.is_admin()) with check (public.is_admin());
create policy "assessments_read_published" on public.assessments
  for select using (published = true or public.is_admin());

alter table public.assessment_attempts enable row level security;
drop policy if exists "attempts_self_read"        on public.assessment_attempts;
drop policy if exists "attempts_coordinator_read" on public.assessment_attempts;
create policy "attempts_self_read" on public.assessment_attempts for select using (
  student_user_id = auth.uid() or public.is_admin()
);
create policy "attempts_coordinator_read" on public.assessment_attempts for select using (
  student_user_id in (
    select auth_user_id from public.students
    where school_id in (select public.my_school_ids())
  )
);
