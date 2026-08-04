-- Whether a resource file may be downloaded. When false, the portal shows a
-- preview-only reader instead of a download link (PDFs render inline in a
-- canvas viewer; other document types open inline in the browser). Defaults to
-- true so every existing resource keeps its current download behavior.
alter table public.resources
  add column if not exists downloadable boolean not null default true;
