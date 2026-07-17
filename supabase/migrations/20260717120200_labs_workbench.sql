-- Per-lab "workbench": an optional embedded code-editor URL. When set, the lab
-- player shows a sticky editor drawer; when null, the lab is reading-only.
-- Backfills the future-tech lab with the Python IDE it used to hardcode.
-- Idempotent. Run after …120100_labs_seed_future_tech.sql.

alter table public.labs add column if not exists workbench_url text;

update public.labs
set workbench_url = 'https://trinket.io/embed/python3'
where slug = 'future-tech' and workbench_url is null;
