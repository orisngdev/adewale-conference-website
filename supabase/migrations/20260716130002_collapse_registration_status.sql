-- Registration status now records ONLY the acceptance decision:
--   submitted → verified (approved) / declined
-- Competition progress ("qualified", "finalist") moves to the stage-results
-- tables, where it drives both advancement and — derived from how far a school
-- advanced — resource-tier unlocks. Collapse any legacy qualified/finalist rows
-- back to verified (they were accepted); progress is re-marked on the participant
-- hub going forward. status is a plain text column, so this is a data migration,
-- not an enum alter. Idempotent.

update public.registrations
set status = 'verified'
where status in ('qualified', 'finalist');
