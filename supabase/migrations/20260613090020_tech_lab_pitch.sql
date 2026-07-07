-- Future Tech Skills Lab progress + Innovation/Pitch Studio canvas. Idempotent.
-- Run after …019.

-- Tech Lab: which learning-path steps a student has completed.
create table if not exists public.tech_lab_progress (
  id              uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users on delete cascade,
  step_key        text not null,
  completed_at    timestamptz not null default now(),
  unique (student_user_id, step_key)
);
alter table public.tech_lab_progress enable row level security;
drop policy if exists "tech_lab_self"       on public.tech_lab_progress;
drop policy if exists "tech_lab_staff_read" on public.tech_lab_progress;
create policy "tech_lab_self" on public.tech_lab_progress for all
  using (student_user_id = auth.uid()) with check (student_user_id = auth.uid());
create policy "tech_lab_staff_read" on public.tech_lab_progress for select using (
  public.is_admin() or student_user_id in (
    select auth_user_id from public.students where school_id in (select public.my_school_ids())));

-- Pitch Studio: one Business Model Canvas per student (data = blocks of notes).
create table if not exists public.pitch_canvas (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users on delete cascade,
  title         text not null default 'My Pitch',
  data          jsonb not null default '{}',
  updated_at    timestamptz not null default now(),
  unique (owner_user_id)
);
alter table public.pitch_canvas enable row level security;
drop policy if exists "pitch_self"       on public.pitch_canvas;
drop policy if exists "pitch_staff_read" on public.pitch_canvas;
create policy "pitch_self" on public.pitch_canvas for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "pitch_staff_read" on public.pitch_canvas for select using (
  public.is_admin() or owner_user_id in (
    select auth_user_id from public.students where school_id in (select public.my_school_ids())));
