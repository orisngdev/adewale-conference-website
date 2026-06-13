-- Exam mode: admin-set attempts + time limit, server-enforced; attempt lifecycle
-- (in_progress → submitted) + violation count (tab switches). Run after
-- quiz_attempts. Idempotent.

alter table public.quizzes add column if not exists max_attempts int not null default 1;
alter table public.quizzes add column if not exists time_limit_minutes int; -- null = untimed

alter table public.quiz_attempts add column if not exists status text not null default 'submitted';
alter table public.quiz_attempts add column if not exists started_at timestamptz;
alter table public.quiz_attempts add column if not exists submitted_at timestamptz;
alter table public.quiz_attempts add column if not exists violations int not null default 0;

-- get_quiz now also returns the (non-secret) exam settings.
create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb
language sql security definer set search_path = public stable
as $$
  select case when q.published then jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'subject', q.subject,
    'level', q.level,
    'max_attempts', q.max_attempts,
    'time_limit_minutes', q.time_limit_minutes,
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

-- Start (or resume) an attempt. Enforces the attempt limit server-side.
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_max int; v_limit int; v_total int; v_submitted int;
  v_attempt uuid; v_started timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select max_attempts, time_limit_minutes into v_max, v_limit
  from public.quizzes where id = p_quiz_id and published;
  if v_max is null then return jsonb_build_object('error', 'unavailable'); end if;

  -- Resume an in-progress attempt if one exists.
  select id, started_at into v_attempt, v_started
  from public.quiz_attempts
  where quiz_id = p_quiz_id and student_user_id = auth.uid() and status = 'in_progress'
  order by started_at desc limit 1;

  if v_attempt is null then
    select count(*) into v_submitted from public.quiz_attempts
    where quiz_id = p_quiz_id and student_user_id = auth.uid() and status = 'submitted';
    if v_submitted >= v_max then
      return jsonb_build_object('error', 'no_attempts');
    end if;
    select count(*) into v_total from public.quiz_questions where quiz_id = p_quiz_id;
    insert into public.quiz_attempts (quiz_id, student_user_id, status, started_at, total)
    values (p_quiz_id, auth.uid(), 'in_progress', now(), v_total)
    returning id, started_at into v_attempt, v_started;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'started_at', v_started,
    'time_limit_minutes', v_limit
  );
end;
$$;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;

-- Submit an in-progress attempt by id. Grades server-side, records violations.
drop function if exists public.submit_quiz_attempt(uuid, jsonb);
create or replace function public.submit_quiz_attempt(
  p_attempt_id uuid, p_answers jsonb, p_violations int
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_quiz uuid; v_total int; v_score int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select quiz_id into v_quiz from public.quiz_attempts
  where id = p_attempt_id and student_user_id = auth.uid() and status = 'in_progress';
  if v_quiz is null then raise exception 'No active attempt'; end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = v_quiz;
  select count(*) into v_score
  from public.quiz_questions qq
  where qq.quiz_id = v_quiz and (p_answers ->> qq.id::text)::int = qq.correct_index;

  update public.quiz_attempts
  set answers = p_answers, score = v_score, total = v_total,
      status = 'submitted', submitted_at = now(), violations = coalesce(p_violations, 0)
  where id = p_attempt_id;

  return jsonb_build_object('score', v_score, 'total', v_total);
end;
$$;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, int) to authenticated;
