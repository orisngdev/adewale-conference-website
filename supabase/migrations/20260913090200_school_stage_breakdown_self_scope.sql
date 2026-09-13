-- Narrow the rep list for a student: their own line only.
--
-- 20260913090100 returned every rep of the school to every rep of the school.
-- A coordinator is responsible for the team and sees all of it; a student is
-- not, and their schoolmates' individual scores are not theirs to read. The
-- school's own score, rank and outcome stay visible to both — that number is
-- already published to the school.
--
-- `scope` says which of the two the caller got, so the page can explain why it
-- is showing one line rather than looking broken. Idempotent.
create or replace function public.get_school_stage_breakdown(
  p_registration_id uuid, p_stage text
)
returns jsonb
language plpgsql security definer set search_path = public stable
as $$
declare
  v_school    uuid;
  v_edition   int;
  v_name      text;
  v_centre    text;
  v_is_member boolean;
  v_is_rep    boolean;
  v_stage     jsonb;
  v_reps      jsonb;
  v_subjects  jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select r.school_id, r.edition_year, sc.name, r.qualification_zone
    into v_school, v_edition, v_name, v_centre
  from public.registrations r
  join public.schools sc on sc.id = r.school_id
  where r.id = p_registration_id;
  if v_school is null then
    return null;
  end if;

  -- Approved coordinator or teacher: the whole team.
  select exists (
    select 1 from public.my_school_ids() id where id = v_school
  ) into v_is_member;

  -- A rep of this school in ANY edition, so a past rep can still open their
  -- school's earlier record — they simply have no line in a year they did not
  -- sit.
  select exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid() and s.school_id = v_school
  ) into v_is_rep;

  if not v_is_member and not v_is_rep then
    return null;
  end if;

  select to_jsonb(x) into v_stage
  from (
    select sr.stage, sr.outcome, sr.score, sr.score_max,
           sr.lga_rank, sr.state_rank, sr.reason, sr.note
    from public.registration_stage_results sr
    where sr.registration_id = p_registration_id and sr.stage = p_stage
  ) x;

  select to_jsonb(e.subjects) into v_subjects
  from public.paper_exams e
  where e.edition_year = v_edition and e.stage = p_stage
  order by e.created_at desc
  limit 1;

  select coalesce(jsonb_agg(r order by (r ->> 'score')::numeric desc nulls last), '[]'::jsonb)
  into v_reps
  from (
    select jsonb_build_object(
             'student_id', s.id,
             'name',       s.name,
             'level',      s.level,
             'exam_no',    s.exam_id,
             'outcome',    ssr.outcome,
             'score',      ssr.score,
             'score_max',  ssr.score_max,
             'breakdown',  ssr.breakdown,
             'paper_id',   p.id
           ) as r
    from public.students s
    left join public.student_stage_results ssr
      on ssr.student_id = s.id
     and ssr.stage = p_stage
     and ssr.edition_year = v_edition
    left join public.paper_exam_papers p
      on p.student_id = s.id
     and p.status = 'matched'
     and p.exam_id in (
       select e.id from public.paper_exams e
       where e.edition_year = v_edition and e.stage = p_stage
     )
    where s.school_id = v_school
      and s.edition_year = v_edition
      and s.deactivated_at is null
      and (v_is_member or s.auth_user_id = auth.uid())
  ) reps;

  return jsonb_build_object(
    'registration_id', p_registration_id,
    'school_name',     v_name,
    'edition_year',    v_edition,
    'centre',          v_centre,
    'stage',           p_stage,
    'scope',           case when v_is_member then 'school' else 'self' end,
    'result',          v_stage,
    'subjects',        coalesce(v_subjects, 'null'::jsonb),
    'reps',            v_reps
  );
end $$;

revoke all on function public.get_school_stage_breakdown(uuid, text) from public, anon;
grant execute on function public.get_school_stage_breakdown(uuid, text) to authenticated;
