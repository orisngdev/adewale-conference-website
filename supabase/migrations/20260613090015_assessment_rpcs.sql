-- Assessment RPCs (all SECURITY DEFINER, granted to authenticated). The ONLY
-- function that emits correct_index is get_practice_bank, and its WHERE clause
-- requires mode='practice' — an exam UUID returns null, structurally. Exams keep
-- server-side grading. Compat wrappers keep the old (…012) names working until
-- the app rename lands; dropped in …020. Idempotent. Run after …014.

-- ── Fetch an assessment WITHOUT answers (exam taker + generic listing) ──────────
create or replace function public.get_assessment(p_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select case when a.published then jsonb_build_object(
    'id', a.id, 'title', a.title, 'mode', a.mode,
    'subject', a.subject, 'level', a.level,
    'max_attempts', a.max_attempts, 'time_limit_minutes', a.time_limit_minutes,
    'content_version', a.content_version,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options)
        order by aq.position)
      from public.assessment_questions aq
      join public.question_bank q on q.id = aq.question_id
      where aq.assessment_id = a.id), '[]'::jsonb)
  ) else null end
  from public.assessments a where a.id = p_id;
$$;
grant execute on function public.get_assessment(uuid) to authenticated;

-- ── Fetch a PRACTICE bank WITH answers + explanations (offline client marking) ─
-- Structurally locked to mode='practice'; an exam id returns null.
create or replace function public.get_practice_bank(p_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select case when a.published and a.mode = 'practice' then jsonb_build_object(
    'id', a.id, 'title', a.title, 'subject', a.subject, 'level', a.level,
    'time_limit_minutes', a.time_limit_minutes, 'content_version', a.content_version,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id, 'prompt', q.prompt, 'options', q.options,
          'correct_index', q.correct_index, 'explanation', q.explanation,
          'difficulty', q.difficulty)
        order by aq.position)
      from public.assessment_questions aq
      join public.question_bank q on q.id = aq.question_id
      where aq.assessment_id = a.id), '[]'::jsonb)
  ) else null end
  from public.assessments a where a.id = p_id;
$$;
grant execute on function public.get_practice_bank(uuid) to authenticated;

-- ── Exam attempt lifecycle (server-authoritative) ─────────────────────────────
create or replace function public.start_exam_attempt(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_limit int; v_total int; v_submitted int;
  v_attempt uuid; v_started timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select max_attempts, time_limit_minutes into v_max, v_limit
  from public.assessments where id = p_assessment_id and published;
  if v_max is null then return jsonb_build_object('error', 'unavailable'); end if;

  select id, started_at into v_attempt, v_started
  from public.assessment_attempts
  where assessment_id = p_assessment_id and student_user_id = auth.uid()
    and status = 'in_progress'
  order by started_at desc limit 1;

  if v_attempt is null then
    select count(*) into v_submitted from public.assessment_attempts
    where assessment_id = p_assessment_id and student_user_id = auth.uid()
      and status = 'submitted';
    if v_submitted >= v_max then return jsonb_build_object('error', 'no_attempts'); end if;

    select count(*) into v_total
    from public.assessment_questions where assessment_id = p_assessment_id;
    insert into public.assessment_attempts
      (assessment_id, student_user_id, status, started_at, total, mode)
    values (p_assessment_id, auth.uid(), 'in_progress', now(), v_total, 'exam')
    returning id, started_at into v_attempt, v_started;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt, 'started_at', v_started, 'time_limit_minutes', v_limit);
end;
$$;
grant execute on function public.start_exam_attempt(uuid) to authenticated;

create or replace function public.submit_exam_attempt(
  p_attempt_id uuid, p_answers jsonb, p_violations int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_assessment uuid; v_total int; v_score int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select assessment_id into v_assessment from public.assessment_attempts
  where id = p_attempt_id and student_user_id = auth.uid() and status = 'in_progress';
  if v_assessment is null then raise exception 'No active attempt'; end if;

  select count(*) into v_total
  from public.assessment_questions where assessment_id = v_assessment;
  select count(*) into v_score
  from public.assessment_questions aq
  join public.question_bank q on q.id = aq.question_id
  where aq.assessment_id = v_assessment
    and (p_answers ->> q.id::text)::int = q.correct_index;

  update public.assessment_attempts
  set answers = p_answers, score = v_score, total = v_total, status = 'submitted',
      submitted_at = now(), violations = coalesce(p_violations, 0)
  where id = p_attempt_id;

  return jsonb_build_object('score', v_score, 'total', v_total);
end;
$$;
grant execute on function public.submit_exam_attempt(uuid, jsonb, int) to authenticated;

-- ── Practice: re-grade server-side, record, idempotent for offline flush ──────
create or replace function public.submit_practice_attempt(
  p_assessment_id uuid, p_answers jsonb, p_meta jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total int; v_score int; v_client text; v_existing uuid;
  v_e_score int; v_e_total int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.assessments
                 where id = p_assessment_id and published and mode = 'practice') then
    raise exception 'Practice not available';
  end if;

  -- Idempotent flush: same client_attempt_id already recorded → return it.
  v_client := p_meta ->> 'client_attempt_id';
  if v_client is not null then
    select id, score, total into v_existing, v_e_score, v_e_total
    from public.assessment_attempts
    where student_user_id = auth.uid() and mode = 'practice'
      and meta ->> 'client_attempt_id' = v_client
    limit 1;
    if v_existing is not null then
      return jsonb_build_object('score', v_e_score, 'total', v_e_total, 'duplicate', true);
    end if;
  end if;

  select count(*) into v_total
  from public.assessment_questions where assessment_id = p_assessment_id;
  select count(*) into v_score
  from public.assessment_questions aq
  join public.question_bank q on q.id = aq.question_id
  where aq.assessment_id = p_assessment_id
    and (p_answers ->> q.id::text)::int = q.correct_index;

  insert into public.assessment_attempts
    (assessment_id, student_user_id, score, total, answers, status, mode,
     submitted_at, meta)
  values (p_assessment_id, auth.uid(), v_score, v_total, p_answers, 'submitted',
          'practice', now(), coalesce(p_meta, '{}'::jsonb));

  return jsonb_build_object('score', v_score, 'total', v_total);
end;
$$;
grant execute on function public.submit_practice_attempt(uuid, jsonb, jsonb) to authenticated;

-- ── Compat wrappers (old …012 names → new) — dropped in …020 ──────────────────
create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select public.get_assessment(p_quiz_id);
$$;
grant execute on function public.get_quiz(uuid) to authenticated;

create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select public.start_exam_attempt(p_quiz_id);
$$;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;

create or replace function public.submit_quiz_attempt(
  p_attempt_id uuid, p_answers jsonb, p_violations int
) returns jsonb language sql security definer set search_path = public as $$
  select public.submit_exam_attempt(p_attempt_id, p_answers, p_violations);
$$;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, int) to authenticated;
