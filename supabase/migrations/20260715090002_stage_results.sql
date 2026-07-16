-- Per-school, per-stage competition outcomes. The edition tracks ONE current
-- stage for everyone; this records how each registered school fared at each
-- stage — advanced, eliminated, or still pending — so a school can qualify at
-- the Zonal Stage yet not advance to the Grand Finale, with an optional score
-- and note. Run after editions (…05) and school_members (…06). Idempotent.

create table if not exists public.registration_stage_results (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations on delete cascade,
  stage           text not null,
  outcome         text not null default 'pending'
                    check (outcome in ('pending', 'advanced', 'eliminated')),
  score           numeric,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One outcome per school per stage; the bulk marker upserts on this.
  unique (registration_id, stage)
);
create index if not exists stage_results_registration_idx
  on public.registration_stage_results (registration_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.registration_stage_results enable row level security;
drop policy if exists "stage_results_read"        on public.registration_stage_results;
drop policy if exists "stage_results_admin_write" on public.registration_stage_results;

-- Mirrors registration visibility: admins, the registration owner, and approved
-- members of the school can read their own stage outcomes.
create policy "stage_results_read" on public.registration_stage_results for select using (
  public.is_admin()
  or exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and (r.owner_id = auth.uid() or r.school_id in (select public.my_school_ids()))
  )
);
create policy "stage_results_admin_write" on public.registration_stage_results
  for all using (public.is_admin()) with check (public.is_admin());
