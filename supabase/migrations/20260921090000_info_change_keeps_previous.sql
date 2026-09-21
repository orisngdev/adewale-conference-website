-- Approving a contact correction overwrote the old name with no copy of it, so
-- a wrong approval could not be undone: one school's educator name was replaced
-- by a sentence and the original is gone. Record what was there.
alter table public.info_change_requests
  add column if not exists previous_name  text,
  add column if not exists previous_phone text;

comment on column public.info_change_requests.previous_name is
  'The value replaced on approval, so a wrong one can be put back.';

-- One pending request per school per target. student_replacements already
-- refuses to stack duplicates; this table did not, and the same principal
-- change was filed and approved three times.
create unique index if not exists info_change_requests_one_pending
  on public.info_change_requests (registration_id, target)
  where status = 'pending';
