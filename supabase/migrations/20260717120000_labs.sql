-- Guided Labs: multi-lab learning paths (generalises the Future Tech Skills Lab
-- into an admin-authored engine). Idempotent. Run after …090001_sync_rpcs.sql.

-- ── labs ────────────────────────────────────────────────────────────────────
create table if not exists public.labs (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  summary    text,
  track      text,
  sort       int  not null default 0,
  published  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── lab_steps (lessons) ─────────────────────────────────────────────────────
-- key is a stable per-lab slug so progress survives reordering/edits.
create table if not exists public.lab_steps (
  id             uuid primary key default gen_random_uuid(),
  lab_id         uuid not null references public.labs on delete cascade,
  sort           int  not null default 0,
  key            text not null,
  title          text not null,
  kind           text not null default 'lesson'
                   check (kind in ('lesson','video','link','quiz')),
  body_md        text,                                     -- notes (all kinds)
  media_url      text,                                     -- video / tool URL
  link_label     text,
  duration_label text,                                     -- free text, optional
  assessment_id  uuid references public.assessments on delete set null,
  unique (lab_id, key)
);
create index if not exists lab_steps_lab_idx on public.lab_steps (lab_id, sort);

-- ── lab_progress (per-student ticks) ────────────────────────────────────────
create table if not exists public.lab_progress (
  id              uuid primary key default gen_random_uuid(),
  lab_id          uuid not null references public.labs on delete cascade,
  student_user_id uuid not null references auth.users on delete cascade,
  step_key        text not null,
  completed_at    timestamptz not null default now(),
  unique (lab_id, student_user_id, step_key)
);
create index if not exists lab_progress_student_idx
  on public.lab_progress (student_user_id, lab_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.labs         enable row level security;
alter table public.lab_steps    enable row level security;
alter table public.lab_progress enable row level security;

-- Labs: published readable by any authenticated user; admins read/write all.
drop policy if exists "labs_read"  on public.labs;
drop policy if exists "labs_admin" on public.labs;
create policy "labs_read"  on public.labs for select
  using (published = true or public.is_admin());
create policy "labs_admin" on public.labs for all
  using (public.is_admin()) with check (public.is_admin());

-- Steps: readable when their lab is published (or admin); admins write.
drop policy if exists "lab_steps_read"  on public.lab_steps;
drop policy if exists "lab_steps_admin" on public.lab_steps;
create policy "lab_steps_read" on public.lab_steps for select using (
  public.is_admin()
  or lab_id in (select id from public.labs where published = true)
);
create policy "lab_steps_admin" on public.lab_steps for all
  using (public.is_admin()) with check (public.is_admin());

-- Progress: student manages own; staff (admin / same-school coordinator) read.
drop policy if exists "lab_progress_self"       on public.lab_progress;
drop policy if exists "lab_progress_staff_read" on public.lab_progress;
create policy "lab_progress_self" on public.lab_progress for all
  using (student_user_id = auth.uid()) with check (student_user_id = auth.uid());
create policy "lab_progress_staff_read" on public.lab_progress for select using (
  public.is_admin() or student_user_id in (
    select auth_user_id from public.students
    where school_id in (select public.my_school_ids())));
