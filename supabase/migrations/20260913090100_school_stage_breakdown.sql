-- What a school's score at one stage is actually made of: each rep, what they
-- scored, and their per-subject breakdown. Idempotent.
--
-- A school's score is a team total (sum of its reps under the exam's rule), so
-- its parts are team information — every rep of that school and its approved
-- coordinators can read them, and nobody else. Same two ways of belonging as
-- get_my_school_results(), and the same reason for being an RPC: a code-login
-- student is not a school_member, and student_stage_results_read only ever lets
-- a student see their own row.
create or replace function public.get_school_stage_breakdown(
  p_registration_id uuid, p_stage text
)
returns jsonb
language plpgsql security definer set search_path = public stable
as $$
declare
  v_school   uuid;
  v_edition  int;
  v_name     text;
  v_centre   text;
  v_mine     boolean;
  v_stage    jsonb;
  v_reps     jsonb;
  v_subjects jsonb;
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

  select exists (
    select 1 from public.my_school_ids() id where id = v_school
    union all
    select 1 from public.students s
    where s.auth_user_id = auth.uid() and s.school_id = v_school
  ) into v_mine;
  if not v_mine then
    return null;
  end if;

  select to_jsonb(x) into v_stage
  from (
    select sr.stage, sr.outcome, sr.score, sr.score_max,
           sr.lga_rank, sr.state_rank, sr.reason, sr.note
    from public.registration_stage_results sr
    where sr.registration_id = p_registration_id and sr.stage = p_stage
  ) x;

  -- The exam's own subject order, so the breakdown reads the same here as it
  -- does on the rep's paper.
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
  ) reps;

  return jsonb_build_object(
    'registration_id', p_registration_id,
    'school_name',     v_name,
    'edition_year',    v_edition,
    'centre',          v_centre,
    'stage',           p_stage,
    'result',          v_stage,
    'subjects',        coalesce(v_subjects, 'null'::jsonb),
    'reps',            v_reps
  );
end $$;

revoke all on function public.get_school_stage_breakdown(uuid, text) from public, anon;
grant execute on function public.get_school_stage_breakdown(uuid, text) to authenticated;
