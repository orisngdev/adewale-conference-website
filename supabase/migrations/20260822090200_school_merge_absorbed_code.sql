-- Records the canonical code of an absorbed school, not just its row id.
--
-- The first merge only ever absorbed rows that had no code of their own, so the
-- survivor's code was the whole story. Two pairs turned out to be one school
-- holding two ASC- codes — ASERO HIGH SCHOOL, and PATTERSON MEMORIAL whose 2023
-- registration was filed under a person's name — and the zonal results are keyed
-- by code, so the absorbed code has to survive as an alias or those results attach
-- to nothing. Idempotent.

alter table public.school_merges
  add column if not exists absorbed_school_code text;

create index if not exists school_merges_absorbed_code_idx
  on public.school_merges (absorbed_school_code)
  where absorbed_school_code is not null;

comment on column public.school_merges.absorbed_school_code is
  'Canonical ASC- code the absorbed row carried, if any. Reads as an alias: this code now resolves to school_code.';
