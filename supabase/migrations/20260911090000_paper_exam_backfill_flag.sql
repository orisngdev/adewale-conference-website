-- Catch-up for databases that already applied 20260909090100_paper_exams.sql.
-- Everything here is also in that file, so a fresh `db reset` is unaffected;
-- this exists because an applied migration is never replayed, and editing one
-- in place silently leaves the database a column behind the code.
-- Idempotent.

-- ── the exam knows how many bubbles a question has ──────────────────────────
-- 4 (A-D) or 5 (A-E). Both sheets are in use: the 2026 paper is A-D throughout,
-- while 2025's Section A (Chemistry) was A-E and the rest A-D. It matters in
-- both directions — on a five-option paper an E is a real answer, and on a
-- four-option one it is a misread to flag rather than score.
alter table public.paper_exams
  add column if not exists option_count int not null default 4;
alter table public.paper_exams drop constraint if exists paper_exams_option_count_check;
alter table public.paper_exams
  add constraint paper_exams_option_count_check check (option_count in (4,5));

-- ── a deliberate import of a past sitting ───────────────────────────────────
-- Past editions are locked everywhere else so old results cannot be altered by
-- accident. A backfill is not an accident, so it says so on the exam rather
-- than weakening the rule for everything.
alter table public.paper_exams
  add column if not exists is_backfill boolean not null default false;
comment on column public.paper_exams.is_backfill is
  'A deliberate import of a past sitting; exempt from the past-edition lock.';

-- ── the number matched, the name did not ────────────────────────────────────
-- Still a match — the bubbled number is the identity — but never a silent one.
-- A mis-bubbled digit, or a file from a sitting whose numbers overlap ours,
-- lands on a real student this way.
alter table public.paper_exam_papers
  add column if not exists name_mismatch boolean not null default false;

-- ── key answers must fit the exam, on both sides of the join ────────────────
create or replace function public.enforce_pei_matches_exam()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_subjects text[];
  v_options  int;
begin
  select subjects, option_count into v_subjects, v_options
  from public.paper_exams where id = new.exam_id;
  if v_subjects is null then
    raise exception 'paper exam % does not exist', new.exam_id;
  end if;
  if not (new.subject = any (v_subjects)) then
    raise exception 'subject "%" is not in this paper exam''s subject list', new.subject;
  end if;
  if ascii(new.correct) - ascii('A') + 1 > v_options then
    raise exception 'answer "%" is beyond this paper exam''s % options', new.correct, v_options;
  end if;
  return new;
end $$;
drop trigger if exists pei_subject_guard on public.paper_exam_items;
drop trigger if exists pei_exam_guard on public.paper_exam_items;
create trigger pei_exam_guard before insert or update on public.paper_exam_items
  for each row execute function public.enforce_pei_matches_exam();
drop function if exists public.enforce_pei_subject_in_vocab();

-- Narrowing an exam to four options while its key still answers with E would
-- grade every student against an answer no sheet could carry.
create or replace function public.enforce_pe_options_fit_key()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_bad record;
begin
  if new.option_count >= old.option_count then
    return new;
  end if;
  select version, position, correct into v_bad
  from public.paper_exam_items
  where exam_id = new.id
    and ascii(correct) - ascii('A') + 1 > new.option_count
  limit 1;
  if v_bad is not null then
    raise exception
      'copy % answers question % with "%", which a %-option paper does not have',
      v_bad.version, v_bad.position, v_bad.correct, new.option_count;
  end if;
  return new;
end $$;
drop trigger if exists pe_options_guard on public.paper_exams;
create trigger pe_options_guard before update of option_count on public.paper_exams
  for each row execute function public.enforce_pe_options_fit_key();

-- ── answers are A-E at the table level ──────────────────────────────────────
-- The per-exam option_count is the real bound, enforced by the trigger above;
-- this is only the outer limit. `version` is a different axis and stays A-D.
alter table public.paper_exam_items drop constraint if exists paper_exam_items_correct_check;
alter table public.paper_exam_items
  add constraint paper_exam_items_correct_check check (correct in ('A','B','C','D','E'));

-- ── allocation must never touch a backfill ─────────────────────────────────
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

  -- A backfill's candidate numbers are the ones ALREADY on the students'
  -- records — that is what makes a past sitting's papers match. Allocating
  -- would overwrite them with a fresh 001.. run and destroy both the match and
  -- the historical record, so it is refused outright rather than warned about.
  if exists (select 1 from public.paper_exams where id = p_exam_id and is_backfill) then
    raise exception
      'this exam is marked as a past sitting: its candidate numbers are already on the student records, and allocating would overwrite them';
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
           s.level as class_name,   -- the rep's class, printed on the sheet
           row_number() over (order by sc.name nulls last, s.name, s.id) - 1 as seq
    from public.students s
    left join public.schools sc on sc.id = s.school_id
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
