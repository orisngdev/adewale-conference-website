-- The paper qualifying exam: a 100-question bubble sheet (A-D or A-E) sat at
-- zone centres, captured with an external tool (ZipGrade today) and graded HERE.
-- Idempotent. See docs/adr/0009-paper-qualifying-exam-as-its-own-domain.md.
--
-- Why this is not a `mode` of public.assessments:
--   * assessment_attempts.student_user_id -> auth.users, but a paper result must
--     be recordable for a rep with no auth user (history-only rows exist
--     deliberately, and code-login reps may never sign in);
--   * assessments.subject is ONE scalar, while the deliverable here is a
--     per-question subject tag over interleaved items;
--   * one exam may be printed in up to four key versions;
--   * a bubble sheet is not self-identifying, so capture needs a staging and
--     unmatched-review step that an attempt has no use for.

-- ── shared access predicate ─────────────────────────────────────────────────
-- The self / admin / coordinator-of-their-school rule was written out by hand in
-- get_attempt_review and student_stage_results_read. Naming it once means the
-- paper-exam policies below cannot drift from the CBT ones.
create or replace function public.can_read_student(p_student_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select p_student_id is not null and (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = p_student_id
        and (s.auth_user_id = auth.uid()
             or s.school_id in (select public.my_school_ids()))
    )
  );
$$;
grant execute on function public.can_read_student(uuid) to authenticated;

-- ── the exam ────────────────────────────────────────────────────────────────
create table if not exists public.paper_exams (
  id                uuid primary key default gen_random_uuid(),
  edition_year      int  not null references public.editions(year),
  stage             text not null default 'Qualifications',
  title             text not null check (btrim(title) <> ''),
  item_count        int  not null default 100 check (item_count between 1 and 100),
  -- How many bubbles each question has. A-D and A-E sheets are both in use, and
  -- it matters both ways: an E is a real answer on a five-option paper, and on a
  -- four-option one it is a misread that must be flagged, not scored.
  option_count      int  not null default 4 check (option_count in (4,5)),
  -- A deliberate historical import. Past editions are locked everywhere else in
  -- this app so old results cannot be altered by accident; a backfill is not an
  -- accident, so it says so on the exam rather than weakening the rule.
  is_backfill       boolean not null default false,
  -- This exam's own ordered subject vocabulary. These strings become the literal
  -- keys of student_stage_results.breakdown, so this is the published spelling
  -- and the only place it is spelled. Deliberately NOT src/lib/assessments.ts
  -- SUBJECTS: the CBT's four compound names are a different taxonomy, and the
  -- 2022 paper breakdown used six different ones.
  subjects          text[] not null default '{}'::text[],
  -- Compared against the capture tool's quiz name on import, so a CSV exported
  -- from the wrong quiz is refused instead of silently scored.
  source_quiz_name  text,
  -- How rep totals become the school's score for this stage. Recorded, never
  -- implied, so the ranking screen can state which rule produced its numbers.
  school_score_rule text not null default 'sum_all'
                      check (school_score_rule in ('sum_all','sum_top_n','mean_present','best')),
  school_score_top_n int not null default 3 check (school_score_top_n between 1 and 10),
  -- Correct answers stay server-side until every centre has sat the paper. The
  -- key is reused across sittings, so releasing per-item answers early hands
  -- out the paper.
  review_released   boolean not null default false,
  status            text not null default 'draft'
                      check (status in ('draft','printed','grading','published')),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (edition_year, stage, title)
);
create index if not exists paper_exams_edition_idx on public.paper_exams (edition_year, stage);

-- For a database that already has the table from an earlier run of this file.
alter table public.paper_exams
  add column if not exists option_count int not null default 4;
alter table public.paper_exams
  add column if not exists is_backfill boolean not null default false;
alter table public.paper_exams drop constraint if exists paper_exams_option_count_check;
alter table public.paper_exams
  add constraint paper_exams_option_count_check check (option_count in (4,5));

-- ── the key, one row per item per version ───────────────────────────────────
create table if not exists public.paper_exam_items (
  id       uuid primary key default gen_random_uuid(),
  exam_id  uuid not null references public.paper_exams on delete cascade,
  version  char(1) not null default 'A' check (version in ('A','B','C','D')),
  position int  not null check (position between 1 and 100),
  subject  text not null check (btrim(subject) <> ''),
  -- The outer bound; the parent's option_count is enforced by the trigger below.
  -- `version` above is a different axis (which printed copy) and stays A-D.
  correct  char(1) not null check (correct in ('A','B','C','D','E')),
  unique (exam_id, version, position)
);
create index if not exists paper_exam_items_exam_idx
  on public.paper_exam_items (exam_id, version, position);

-- A join-time consistency rule belongs in SQL, not in the importer — the
-- precedent is enforce_aq_mode_match() in 20260613090014_question_bank.sql.
-- Without this a typo'd subject silently becomes a new breakdown key, and an E
-- typed into the key of a four-option paper scores every student wrong on an
-- answer no sheet could carry.
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

-- The same rule from the other side: narrowing an exam to four options while its
-- key answers a question with E would grade every student against an answer no
-- sheet could carry.
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

-- ── who was printed a sheet, and with which number ──────────────────────────
-- THE AUTHORITY ON CANDIDATE NUMBERS. `unique (exam_id, exam_no)` is what makes
-- "one list per exam" a database guarantee rather than a convention, and the
-- 3-digit CHECK matches the printed sheet's ID box (ASC 2026 (6480)).
create table if not exists public.paper_exam_candidates (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.paper_exams on delete cascade,
  student_id  uuid not null references public.students on delete cascade,
  exam_no     text not null check (exam_no ~ '^[0-9]{1,3}$'),
  version     char(1) not null default 'A' check (version in ('A','B','C','D')),
  class_name  text,
  exported_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (exam_id, student_id),
  unique (exam_id, exam_no)
);
create index if not exists paper_exam_candidates_student_idx
  on public.paper_exam_candidates (student_id);

