-- Indexes supporting the admin analytics dashboard (ADR-0007). The dashboard
-- reads engagement/growth tables with a time window (.gte on a timestamp column)
-- and orders newest-first; these indexes keep those scans index-backed as the
-- tables grow. Purely additive and idempotent — safe to re-run, no data change.
-- Plain (non-CONCURRENT) so the statements run inside the migration transaction;
-- the tables are small today, so the brief build lock is negligible.

-- Growth trends: new rows over time.
create index if not exists registrations_created_idx on public.registrations (created_at);
create index if not exists profiles_created_idx      on public.profiles (created_at);
create index if not exists schools_created_idx        on public.schools (created_at);
create index if not exists students_created_idx       on public.students (created_at);

-- Assessment attempts: filtered by status='submitted' then windowed on created_at.
create index if not exists assessment_attempts_status_created_idx
  on public.assessment_attempts (status, created_at);

-- Resource downloads: windowed on created_at.
create index if not exists resource_downloads_created_idx on public.resource_downloads (created_at);

-- Lab progress: windowed on completed_at.
create index if not exists lab_progress_completed_idx      on public.lab_progress (completed_at);
create index if not exists tech_lab_progress_completed_idx on public.tech_lab_progress (completed_at);

-- Challenge activity: windowed on the submission/entry timestamp.
create index if not exists challenge_submissions_created_idx on public.challenge_submissions (created_at);
create index if not exists challenge_entries_submitted_idx   on public.challenge_entries (submitted_at);
