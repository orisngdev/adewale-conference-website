-- Per-attempt review: the questions of a submitted attempt with the student's
-- choice and whether it was right. Access-controlled to the attempt's own
-- student, an admin, or a coordinator of the student's school (mirrors the
-- attempts_coordinator_read RLS). SECURITY DEFINER so it can compare answers to
-- correct_index server-side WITHOUT leaking it: PRACTICE reviews may reveal the
-- correct option + explanation (answers already ship to the device, ADR-0002),
-- but EXAM reviews return only is_correct — the correct answer never leaves the
-- server. Idempotent.
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_student uuid;
  v_answers jsonb;
  v_mode text;
  v jsonb;
begin
  if auth.uid() is null then return null; end if;

  select student_user_id, answers, mode
  into v_student, v_answers, v_mode
  from public.assessment_attempts
  where id = p_attempt_id and status = 'submitted';
  if v_student is null then return null; end if;

  -- Own attempt, admin, or coordinator of the student's school.
  if not (
    v_student = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.students s
      where s.auth_user_id = v_student
        and s.school_id in (select public.my_school_ids())
    )
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'id', at.id,
    'title', a.title,
    'subject', a.subject,
    'level', a.level,
    'mode', at.mode,
    'score', at.score,
    'total', at.total,
    'violations', at.violations,
    'submitted_at', at.submitted_at,
    'student_name', coalesce(st.name, p.full_name),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'prompt', q.prompt,
          'options', q.options,
          'choice', (v_answers ->> q.id::text)::int,
          'is_correct', (v_answers ->> q.id::text)::int = q.correct_index
        )
        || case when v_mode = 'practice'
             then jsonb_build_object('correct_index', q.correct_index, 'explanation', q.explanation)
             else '{}'::jsonb end
        order by aq.position
      )
      from public.assessment_questions aq
      join public.question_bank q on q.id = aq.question_id
      where aq.assessment_id = at.assessment_id
    ), '[]'::jsonb)
  ) into v
  from public.assessment_attempts at
  join public.assessments a on a.id = at.assessment_id
  left join public.students st on st.auth_user_id = at.student_user_id
  left join public.profiles p on p.id = at.student_user_id
  where at.id = p_attempt_id;

  return v;
end;
$$;
grant execute on function public.get_attempt_review(uuid) to authenticated;
