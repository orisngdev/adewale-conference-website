-- Backfill: coordinator-provisioned students were created without edition_year, so
-- edition-scoped plans/exams (which match on students.edition_year) silently skipped
-- them. Tag each untagged student with their school's most recent registration
-- edition, else the latest edition. Provisioning now stamps it going forward.
-- Idempotent — only touches rows where edition_year is null.

update public.students s
set edition_year = coalesce(
  (select max(r.edition_year) from public.registrations r where r.school_id = s.school_id),
  (select max(year) from public.editions)
)
where s.edition_year is null;
