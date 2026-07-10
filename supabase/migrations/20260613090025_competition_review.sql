-- Competition review at close of registration (registration-onboarding plan,
-- Phase 5): adds the 'declined' status (admin bulk approve/decline) and gates
-- GRADED EXAM starts on the school's entry being accepted. Portal/prep access is
-- never gated — practice, tech lab, plans, resources all stay open. Idempotent.
-- Run after …024.

-- ── 'declined' joins the status set ──────────────────────────────────────────
alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('submitted', 'verified', 'qualified', 'finalist', 'declined'));

-- ── Exam gate ─────────────────────────────────────────────────────────────────
-- A provisioned student's school must have an ACCEPTED entry (verified/qualified/
-- finalist) for the student's edition before graded exams open. Deliberately
-- fail-open when there is no students row (legacy/self-signup accounts) or no
-- registration row for that edition (e.g. enrichment use outside the competition):
-- the gate targets the real cohort — provisioned students of registered schools.
create or replace function public.start_exam_attempt(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_limit int; v_total int; v_submitted int;
  v_attempt uuid; v_started timestamptz;
  v_school uuid; v_edition int; v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- Competition gate (see header comment).
  select school_id, edition_year into v_school, v_edition
  from public.students where auth_user_id = auth.uid() limit 1;
  if v_school is not null and v_edition is not null then
    select status into v_status from public.registrations
    where school_id = v_school and edition_year = v_edition
    order by created_at desc limit 1;
    if v_status = 'declined' then
      return jsonb_build_object('error', 'not_accepted');
    elsif v_status = 'submitted' then
      return jsonb_build_object('error', 'under_review');
    end if;
  end if;

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
