-- A reason an admin can attach when declining a registration. It's shown to the
-- school on their portal and included in the decline email, so the educator knows
-- what to fix (e.g. "no female representative") before resubmitting for review.
alter table public.registrations
  add column if not exists decline_reason text;
