-- Learning plans: an ordered checklist (no gating) a Coordinator assigns to their
-- school's Students, or an admin template. Modules → Items (assessment | material
-- | link | note). Assignments target a level and/or specific students, scoped to
-- an edition. Progress is per required item. Students read plans via the RPCs in
-- …018 (definer), so these tables are staff-manage at the RLS level. Idempotent.
-- Run after …016.

create table if not exists public.learning_plans (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  scope        text not null default 'school' check (scope in ('school','template')),
  school_id    uuid references public.schools on delete cascade,   -- null for templates
  edition_year int,
  subject      text,
  level        text,
  published    boolean not null default false,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists learning_plans_school_idx on public.learning_plans (school_id, edition_year);

create table if not exists public.plan_modules (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.learning_plans on delete cascade,
  title       text not null,
  description text,
  position    int not null default 0,
  due_date    date,
  created_at  timestamptz not null default now()
);
create index if not exists plan_modules_plan_idx on public.plan_modules (plan_id, position);

create table if not exists public.plan_module_items (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.plan_modules on delete cascade,
  position     int not null default 0,
  item_type    text not null check (item_type in ('assessment','material','link','note')),
  assessment_id uuid references public.assessments on delete set null,
  resource_id  text,                       -- Sanity resource _id for 'material'
  external_url text,                        -- for 'link'
  note_md      text,                        -- for 'note'
  title        text,
  required     boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists plan_module_items_module_idx on public.plan_module_items (module_id, position);

create table if not exists public.plan_assignments (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.learning_plans on delete cascade,
  edition_year  int,
  assignee_type text not null check (assignee_type in ('level','student')),
  school_id     uuid references public.schools on delete cascade,
  level         text,                        -- null = all levels (for assignee_type='level')
  student_id    uuid references public.students on delete cascade,
  assigned_by   uuid references auth.users on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists plan_assignments_plan_idx on public.plan_assignments (plan_id);
create index if not exists plan_assignments_school_idx on public.plan_assignments (school_id, edition_year);

create table if not exists public.plan_item_progress (
  id             uuid primary key default gen_random_uuid(),
  module_item_id uuid not null references public.plan_module_items on delete cascade,
  student_user_id uuid not null references auth.users on delete cascade,
  status         text not null default 'not_started'
                 check (status in ('not_started','in_progress','completed')),
  score          int,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (module_item_id, student_user_id)
);
create index if not exists plan_item_progress_student_idx on public.plan_item_progress (student_user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.learning_plans   enable row level security;
alter table public.plan_modules     enable row level security;
alter table public.plan_module_items enable row level security;
alter table public.plan_assignments enable row level security;
alter table public.plan_item_progress enable row level security;

-- Plans: admins all; coordinators manage their own school's (templates are admin-only).
drop policy if exists "learning_plans_manage" on public.learning_plans;
create policy "learning_plans_manage" on public.learning_plans for all
  using (public.is_admin() or school_id in (select public.my_school_ids()))
  with check (public.is_admin() or school_id in (select public.my_school_ids()));

-- Modules / items: manage if the parent plan is manageable.
drop policy if exists "plan_modules_manage" on public.plan_modules;
create policy "plan_modules_manage" on public.plan_modules for all
  using (public.is_admin() or exists (
    select 1 from public.learning_plans lp
    where lp.id = plan_modules.plan_id and lp.school_id in (select public.my_school_ids())))
  with check (public.is_admin() or exists (
    select 1 from public.learning_plans lp
    where lp.id = plan_modules.plan_id and lp.school_id in (select public.my_school_ids())));

drop policy if exists "plan_module_items_manage" on public.plan_module_items;
create policy "plan_module_items_manage" on public.plan_module_items for all
  using (public.is_admin() or exists (
    select 1 from public.plan_modules pm
    join public.learning_plans lp on lp.id = pm.plan_id
    where pm.id = plan_module_items.module_id and lp.school_id in (select public.my_school_ids())))
  with check (public.is_admin() or exists (
    select 1 from public.plan_modules pm
    join public.learning_plans lp on lp.id = pm.plan_id
    where pm.id = plan_module_items.module_id and lp.school_id in (select public.my_school_ids())));

-- Assignments: admins all; coordinators for their own school.
drop policy if exists "plan_assignments_manage" on public.plan_assignments;
create policy "plan_assignments_manage" on public.plan_assignments for all
  using (public.is_admin() or school_id in (select public.my_school_ids()))
  with check (public.is_admin() or school_id in (select public.my_school_ids()));

-- Progress: student self read/write; coordinators/admins read their students'.
drop policy if exists "plan_item_progress_self"       on public.plan_item_progress;
drop policy if exists "plan_item_progress_staff_read" on public.plan_item_progress;
create policy "plan_item_progress_self" on public.plan_item_progress for all
  using (student_user_id = auth.uid()) with check (student_user_id = auth.uid());
create policy "plan_item_progress_staff_read" on public.plan_item_progress for select using (
  public.is_admin() or student_user_id in (
    select auth_user_id from public.students where school_id in (select public.my_school_ids())));
