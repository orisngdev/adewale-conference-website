-- Student replacement: schools swap a registered rep (student A drops out, B
-- takes the slot). A coordinator files a request; an admin approves it, which
-- deactivates the outgoing student and provisions the incoming one. Run after
-- students (…09) and request_access. Idempotent.

-- Outgoing students are deactivated, not deleted — the row + their assessment /
-- plan history stay for audit. null = active. Provisioning and every roster read
-- filter on this.
alter table public.students add column if not exists deactivated_at timestamptz;

-- The request queue. rep_slot is the Airtable "Student Rep N" position (1-3),
-- resolved when the request is filed so approval can write the swap back to the
-- right Airtable field. new_details carries the incoming rep's DOB/Gender/Class/
-- Guardian so Airtable stays complete after the swap.
create table if not exists public.student_replacements (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations on delete cascade,
  school_id       uuid not null references public.schools on delete cascade,
  rep_slot        smallint,
  old_student_id  uuid references public.students on delete set null,
  old_name        text not null,
  old_level       text,
  new_name        text not null,
  new_level       text,
  new_details     jsonb not null default '{}'::jsonb,
  reason          text,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'declined')),
  requested_by    uuid references public.profiles,
  reviewed_by     uuid references public.profiles,
  admin_note      text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);
create index if not exists student_replacements_status_idx
  on public.student_replacements (status, created_at);
create index if not exists student_replacements_school_idx
  on public.student_replacements (school_id);

alter table public.student_replacements enable row level security;

-- Approved members of the school (or admins) file + read their school's
-- requests; only admins can act on them (approve/decline).
drop policy if exists "sr_read"         on public.student_replacements;
drop policy if exists "sr_insert"       on public.student_replacements;
drop policy if exists "sr_admin_update" on public.student_replacements;
create policy "sr_read" on public.student_replacements for select using (
  public.is_admin() or school_id in (select public.my_school_ids())
);
create policy "sr_insert" on public.student_replacements for insert with check (
  public.is_admin() or school_id in (select public.my_school_ids())
);
create policy "sr_admin_update" on public.student_replacements for update
  using (public.is_admin()) with check (public.is_admin());
