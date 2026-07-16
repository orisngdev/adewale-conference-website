-- Portal-native resource library: replaces authoring resources in Sanity. Admins
-- upload/manage study packs, past questions, syllabi, guides and links from the
-- portal. Files live in object storage (S3 today, provider-agnostic in app code)
-- keyed by `storage_key`; this table holds the metadata. Tiered access mirrors
-- the old model (public → accepted → qualified → finalist) and is enforced when
-- minting the download link, so locked files never reach the browser. Run after
-- editions (…05) and school_members (…06). Idempotent.

create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text,
  type         text,          -- past-question | study-guide | syllabus | video | external-link
  subject      text,
  level        text,          -- SS1 | SS2
  edition_year int,
  access       text not null default 'public'
                 check (access in ('public', 'accepted', 'qualified', 'finalist')),
  storage_key  text,          -- object key in the resource bucket (null = external / page-only)
  file_name    text,
  content_type text,
  external_url text,
  body         text,
  published    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists resources_published_idx on public.resources (published, type);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.resources enable row level security;
drop policy if exists resources_read        on public.resources;
drop policy if exists resources_admin_write on public.resources;

-- Any signed-in user reads PUBLISHED rows (the file itself is tier-gated at
-- download time — locked items are listed, never handed out). Admins see all,
-- including drafts.
create policy resources_read on public.resources for select to authenticated
  using (published or public.is_admin());
create policy resources_admin_write on public.resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