-- ── one import event ────────────────────────────────────────────────────────
create table if not exists public.paper_exam_imports (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references public.paper_exams on delete cascade,
  -- The Phase-2 seam: an in-app scanner stages rows with source='in_app_scanner'
  -- and everything downstream (grade, match, review, commit) is unchanged.
  source             text not null default 'zipgrade_csv'
                       check (source in ('zipgrade_csv','in_app_scanner')),
  filename           text,
  -- The resolved column mapping, verbatim. The capture tool's export headers are
  -- undocumented and sniffed, so "it read the wrong column" must be a
  -- five-second diagnosis rather than a re-read of the CSV.
  header_map         jsonb,
  row_count          int not null default 0,
  matched_count      int not null default 0,
  undecided_count    int not null default 0,
  error_count        int not null default 0,
  key_mismatch_count int not null default 0,
  status             text not null default 'staged'
                       check (status in ('staged','committed','discarded')),
  imported_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  committed_at       timestamptz
);
create index if not exists paper_exam_imports_exam_idx
  on public.paper_exam_imports (exam_id, created_at desc);

-- ── one physical sheet ──────────────────────────────────────────────────────
create table if not exists public.paper_exam_papers (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references public.paper_exams on delete cascade,
  import_id           uuid not null references public.paper_exam_imports on delete cascade,
  -- identity as it came off the sheet / capture tool
  external_id         text,
  exam_no             text,
  first_name          text,
  last_name           text,
  class_name          text,
  version             char(1) not null default 'A' check (version in ('A','B','C','D')),
  version_assumed     boolean not null default false,
  -- The captured marks: a JSON array, index 0 = item 1, each entry 'A'..'D',
  -- null for blank, or '?' for an unreadable/multi mark. This is exactly the
  -- payload a Phase-2 scanner will produce, which is why grading reads it and
  -- never the CSV.
  responses           jsonb not null default '[]',
  total               int,
  attempted           int,
  invalid_marks       int not null default 0,
  subscores           jsonb,
  -- Read only to cross-check our own grading; never used to score.
  capture_num_correct int,
  key_mismatches      int,
  -- The number matched but the name on the sheet does not. Still matched — the
  -- bubbled number is the identity — but never silently: a mis-bubbled digit,
  -- or a file from the wrong sitting, lands on a real student this way.
  name_mismatch       boolean not null default false,
  -- resolution
  student_id          uuid references public.students on delete set null,
  match_method        text check (match_method in ('external_id','exam_no','name_class','manual')),
  status              text not null default 'unmatched'
                        check (status in ('matched','unmatched','ambiguous','duplicate','discarded')),
  resolution_note     text,
  resolved_by         uuid references public.profiles(id) on delete set null,
  -- Re-importing the same file is a no-op; a genuinely different second sheet
  -- for one student trips the partial index below and becomes a decision.
  source_fingerprint  text not null,
  source_row          jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (exam_id, source_fingerprint)
);
create index if not exists paper_exam_papers_exam_status_idx
  on public.paper_exam_papers (exam_id, status);
create index if not exists paper_exam_papers_student_idx
  on public.paper_exam_papers (student_id);
alter table public.paper_exam_papers
  add column if not exists name_mismatch boolean not null default false;

create index if not exists paper_exam_papers_import_idx
  on public.paper_exam_papers (import_id);
create unique index if not exists paper_exam_papers_one_matched_per_student
  on public.paper_exam_papers (exam_id, student_id)
  where student_id is not null and status = 'matched';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- paper_exam_items holds the ANSWER KEY, so there is deliberately no
-- student-readable policy to get wrong — the same structural guarantee ADR-0002
-- gives exam questions. The exam, its candidates and its imports are admin-only
-- for the same reason (candidates map a student to a printed number; imports
-- carry the raw capture).
alter table public.paper_exams            enable row level security;
alter table public.paper_exam_items       enable row level security;
alter table public.paper_exam_candidates  enable row level security;
alter table public.paper_exam_imports     enable row level security;
alter table public.paper_exam_papers      enable row level security;

drop policy if exists "paper_exams_admin"           on public.paper_exams;
drop policy if exists "paper_exam_items_admin"      on public.paper_exam_items;
drop policy if exists "paper_exam_candidates_admin" on public.paper_exam_candidates;
drop policy if exists "paper_exam_imports_admin"    on public.paper_exam_imports;
create policy "paper_exams_admin" on public.paper_exams
  for all using (public.is_admin()) with check (public.is_admin());
create policy "paper_exam_items_admin" on public.paper_exam_items
  for all using (public.is_admin()) with check (public.is_admin());
create policy "paper_exam_candidates_admin" on public.paper_exam_candidates
  for all using (public.is_admin()) with check (public.is_admin());
create policy "paper_exam_imports_admin" on public.paper_exam_imports
  for all using (public.is_admin()) with check (public.is_admin());

-- A Paper holds the student's OWN marks and computed scores — no key — so it is
-- safe for them and their coordinator to read, and the list pages stay plain
-- selects. Mirrors student_stage_results_read via the shared predicate.
drop policy if exists "paper_exam_papers_read"        on public.paper_exam_papers;
drop policy if exists "paper_exam_papers_admin_write" on public.paper_exam_papers;
create policy "paper_exam_papers_read" on public.paper_exam_papers for select using (
  public.is_admin() or public.can_read_student(student_id)
);
create policy "paper_exam_papers_admin_write" on public.paper_exam_papers
  for all using (public.is_admin()) with check (public.is_admin());
