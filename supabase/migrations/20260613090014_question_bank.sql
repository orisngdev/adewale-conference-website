-- Shared question bank + assessment_questions join. Renames quiz_questions →
-- question_bank, tags each question with a pool (mode), and moves the per-quiz
-- link into a reusable join table. A trigger keeps a question's pool equal to
-- its assessment's mode, so an exam answer can never surface via a practice
-- assessment. question_bank stays ADMIN-ONLY at the RLS level. Idempotent.
-- Run after …013_rename_assessments.sql.

-- 1. Rename quiz_questions → question_bank (guarded).
do $$ begin
  if to_regclass('public.quiz_questions') is not null
     and to_regclass('public.question_bank') is null then
    alter table public.quiz_questions rename to question_bank;
  end if;
end $$;

-- 2. New tagging columns. Existing rows keep mode='exam' (they came from quizzes).
alter table public.question_bank add column if not exists mode        text not null default 'exam';
alter table public.question_bank add column if not exists subject     text;
alter table public.question_bank add column if not exists level       text;
alter table public.question_bank add column if not exists topic       text;
alter table public.question_bank add column if not exists difficulty  text;
alter table public.question_bank add column if not exists explanation text;
alter table public.question_bank add column if not exists tags        text[] not null default '{}';
alter table public.question_bank add column if not exists edition_year int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'question_bank_mode_chk') then
    alter table public.question_bank
      add constraint question_bank_mode_chk check (mode in ('practice','exam'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'question_bank_difficulty_chk') then
    alter table public.question_bank
      add constraint question_bank_difficulty_chk
      check (difficulty is null or difficulty in ('easy','medium','hard'));
  end if;
end $$;
create index if not exists question_bank_pool_idx
  on public.question_bank (mode, subject, level);

-- 3. Join table: which questions belong to which assessment, and in what order.
create table if not exists public.assessment_questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments  on delete cascade,
  question_id   uuid not null references public.question_bank on delete cascade,
  position      int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (assessment_id, question_id)
);
create index if not exists assessment_questions_assessment_idx
  on public.assessment_questions (assessment_id, position);
create index if not exists assessment_questions_question_idx
  on public.assessment_questions (question_id);

-- 4. Backfill the join from the legacy per-question quiz_id, then drop that column.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'question_bank'
               and column_name = 'quiz_id') then
    insert into public.assessment_questions (assessment_id, question_id, position)
    select quiz_id, id, coalesce(position, 0)
    from public.question_bank
    where quiz_id is not null
    on conflict (assessment_id, question_id) do nothing;

    alter table public.question_bank drop column quiz_id;
  end if;
end $$;

-- 5. RLS: question_bank + assessment_questions are ADMIN-ONLY (they hold the
--    correct answers). Students reach practice questions only via get_practice_bank.
alter table public.question_bank        enable row level security;
alter table public.assessment_questions enable row level security;
drop policy if exists "quiz_questions_admin"       on public.question_bank;
drop policy if exists "question_bank_admin"        on public.question_bank;
drop policy if exists "assessment_questions_admin" on public.assessment_questions;
create policy "question_bank_admin" on public.question_bank
  for all using (public.is_admin()) with check (public.is_admin());
create policy "assessment_questions_admin" on public.assessment_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- 6. Pool-consistency trigger: a question's mode must equal its assessment's mode.
create or replace function public.enforce_aq_mode_match()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select mode from public.question_bank where id = new.question_id)
     is distinct from
     (select mode from public.assessments where id = new.assessment_id) then
    raise exception 'question pool (mode) must equal the assessment mode';
  end if;
  return new;
end $$;
drop trigger if exists aq_mode_guard on public.assessment_questions;
create trigger aq_mode_guard before insert or update on public.assessment_questions
  for each row execute function public.enforce_aq_mode_match();
