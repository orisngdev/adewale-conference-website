-- Who turned up. Idempotent.
--
-- ADR-0010 names the hole this fills: the model cannot say anything about a Rep
-- who was entered and did not sit. Inferring it from whether a bubble sheet came
-- back only answers after grading, and answers "no sheet" for a candidate who
-- sat and whose sheet was lost.
--
-- Keyed on the candidate, not the student-edition: paper_exam_candidates is
-- already the authority on who was issued a sheet for this sitting.

-- Which exam the centre-lead pages are marking against, and the on/off switch
-- for the whole lead-facing site.
alter table public.paper_exams
  add column if not exists attendance_open boolean not null default false;
create unique index if not exists paper_exams_one_attendance_open
  on public.paper_exams (edition_year) where attendance_open;

create table if not exists public.paper_exam_attendance (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.paper_exams on delete cascade,
  student_id       uuid not null references public.students on delete cascade,
  -- Where they were marked, which for a walk-in is not where they were
  -- allocated. The allocation stays on the registration; this is what happened.
  centre_id        uuid not null references public.exam_centres,
  status           text not null check (status in ('present','absent')),
  marked_by_lead   uuid references public.centre_leads on delete set null,
  marked_by_profile uuid references public.profiles(id) on delete set null,
  marked_at        timestamptz not null default now(),
  note             text,
  unique (exam_id, student_id),
  -- A mark is made by a centre lead or by an admin correcting one, never both.
  -- Deliberately `<= 1` and not `= 1`: both FKs are ON DELETE SET NULL, so an
  -- exact-one check would turn deleting a lead into a constraint violation on
  -- every row they marked. Writers always set exactly one.
  constraint paper_exam_attendance_one_marker
    check (num_nonnulls(marked_by_lead, marked_by_profile) <= 1)
);
create index if not exists paper_exam_attendance_exam_centre_idx
  on public.paper_exam_attendance (exam_id, centre_id);

-- Append-only. The row above holds only the latest mark, so without this
-- nothing can answer "who flipped him to absent at 11:40, and what was he
-- before" — which is the dispute a register exists to settle.
create table if not exists public.paper_exam_attendance_events (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.paper_exams on delete cascade,
  student_id       uuid not null references public.students on delete cascade,
  centre_id        uuid not null references public.exam_centres,
  status           text not null check (status in ('present','absent')),
  marked_by_lead   uuid references public.centre_leads on delete set null,
  marked_by_profile uuid references public.profiles(id) on delete set null,
  at               timestamptz not null default now()
);
create index if not exists paper_exam_attendance_events_student_idx
  on public.paper_exam_attendance_events (exam_id, student_id, at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Admin-only both ways. Marking runs on the service-role key from the
-- centre-lead pages, which re-derive the lead from a signed cookie and re-check
-- the centre before every write.
alter table public.paper_exam_attendance        enable row level security;
alter table public.paper_exam_attendance_events enable row level security;

drop policy if exists "paper_exam_attendance_admin"        on public.paper_exam_attendance;
drop policy if exists "paper_exam_attendance_events_admin" on public.paper_exam_attendance_events;
create policy "paper_exam_attendance_admin" on public.paper_exam_attendance
  for all using (public.is_admin()) with check (public.is_admin());
create policy "paper_exam_attendance_events_admin" on public.paper_exam_attendance_events
  for all using (public.is_admin()) with check (public.is_admin());
