-- A new "pdf" lesson kind for Labs: an uploaded document shown in an inline,
-- preview-only reader (never downloadable). The file lives in object storage
-- (same bucket as resources); the row keeps its key + original name.

-- Drop whatever CHECK constraint currently guards `kind` (its auto-generated
-- name may differ across environments), then add the widened one by a known name.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.lab_steps'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.lab_steps drop constraint %I', c);
  end loop;
end $$;

alter table public.lab_steps
  add constraint lab_steps_kind_check
  check (kind in ('lesson', 'video', 'link', 'quiz', 'pdf'));

alter table public.lab_steps
  add column if not exists storage_key text,
  add column if not exists file_name text;
