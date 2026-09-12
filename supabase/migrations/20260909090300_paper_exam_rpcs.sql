-- Paper-exam RPCs: grade, publish, rank, cut, and the one read path that emits
-- per-item detail. Idempotent.
--
-- Every function here is SECURITY DEFINER (it must cross RLS to read the key or
-- write another user's rows), so each one carries its own module guard — these
-- are reachable at /rest/v1/rpc/ with any authenticated admin token, and the
-- app-layer requireManage() check does not protect that path. Precedent:
-- 20260822091000_module_permission_guards.sql.

-- ── grading ─────────────────────────────────────────────────────────────────
-- The single definition of "what this paper scored". Grading is ALWAYS ours:
-- the capture tool's own total is imported only to be cross-checked. Kept as a
-- function (not inlined into the commit) so a key correction can re-grade every
-- affected paper without a second implementation.
--
-- responses: JSON array, index 0 = item 1; 'A'..'D', null for blank, '?' for an
-- unreadable or multi mark. Neither null nor '?' can ever be correct.
create or replace function public.grade_paper(
  p_exam_id uuid, p_version char(1), p_responses jsonb
)
returns jsonb
language sql security definer set search_path = public stable
as $$
  with scored as (
    select i.subject,
           nullif(p_responses ->> (i.position - 1), '') as choice,
           i.correct
    from public.paper_exam_items i
    where i.exam_id = p_exam_id and i.version = p_version
  ), flags as (
    select subject,
           (choice = correct)                        as is_correct,
           (choice is not null and choice <> '?')    as is_attempted,
           (choice = '?')                            as is_invalid
    from scored
  )
  select jsonb_build_object(
    'total',     coalesce(sum(case when is_correct   then 1 else 0 end), 0),
    'out_of',    count(*),
    'attempted', coalesce(sum(case when is_attempted then 1 else 0 end), 0),
    'invalid',   coalesce(sum(case when is_invalid   then 1 else 0 end), 0),
    'subscores', coalesce((
      select jsonb_object_agg(g.subject,
               jsonb_build_object('correct', g.c, 'out_of', g.o))
      from (
        select subject,
               sum(case when is_correct then 1 else 0 end) as c,
               count(*)                                    as o
        from flags group by subject
      ) g
    ), '{}'::jsonb)
  )
  from flags;
$$;
grant execute on function public.grade_paper(uuid, char, jsonb) to authenticated;

-- ── publish an import ───────────────────────────────────────────────────────
create or replace function public.commit_paper_import(p_import_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_exam       uuid;
  v_edition    int;
  v_stage      text;
  v_item_count int;
  v_pending    int;
  v_published  int := 0;
begin
  if not public.has_module_manage('participants') then
    raise exception 'Not permitted';
  end if;

  select i.exam_id, e.edition_year, e.stage, e.item_count
    into v_exam, v_edition, v_stage, v_item_count
  from public.paper_exam_imports i
  join public.paper_exams e on e.id = i.exam_id
  where i.id = p_import_id;
  if v_exam is null then
    raise exception 'paper exam import % does not exist', p_import_id;
  end if;

  -- Never a silent drop: every staged row must be matched, resolved, or
  -- explicitly discarded before anything is published.
  select count(*) into v_pending
  from public.paper_exam_papers
  where import_id = p_import_id
    and status in ('unmatched', 'ambiguous', 'duplicate');
  if v_pending > 0 then
    return jsonb_build_object('published', 0, 'pending', v_pending, 'error', 'undecided_rows');
  end if;

  -- Re-grade from the captured responses. The staged total is not trusted: the
  -- key may have been corrected between staging and commit.
  update public.paper_exam_papers p
  set    total         = (x.res ->> 'total')::int,
         attempted     = (x.res ->> 'attempted')::int,
         invalid_marks = (x.res ->> 'invalid')::int,
         subscores     = x.res -> 'subscores',
         updated_at    = now()
  from (
    select id as pid, public.grade_paper(exam_id, version, responses) as res
    from public.paper_exam_papers
    where import_id = p_import_id and status = 'matched'
  ) x
  where p.id = x.pid;

  -- Publish into the competition record. `outcome` is set only on INSERT: a
  -- re-import that corrects a score must not silently un-decide a rep an admin
  -- has already advanced or eliminated.
  with pub as (
    insert into public.student_stage_results
      (student_id, stage, edition_year, outcome, score, score_max, breakdown, updated_at)
    select p.student_id, v_stage, v_edition, 'pending',
           p.total, v_item_count, p.subscores, now()
    from public.paper_exam_papers p
    where p.import_id = p_import_id
      and p.status = 'matched'
      and p.student_id is not null
    on conflict (student_id, stage, edition_year) do update
      set score      = excluded.score,
          score_max  = excluded.score_max,
          breakdown  = excluded.breakdown,
          updated_at = excluded.updated_at
    returning 1
  )
  select count(*)::int into v_published from pub;

  update public.paper_exam_imports
  set    status = 'committed',
         committed_at = now(),
         matched_count = (
           select count(*) from public.paper_exam_papers
           where import_id = p_import_id and status = 'matched'),
         undecided_count = 0
  where  id = p_import_id;

  update public.paper_exams
  set    status = 'grading', updated_at = now()
  where  id = v_exam and status in ('draft', 'printed');

  return jsonb_build_object('published', v_published, 'pending', 0);
end $$;
revoke all on function public.commit_paper_import(uuid) from public, anon;
grant execute on function public.commit_paper_import(uuid) to authenticated;

-- ── ranking input ───────────────────────────────────────────────────────────
-- Returns the joined facts and nothing more: aggregation, ranking and the
-- cutoff are pure functions in src/lib/paper-exam.ts so they are unit-tested
-- and the operator can preview them before anything is written.
create or replace function public.get_paper_ranking(p_exam_id uuid)
returns jsonb
language sql security definer set search_path = public stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'paper_id',        p.id,
    'student_id',      p.student_id,
    'student_name',    s.name,
    'exam_no',         c.exam_no,
    'school_id',       s.school_id,
    'school_name',     sc.name,
    'lga',             sc.lga,
    'registration_id', r.id,
    'centre',          nullif(btrim(r.qualification_zone), ''),
    'total',           p.total,
    'out_of',          e.item_count,
    'subscores',       p.subscores
  ) order by p.total desc nulls last, s.name), '[]'::jsonb)
  from public.paper_exam_papers p
  join public.paper_exams e on e.id = p.exam_id
  join public.students s    on s.id = p.student_id
  left join public.schools sc on sc.id = s.school_id
  left join public.paper_exam_candidates c
         on c.exam_id = p.exam_id and c.student_id = p.student_id
  left join public.registrations r
         on r.school_id = s.school_id and r.edition_year = e.edition_year
  where p.exam_id = p_exam_id
    and p.status = 'matched'
    and public.has_module_view('participants');
