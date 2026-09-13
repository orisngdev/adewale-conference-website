-- Publish the papers that are decided; keep the undecided ones outstanding.
--
-- The completeness gate was on the wrong operation: publishing a rep's score
-- records a measurement, true whatever happens to the other sheets, while
-- commit_paper_cut — the decision that really is wrong on an incomplete team
-- score — had no guard at all. This moves it. Idempotent.

-- Per-paper, because an import now publishes in more than one pass.
alter table public.paper_exam_papers
  add column if not exists published_at timestamptz;
create index if not exists paper_exam_papers_published_idx
  on public.paper_exam_papers (exam_id) where published_at is not null;

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

  select count(*) into v_pending
  from public.paper_exam_papers
  where import_id = p_import_id
    and status in ('unmatched', 'ambiguous', 'duplicate');

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

  -- `outcome` is set only on INSERT: a re-commit that corrects a score must not
  -- un-decide a rep an admin has already advanced or eliminated.
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

  update public.paper_exam_papers
  set    published_at = now()
  where  import_id = p_import_id and status = 'matched' and student_id is not null;

  -- 'committed' means finished; while rows are undecided it stays 'staged'.
  update public.paper_exam_imports
  set    status = case when v_pending = 0 then 'committed' else status end,
         committed_at = case when v_pending = 0 then now() else committed_at end,
         matched_count = (
           select count(*) from public.paper_exam_papers
           where import_id = p_import_id and status = 'matched'),
         undecided_count = v_pending
  where  id = p_import_id;

  update public.paper_exams
  set    status = 'grading', updated_at = now()
  where  id = v_exam and status in ('draft', 'printed');

  return jsonb_build_object('published', v_published, 'pending', v_pending);
end $$;
revoke all on function public.commit_paper_import(uuid) from public, anon;
grant execute on function public.commit_paper_import(uuid) to authenticated;

-- The refusal that was missing: the cut is not re-run once committed.
create or replace function public.assert_papers_all_decided(p_exam_id uuid)
returns void
language plpgsql security definer set search_path = public stable
as $$
declare v_pending int;
begin
  select count(*) into v_pending
  from public.paper_exam_papers
  where exam_id = p_exam_id
    and status in ('unmatched', 'ambiguous', 'duplicate');
  if v_pending > 0 then
    raise exception
      '% paper(s) still need a decision. A school ranked while one of its reps'' sheets is unattached is ranked on an incomplete score — resolve or discard them first.',
      v_pending;
  end if;
end $$;
revoke all on function public.assert_papers_all_decided(uuid) from public, anon;

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

  perform public.assert_papers_all_decided(p_exam_id);

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
