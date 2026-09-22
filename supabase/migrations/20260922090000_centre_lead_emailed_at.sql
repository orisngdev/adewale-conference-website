-- When a centre lead was last sent their register link. Idempotent.
--
-- Coordinating forty people the night before, "who have I already told" is the
-- question being asked, and without a stamp the only answers are the admin's
-- memory and their sent folder.

alter table public.centre_leads
  add column if not exists last_emailed_at timestamptz;