$$;
grant execute on function public.get_paper_ranking(uuid) to authenticated;

-- ── commit the cutoff ───────────────────────────────────────────────────────
-- p_rows: [{ registration_id, outcome, score, score_max, reason,
--            lga_rank, state_rank, note }]
-- Note there is no `state` column on schools — the programme is single-state —
-- so state_rank carries the OVERALL rank and lga_rank the rank within lga.
create or replace function public.commit_paper_cut(p_exam_id uuid, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_edition int;
  v_stage   text;
  v_schools int := 0;
  v_reps    int := 0;
begin
  if not public.has_module_manage('participants') then
    raise exception 'Not permitted';
  end if;

  select edition_year, stage into v_edition, v_stage
  from public.paper_exams where id = p_exam_id;
  if v_edition is null then
    raise exception 'paper exam % does not exist', p_exam_id;
  end if;

  with v as (
    select * from jsonb_to_recordset(p_rows) as x(
      registration_id uuid, outcome text, score numeric, score_max numeric,
      reason text, lga_rank int, state_rank int, note text)
  ), upd as (
    insert into public.registration_stage_results
      (registration_id, stage, outcome, score, score_max, reason,
       qualification_type, lga_rank, state_rank, note, updated_at)
    select v.registration_id, v_stage, v.outcome, v.score, v.score_max, v.reason,
           v.reason, v.lga_rank, v.state_rank, v.note, now()
    from v
    where v.registration_id is not null
      and v.outcome in ('advanced', 'eliminated', 'pending')
    on conflict (registration_id, stage) do update
      set outcome            = excluded.outcome,
          score              = excluded.score,
          score_max          = excluded.score_max,
          reason             = excluded.reason,
          qualification_type = excluded.qualification_type,
          lga_rank           = excluded.lga_rank,
          state_rank         = excluded.state_rank,
          note               = excluded.note,
          updated_at         = excluded.updated_at
    returning 1
  )
  select count(*)::int into v_schools from upd;

  -- Fan the OUTCOME down to each school's reps. score/score_max/breakdown are
  -- deliberately untouched: those hold the rep's own paper result, and the
  -- school-level decision must never overwrite a measurement.
  with v as (
    select * from jsonb_to_recordset(p_rows) as x(
      registration_id uuid, outcome text)
  ), targets as (
    select s.id as student_id, v.outcome
    from v
    join public.registrations reg on reg.id = v.registration_id
    join public.students s
      on s.school_id = reg.school_id and s.deactivated_at is null
    where v.outcome in ('advanced', 'eliminated', 'pending')
  ), upd as (
    update public.student_stage_results r
    set    outcome = t.outcome, updated_at = now()
    from   targets t
    where  r.student_id = t.student_id
      and  r.stage = v_stage
      and  r.edition_year = v_edition
    returning 1
  )
  select count(*)::int into v_reps from upd;

  return jsonb_build_object('schools', v_schools, 'reps', v_reps);
end $$;
revoke all on function public.commit_paper_cut(uuid, jsonb) from public, anon;
grant execute on function public.commit_paper_cut(uuid, jsonb) to authenticated;

-- ── the one per-item read path ──────────────────────────────────────────────
-- Access gate mirrors get_attempt_review (20260716120000) via can_read_student.
-- `correct` is emitted ONLY when the exam's review has been released: the key is
-- reused across centres and sittings, so publishing per-item answers before
-- every centre has sat the paper hands out the paper.
create or replace function public.get_paper_result(p_paper_id uuid)
returns jsonb
language plpgsql security definer set search_path = public stable
as $$
declare
  v_student  uuid;
  v_exam     uuid;
  v_version  char(1);
  v_resp     jsonb;
  v_released boolean;
  v_out      jsonb;
begin
  if auth.uid() is null then return null; end if;

  select p.student_id, p.exam_id, p.version, p.responses, e.review_released
    into v_student, v_exam, v_version, v_resp, v_released
  from public.paper_exam_papers p
  join public.paper_exams e on e.id = p.exam_id
  where p.id = p_paper_id and p.status = 'matched';
  if v_student is null then return null; end if;

  if not (public.is_admin() or public.can_read_student(v_student)) then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'title', e.title,
    'edition_year', e.edition_year,
    'stage', e.stage,
    'total', p.total,
    'out_of', e.item_count,
    'attempted', p.attempted,
    'invalid_marks', p.invalid_marks,
    'subscores', coalesce(p.subscores, '{}'::jsonb),
    'subjects', to_jsonb(e.subjects),
    'review_released', e.review_released,
    'exam_no', c.exam_no,
    'student_name', s.name,
    'school_name', sc.name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', i.position,
        'subject', i.subject,
        'choice', nullif(v_resp ->> (i.position - 1), ''),
        'is_correct', (nullif(v_resp ->> (i.position - 1), '') = i.correct),
        'correct', case when v_released then i.correct else null end
      ) order by i.position)
      from public.paper_exam_items i
      where i.exam_id = v_exam and i.version = v_version
    ), '[]'::jsonb)
  ) into v_out
  from public.paper_exam_papers p
  join public.paper_exams e on e.id = p.exam_id
  join public.students s    on s.id = p.student_id
  left join public.schools sc on sc.id = s.school_id
  left join public.paper_exam_candidates c
         on c.exam_id = p.exam_id and c.student_id = p.student_id
  where p.id = p_paper_id;

  return v_out;
end $$;
grant execute on function public.get_paper_result(uuid) to authenticated;
