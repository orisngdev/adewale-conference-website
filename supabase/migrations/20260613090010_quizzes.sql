-- Quizzes (admin-authored). Run after students. Idempotent.
-- quiz_questions hold the correct answer, so they're ADMIN-ONLY at the RLS level —
-- students will receive questions (without answers) and submit via SECURITY DEFINER
-- RPCs added in the next slice, so correct_index never reaches the browser.

create table if not exists public.quizzes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  subject      text,
  level        text,
  edition_year int,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes on delete cascade,
  prompt        text not null,
  options       jsonb not null default '[]',  -- array of option strings
  correct_index int not null default 0,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;

-- quizzes: admins manage; any signed-in user can read PUBLISHED quizzes (listing).
drop policy if exists "quizzes_admin"          on public.quizzes;
drop policy if exists "quizzes_read_published" on public.quizzes;
create policy "quizzes_admin" on public.quizzes
  for all using (public.is_admin()) with check (public.is_admin());
create policy "quizzes_read_published" on public.quizzes
  for select using (published = true or public.is_admin());

-- quiz_questions: ADMIN ONLY (the correct answer lives here).
drop policy if exists "quiz_questions_admin" on public.quiz_questions;
create policy "quiz_questions_admin" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());
