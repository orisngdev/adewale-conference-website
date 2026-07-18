-- Seed an example pitch challenge so the multi-type arena has content out of the
-- box. A pitch challenge has no metric/ground-truth — students submit a saved
-- copy of their Pitch Studio canvas, which admins score. Idempotent (on conflict
-- do nothing). Run after …130000_challenge_types.sql (needs the `type` column
-- and the now-nullable `metric`).

insert into public.challenges (slug, title, type, description_md, deadline, edition_year, published)
values (
  'pitch-ogun-2026',
  'Pitch for Ogun 2026',
  'pitch',
  $md$## The challenge
Find a real problem in your community — water, waste, transport, power, health,
or education — and design a **business that solves it**. Your Business Model
Canvas is your entry.

## What to submit
Fill in all nine blocks of your canvas in the **Pitch Studio**, then come back
here and submit it as your entry. We save a copy as it is now — you can resubmit
until the deadline, and the latest version is the one we judge.

## How judges score it
- **Problem** — is it a real, clearly-described local problem?
- **Solution** — does the value proposition actually solve it?
- **Feasibility** — could a student team realistically run this?
- **Originality** — a fresh angle, not a copy of an existing service

## Tips
- Talk to real people affected by the problem before you design
- Keep each canvas note short and specific
- Make the money story clear: who pays, and for what?$md$,
  '2026-08-30 23:59:00+01',
  2026,
  true
)
on conflict (slug) do nothing;
