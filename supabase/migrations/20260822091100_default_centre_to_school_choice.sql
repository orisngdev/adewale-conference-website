-- Adopt each school's own centre choice as its allocation, for the current edition.
--
-- Until now qualification_zone stayed NULL until an admin confirmed it, so every
-- team in an edition showed as "Confirm centre" even though the school had already
-- answered a required question with a valid centre. That is 161 confirmations of a
-- decision nobody disagreed with. New registrations now set the column at insert
-- time (see mirrorRegistrationToSupabase); this brings the rows already on file into
-- line so the two are not in different states.
--
-- Safe because of where the value comes from. The registration form validates this
-- answer against ZONAL_FINALS_OPTIONS, so it is always one of the eight real
-- centres — unlike the LGA fallback, which is what filled this column with LGAs and
-- division names historically and is deliberately NOT touched here.
--
-- Scope is narrow on purpose:
--   * only the current edition — older editions are read-only and their zone values
--     are the corrupted ones; they need a data decision, not a default
--   * only rows with no allocation, so an admin's decision is never overwritten
--   * only the modern 'Zonal Finals Location' key; earlier editions recorded the
--     answer under a different question and are left alone
--
-- The centre list below is a point-in-time copy for this one statement, NOT a second
-- source of truth: ZONAL_FINALS_OPTIONS in src/lib/forms.ts remains the only live
-- list, and public.allocate_qualification_zones still takes it as a parameter rather
-- than keeping its own. Idempotent.

update public.registrations r
set qualification_zone = r.details ->> 'Zonal Finals Location'
where r.qualification_zone is null
  and r.edition_year = (select max(year) from public.editions)
  and r.details ->> 'Zonal Finals Location' in (
    'Abeokuta', 'Ayetoro', 'Idiroko', 'Ifo', 'Ilaro', 'Ijebu Ode', 'Ota', 'Sagamu'
  );
