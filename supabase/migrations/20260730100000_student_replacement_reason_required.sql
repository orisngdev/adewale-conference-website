-- New replacement requests must explain why a registered student is being
-- swapped out. Preserve older optional requests with an explicit audit value
-- before making the field required.
update public.student_replacements
set reason = 'No reason recorded'
where reason is null or btrim(reason) = '';

alter table public.student_replacements
  alter column reason set not null,
  add constraint student_replacements_reason_required
  check (btrim(reason) <> '');
