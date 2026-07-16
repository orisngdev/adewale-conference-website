-- Certificates can now target a specific student, not just the school as a
-- whole. student_id NULL = a school-wide certificate (the original behaviour);
-- set = an individual rep's certificate (e.g. a named Finalist). Issued from the
-- participant hub. Run after students (…09). Idempotent.

alter table public.certificates
  add column if not exists student_id uuid references public.students on delete cascade;
create index if not exists certificates_student_idx on public.certificates (student_id);

-- Broaden read visibility so per-student certificates reach their owners. The
-- original policy was owner-only; now admins, the registration owner, approved
-- members of the school, AND the certified student themselves can read.
drop policy if exists "cert_owner_read" on public.certificates;
create policy "cert_owner_read" on public.certificates for select using (
  public.is_admin()
  or exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and (r.owner_id = auth.uid() or r.school_id in (select public.my_school_ids()))
  )
  or exists (
    select 1 from public.students s
    where s.id = certificates.student_id and s.auth_user_id = auth.uid()
  )
);
