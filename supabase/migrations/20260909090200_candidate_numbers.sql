-- Candidate numbers: the 3-digit number printed and bubbled on a rep's answer
-- sheet. Idempotent.
--
-- Scheme: ONE LIST PER EXAM. 001…N, never reused, so a bubbled 007 identifies
-- exactly one candidate anywhere in the sitting and a single import file may
-- span every centre. 3 digits is what the printed sheet ASC 2026 (6480) has, and
-- it satisfies the capture tool's pre-filled-answer-sheet requirement (the ID
-- box must be wide enough for every number in the class), so no sheet re-issue
-- is needed. The ceiling is 999 and is enforced below rather than discovered.
--
-- The authority is paper_exam_candidates (unique (exam_id, exam_no)).
-- students.exam_id is a MIRROR for display and the historical record — its
-- existing comment ("Exam number as printed on the zonal finals result sheet
-- for the student's edition") already describes exactly this, so its meaning is
-- unchanged and the pre-2026 zone-scoped values need no migration: they stay
-- put, harmlessly, because nothing keys on them.

create or replace function public.allocate_candidate_numbers(p_exam_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ceiling  int := 999;
  v_edition  int;
  v_existing int;
  v_pending  int;
  v_next     int;
  v_allocated int := 0;
begin
  -- SECURITY DEFINER bypasses RLS, so a view-only admin's own token must not
  -- reach it. Same guard as allocate_qualification_zones (20260822091000).
  if not public.has_module_manage('participants') then
    raise exception 'Not permitted';
  end if;

  select edition_year into v_edition from public.paper_exams where id = p_exam_id;
  if v_edition is null then
    raise exception 'paper exam % does not exist', p_exam_id;
  end if;

  select count(*) into v_existing
  from public.paper_exam_candidates where exam_id = p_exam_id;

  select count(*) into v_pending
  from public.students s
  where s.edition_year = v_edition
    and s.deactivated_at is null
    and not exists (
      select 1 from public.paper_exam_candidates c
      where c.exam_id = p_exam_id and c.student_id = s.id
    );

  -- Refuse the whole allocation rather than colliding or wrapping around, so
  -- the UI can say "1,042 candidates need a wider sheet".
  if v_existing + v_pending > v_ceiling then
    return jsonb_build_object(
      'allocated', 0, 'existing', v_existing,
      'would_need', v_existing + v_pending, 'ceiling', v_ceiling);
  end if;

  -- Append-only: continue from the highest number already handed out so a
  -- re-run after a late school joins NEVER renumbers a student whose sheet is
  -- already printed.
  select coalesce(max(exam_no::int), 0) + 1 into v_next
  from public.paper_exam_candidates where exam_id = p_exam_id;

  with pending as (
    select s.id,
           coalesce(nullif(btrim(r.qualification_zone), ''), sc.name) as class_name,
           row_number() over (order by sc.name nulls last, s.name, s.id) - 1 as seq
    from public.students s
    left join public.schools sc on sc.id = s.school_id
    left join public.registrations r
           on r.school_id = s.school_id and r.edition_year = v_edition
    where s.edition_year = v_edition
      and s.deactivated_at is null
      and not exists (
        select 1 from public.paper_exam_candidates c
        where c.exam_id = p_exam_id and c.student_id = s.id
      )
  ), ins as (
    insert into public.paper_exam_candidates (exam_id, student_id, exam_no, class_name)
    select p_exam_id, p.id, lpad((v_next + p.seq)::text, 3, '0'), p.class_name
    from pending p
    on conflict (exam_id, student_id) do nothing
    returning 1
  )
  select count(*)::int into v_allocated from ins;

  -- Mirror onto the student row for display and the historical record.
  update public.students s
  set    exam_id = c.exam_no
  from   public.paper_exam_candidates c
  where  c.exam_id = p_exam_id
    and  c.student_id = s.id
    and  coalesce(s.exam_id, '') <> c.exam_no;

  return jsonb_build_object(
    'allocated', v_allocated,
    'existing', v_existing,
    'total', v_existing + v_allocated,
    'ceiling', v_ceiling);
end $$;

revoke all on function public.allocate_candidate_numbers(uuid) from public, anon;
grant execute on function public.allocate_candidate_numbers(uuid) to authenticated;
