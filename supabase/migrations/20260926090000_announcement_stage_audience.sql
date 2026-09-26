-- Narrow an announcement to the schools at one stage — a Grand Finale briefing
-- the rest of the field should not receive, or a thank-you to the schools
-- eliminated at zonals. A null audience_stage is every registered school, which
-- is what every announcement sent before this was.
--
-- Qualifications + 'advanced' is what the portal calls "qualified". It borrows
-- the NAME from the resource tiers, not the predicate: tierRank is a cumulative
-- ladder, this asks about one stage. Additive and idempotent.

alter table public.announcements
  add column if not exists audience_stage   text,
  add column if not exists audience_outcome text not null default 'advanced';

-- Constraint added separately so a database that already has the column from a
-- partly-applied push still gets the check.
alter table public.announcements
  drop constraint if exists announcements_audience_outcome_check;
alter table public.announcements
  add constraint announcements_audience_outcome_check
    check (audience_outcome in ('advanced', 'eliminated'));

-- Unlike target_role, the stage audience IS part of the read predicate. Role
-- narrowing is best-effort — an educator the registration entry doesn't name is
-- skipped by the send but is still at a targeted school. A school at a different
-- stage was never the audience, so the portal must not list it the announcement
-- either.
--
-- 'Qualifications' and 'Zonal Stage' are the same milestone under two spellings:
-- 20260727100000 renamed the edition's current stage but not the result rows, so
-- older rows still say 'Zonal Stage'. Mirrors matchesStageAudience in
-- src/lib/announcement-recipients.ts — keep the two in step.
create or replace function public.can_read_announcement(p_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $function$
  select exists (
    select 1 from public.announcements a
    where a.id = p_id
      and a.status = 'sent'
      and (
        (a.edition_year is null and exists (select 1 from public.my_school_ids()))
        or (a.edition_year is not null and exists (
              select 1 from public.registrations r
              where r.edition_year = a.edition_year
                and r.school_id in (select public.my_school_ids())
           ))
      )
      and (
        a.audience_stage is null
        or exists (
          select 1
          from public.registrations r
          join public.registration_stage_results sr on sr.registration_id = r.id
          where r.school_id in (select public.my_school_ids())
            and (a.edition_year is null or r.edition_year = a.edition_year)
            and r.status = 'verified'
            and sr.outcome = a.audience_outcome
            and (
              sr.stage = a.audience_stage
              or (a.audience_stage in ('Qualifications', 'Zonal Stage')
                  and sr.stage in ('Qualifications', 'Zonal Stage'))
            )
        )
      )
  );
$function$;

revoke all on function public.can_read_announcement(uuid) from public, anon;
grant execute on function public.can_read_announcement(uuid) to authenticated;
