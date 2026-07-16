-- Per-STUDENT, per-stage competition outcomes — the individual-level mirror of
-- registration_stage_results (which is per school). At later stages (e.g. the
-- Grand Finale) individual reps compete and are ranked, so a school can advance
-- as a unit yet its reps place differently. Records outcome + an optional score
-- and note per (student, stage). The participant hub upserts on (student_id,
-- stage). Run after students (…09). Idempotent.

create table if not exists public.student_stage_results (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students on delete cascade,
  stage       text not null,
  outcome     text not null default 'pending'
                check (outcome in ('pending', 'advanced', 'eliminated')),
  score       numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One outcome per student per stage; the hub upserts on this.
  unique (student_id, stage)
);
create index if not exists student_stage_results_student_idx
  on public.student_stage_results (student_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.student_stage_results enable row level security;
drop policy if exists "student_stage_results_read"        on public.student_stage_results;
drop policy if exists "student_stage_results_admin_write" on public.student_stage_results;

-- Mirrors student visibility: admins, the student themselves, and approved
-- members of the student's school can read the outcomes.
create policy "student_stage_results_read" on public.student_stage_results for select using (
  public.is_admin()
  or exists (
    select 1 from public.students s
    where s.id = student_id
      and (s.auth_user_id = auth.uid() or s.school_id in (select public.my_school_ids()))
  )
);
create policy "student_stage_results_admin_write" on public.student_stage_results
  for all using (public.is_admin()) with check (public.is_admin());
