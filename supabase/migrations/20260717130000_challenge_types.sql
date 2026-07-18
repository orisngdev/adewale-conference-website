-- Multi-type challenges. The data arena (…090022_challenges.sql) stays exactly
-- as-is; this generalises `challenges` into a competitive arena with four kinds
-- of entry: data (auto-scored, unchanged), pitch (canvas snapshot), text
-- (write-up) and link. The three non-data kinds are admin-reviewed and live in
-- a single `challenge_entries` table (one row per student per challenge, a
-- replaceable snapshot payload). Idempotent. Run after …120200_labs_workbench.

-- ── challenges.type ─────────────────────────────────────────────────────────
alter table public.challenges add column if not exists type text not null default 'data';
alter table public.challenges drop constraint if exists challenges_type_check;
alter table public.challenges
  add constraint challenges_type_check check (type in ('data', 'pitch', 'text', 'link'));

-- Data-only columns become nullable: pitch/text/link challenges have no metric.
-- (A CHECK passes on NULL, so the existing metric check still holds for data.)
alter table public.challenges alter column metric drop not null;

-- ── challenge_entries (all non-data types) ──────────────────────────────────
-- payload is shaped by the challenge type:
--   pitch → { "canvas": <pitch_canvas.data snapshot> }
--   text  → { "text": "…" }
--   link  → { "url": "https://…", "label": "…"|null }
create table if not exists public.challenge_entries (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references public.challenges on delete cascade,
  student_user_id uuid not null references auth.users on delete cascade,
  payload         jsonb not null,
  note            text,
  submitted_at    timestamptz not null default now(),
  status          text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  score           int check (score >= 0 and score <= 100),
  feedback        text,
  reviewed_at     timestamptz,
  unique (challenge_id, student_user_id)
);
create index if not exists challenge_entries_challenge_idx
  on public.challenge_entries (challenge_id, submitted_at);
create index if not exists challenge_entries_student_idx
  on public.challenge_entries (student_user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.challenge_entries enable row level security;

drop policy if exists "challenge_entries_self_read"   on public.challenge_entries;
drop policy if exists "challenge_entries_self_insert"  on public.challenge_entries;
drop policy if exists "challenge_entries_self_update"  on public.challenge_entries;
drop policy if exists "challenge_entries_staff_read"   on public.challenge_entries;
drop policy if exists "challenge_entries_admin"        on public.challenge_entries;

-- Students read + insert their own entry.
create policy "challenge_entries_self_read" on public.challenge_entries for select
  using (student_user_id = auth.uid());
create policy "challenge_entries_self_insert" on public.challenge_entries for insert
  with check (student_user_id = auth.uid());
-- Students may edit their entry ONLY while it's still 'submitted' (not yet
-- reviewed). The deadline is enforced in the server action, not here.
create policy "challenge_entries_self_update" on public.challenge_entries for update
  using (student_user_id = auth.uid() and status = 'submitted')
  with check (student_user_id = auth.uid() and status = 'submitted');

-- School staff read their own students' entries; admins do everything.
create policy "challenge_entries_staff_read" on public.challenge_entries for select using (
  public.is_admin() or student_user_id in (
    select auth_user_id from public.students where school_id in (select public.my_school_ids())));
create policy "challenge_entries_admin" on public.challenge_entries for all
  using (public.is_admin()) with check (public.is_admin());
