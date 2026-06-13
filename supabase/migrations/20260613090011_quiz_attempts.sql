-- Quiz attempts + the student-facing RPCs. Run after quizzes. Idempotent.
-- Students never read quiz_questions directly (correct answers); they fetch
-- questions via get_quiz (answers stripped) and grade via submit_quiz_attempt.

create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes on delete cascade,
  student_user_id uuid not null references auth.users on delete cascade,
  score           int not null default 0,
  total           int not null default 0,
  answers         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists quiz_attempts_student_idx on public.quiz_attempts (student_user_id, quiz_id);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);

alter table public.quiz_attempts enable row level security;
drop policy if exists "attempts_self_read"        on public.quiz_attempts;
drop policy if exists "attempts_coordinator_read" on public.quiz_attempts;
-- Student reads own attempts; admins all.
create policy "attempts_self_read" on public.quiz_attempts for select using (
  student_user_id = auth.uid() or public.is_admin()
);
-- Coordinators read attempts of students in their school(s).
create policy "attempts_coordinator_read" on public.quiz_attempts for select using (
  student_user_id in (
    select auth_user_id from public.students
    where school_id in (select public.my_school_ids())
  )
);

-- Fetch a published quiz WITHOUT correct answers.
create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb
language sql security definer set search_path = public stable
as $$
  select case when q.published then jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'subject', q.subject,
    'level', q.level,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', qq.id, 'prompt', qq.prompt, 'options', qq.options)
        order by qq.position
      )
      from public.quiz_questions qq where qq.quiz_id = q.id
    ), '[]'::jsonb)
  ) else null end
  from public.quizzes q where q.id = p_quiz_id;
$$;
grant execute on function public.get_quiz(uuid) to authenticated;

-- Grade an attempt server-side (answers = {question_id: option_index}) and record it.
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_total int;
  v_score int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.quizzes where id = p_quiz_id and published) then
    raise exception 'Quiz not available';
  end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = p_quiz_id;
  select count(*) into v_score
  from public.quiz_questions qq
  where qq.quiz_id = p_quiz_id
    and (p_answers ->> qq.id::text)::int = qq.correct_index;

  insert into public.quiz_attempts (quiz_id, student_user_id, score, total, answers)
  values (p_quiz_id, auth.uid(), v_score, v_total, p_answers);

  return jsonb_build_object('score', v_score, 'total', v_total);
end;
$$;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
