-- The cut must rank on what students can see.
--
-- Partial commit made a new sequence possible: resolve the last undecided rows,
-- skip Publish, and go straight to the cut. get_paper_ranking reads matched
-- papers regardless of publication, so that would write outcomes onto reps whose
-- score was never published — "Not advanced" with nothing behind it. Idempotent.
create or replace function public.assert_papers_all_decided(p_exam_id uuid)
returns void
language plpgsql security definer set search_path = public stable
as $$
declare
  v_pending     int;
  v_unpublished int;
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

  select count(*) into v_unpublished
  from public.paper_exam_papers
  where exam_id = p_exam_id
    and status = 'matched'
    and student_id is not null
    and published_at is null;
  if v_unpublished > 0 then
    raise exception
      '% matched paper(s) have not been published. Publish the import first, so every rep can see the score this ranking is built on.',
      v_unpublished;
  end if;
end $$;
revoke all on function public.assert_papers_all_decided(uuid) from public, anon;

-- published_at is when a score FIRST reached the record, so a re-publish that
-- corrects a total does not restamp every row that was already out.
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

  -- Re-grade from the captured responses: the key may have been corrected since.
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

  -- `outcome` on INSERT only: a re-publish must not un-decide a rep.
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
  where  import_id = p_import_id and status = 'matched'
    and  student_id is not null and published_at is null;

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
