# Review checklist

For anyone — human or agent — changing this codebase. It is written against
what this repo actually is: Next.js App Router + React Server Components,
Supabase/Postgres with RLS, Server Actions, `node:test` via `tsx`.

Every item below is here because it went wrong at least once. The worked cases
are real.

---

## 0. Baseline first

Before you can claim "no regressions" you need to know what was already red.

- [ ] Run the suite **before** changing anything, or `git stash push -u -- src/
      supabase/` and run it, and write the numbers down.
- [ ] Compare after. Only _new_ reds are yours.
- [ ] Report pre-existing failures as pre-existing, with the count — don't fix
      them silently, and don't let them hide your own.

```bash
git stash push -u -- src/ supabase/
npm test && npx tsc --noEmit     # write these down
git stash pop
```

`npm test` globs `src/lib/*.test.ts` **only**. Nothing under `src/app` or
`src/components` is covered, so logic you want tested has to live in `src/lib`.

`npx eslint` fails repo-wide on a config error and has for a long time.
`npx tsc --noEmit` is the real gate.

---

## 1. Security

RLS is this project's tenant scope. The equivalent mistakes all live there.

- [ ] **Every new table has RLS enabled and a policy in both directions.** A
      table with RLS on and no SELECT policy reads as empty, which looks like
      "no data" rather than "no access".
- [ ] **A policy that queries another table hits that table's RLS too.** That is
      why `my_school_ids()` is `SECURITY DEFINER`. A policy calling a plain SQL
      helper silently returns nothing.
- [ ] **Every `SECURITY DEFINER` function carries its own guard.** It bypasses
      RLS and is reachable at `/rest/v1/rpc/<name>` with any authenticated
      token — the app-layer `requireManage()` does not protect that path.
      Precedent: `20260822091000_module_permission_guards.sql`.
- [ ] **`set search_path = public` on every `SECURITY DEFINER` function**, plus
      `revoke all … from public, anon` and `grant execute … to authenticated`.
- [ ] **An id validated earlier is not a scope.** If a follow-up query takes an
      id from the request, re-derive the owning scope and re-check it. Say so in
      a comment when an id genuinely came from an already-checked query.
- [ ] **Know which of the two memberships you mean.** `my_school_ids()` is
      approved `school_members` — coordinators and teachers. A code-login
      **student is not a school member**; they are linked by
      `students.auth_user_id`. A rule written with only the first silently
      excludes every rep, and one written with only the second excludes every
      coordinator.
- [ ] **Widening a table policy exposes the whole row.** Letting reps read
      `registrations` to reach a score would also hand them `details` — the
      registration form's contact email and phone. Prefer an RPC that returns
      only the fields in question. Worked case: `get_my_school_results()`.
- [ ] **Admin routes are gated twice** — `requireModuleView` / `requireManage`
      on the page or action, and a `ROUTE_MODULES` prefix in
      `src/lib/admin-permissions.ts`. Check the new prefix doesn't collide with
      an existing one in either direction (`/portal/admin/papers` vs
      `/portal/admin/paper-exams`).
- [ ] **A new permission module key is a breaking change** — `getAdminPermissions`
      fills unknown keys with `"none"` for every stored map, silently revoking
      access. Reuse an existing module.
- [ ] **Never put an access code anywhere it can leak.** The access code **is**
      the auth password for code-login students (`src/lib/student-accounts.ts`).
      It does not belong in an export, a third-party upload, or a printed sheet.
- [ ] **Nothing sensitive in logs or in a public repo** — tokens, access codes,
      and real student or school names in code comments and test fixtures. Use
      the repo's fictional fixtures.

## 2. Scalability

- [ ] **No N+1.** One query for a page of ids, never one per row.
- [ ] **`.in()` lists are chunked.** PostgREST puts the list in the URL; ~600
      UUIDs is ~19KB and the request does not survive. Use `chunk()` from
      `src/lib/batch.ts` at 100 and `Promise.all` the pages.
- [ ] **Unfiltered reads get truncated, not errored.** Past the project's Max
      rows setting PostgREST drops the tail silently, and a partially-listed
      edition is indistinguishable from a small one. Scope by edition, or page.
- [ ] **Fan-out joins.** A `LEFT JOIN` on a non-unique key multiplies the parent
      row. All silent: `SUM()` double-counts, a list shows someone twice, a
      filter matches an arbitrary duplicate. Before joining, ask what constraint
      makes the key unique — and check it says what you assumed. Worked case:
      `unique (edition_year, stage, title)` on `paper_exams` lets two exams share
      an edition and stage, so joining papers by `edition + stage` duplicated
      every rep. Pin to one exam id.
- [ ] **Dedupe before an upsert.** `ON CONFLICT` cannot touch the same row twice
      in one statement — the whole batch fails. Dedupe by conflict key, *then*
      `chunk()`. Worked case: a 491-row import lost its third batch of 91 rows
      and silently skipped the redirect.
- [ ] **Embedded counts are one query, not several.** `select=…,children(count)`
      beats a follow-up per parent, and an embedded filter
      (`.eq("children.version", "A")`) applies before the count.

## 3. Correctness / regressions

- [ ] **Check `error` on every Supabase call.** `const { data } = await …`
      throws away the reason and turns a migration you forgot to push into an
      empty page or a 404. Worked case: "I click Create and nothing happens" was
      a `PGRST204` for a column that existed only in the migration file.
- [ ] **A form action must return a rendered result.** React resets an
      uncontrolled form when the action completes, so a rejected submit that
      returns nothing looks exactly like a wipe. Use `ActionForm` /
      `ActionResult`, and controlled inputs where the user typed a lot.
- [ ] **Edition scope is part of the key, not decoration.** A student row is
      **retagged** into the next edition, not duplicated, so it keeps every past
      year's `student_stage_results`. `(student_id, stage, edition_year)` is the
      key for that reason. Matching on `stage` alone shows last year's score as
      this year's — use `resultForStage()`. The same applies to any index keyed
      by stage.
- [ ] **A stored status drifts; derive it.** `paper_exams.status` only ever moves
      once, so rendering it raw reported "draft" on a fully graded exam. If a
      label can be computed from facts, compute it — see `paperExamPhase()`.
- [ ] **`numeric` columns may arrive as strings.** Coerce with `Number()` before
      arithmetic, `===`, or `Map.get`.
- [ ] **Behaviour changes are named out loud**, even when they are improvements.
      Tightening a guard changes which rows a filter returns.
- [ ] **Migrations are additive and idempotent** — `create table if not exists`,
      `drop policy if exists` before each create, `add column if not exists`,
      `create or replace function`. They must be safe against a partly-applied
      database.
- [ ] **The migration filename's timestamp must be unique.** `schema_migrations`
      is keyed on the version alone, so two files sharing one timestamp collide:
      the first applies and records, the second runs, fails on
      `schema_migrations_pkey` and **rolls back**. Check `ls supabase/migrations`
      for the version before naming a file, or use `npm run db:new <slug>`.
      Recovering means renaming the file that did NOT record — renaming the
      recorded one instead makes the other look applied and it is skipped for
      good.
- [ ] **Never edit an applied migration.** `supabase db push` will not replay it,
      so the file and the database diverge and the app reads a column that isn't
      there. Add a new migration instead, and say which environments still need
      it.
- [ ] **Tests exist proportional to blast radius**, and each new test has been
      **watched go red** without the fix. A test written alongside the code it
      tests is characterization, not regression — say which you wrote.

## 4. Maintainability & DRY

- [ ] **Reuse before adding.** Search first: `chunk` / `mapLimit`
      (`src/lib/batch.ts`), `parseCsvGrid` / `toCsv` (`src/lib/csv.ts`),
      `percent` / `rankBy` / `applyCutoff` (`src/lib/paper-exam.ts`),
      `resultForStage` / `withPaperLinks` / `PAPER_BASE` (`src/lib/paper-results.ts`),
      `normalizeSchoolName` (`src/lib/school-identity.ts`), `bulkDecisionSummary`
      (`src/lib/registration-decision.ts`), `canViewModule` / `requireManage`
      (`src/supabase/auth.ts`).
- [ ] **Decisions go in `src/lib/`**, not inline in a page or a `"use server"`
      file — that is the only code `npm test` can reach.
- [ ] **One definition per rule.** If the same rule exists twice, the two will
      disagree. Worked case: "the key is complete" meant *items across all
      copies* on the list page and *copy A exactly* on the detail page. When a
      rule exists in both TS and SQL (`gradePaper` and `grade_paper()`), say so
      at both sites and test that they agree.
- [ ] **Same bug in sibling paths.** A gap in a list query is usually also in the
      export, the stats query and the detail page. Fix the set, or they disagree.
- [ ] **Don't make callers hold an invariant** they can get silently wrong —
      encode it. Four hardcoded `/portal/results/paper/…` strings became
      `PAPER_BASE`.
- [ ] **`normalizeSchoolName` is index-locked** by `npm run check:normalizers`
      (TS, SQL and the canonical scripts must agree). Adding a normalizer is
      fine; editing that one is not.
- [ ] **Comment density low.** One or two lines where a reader would otherwise
      ask "why is it like this": a non-obvious constraint, a bug being
      prevented, a rejected alternative. Never restate the code, never narrate
      the next line. If the comment is longer than the code it introduces, it is
      an ADR or a commit message, not a comment. Applies to migrations too.
      Re-read your own diff for this before declaring done — it is the single
      most frequent note on this repo's changes.
- [ ] **Match the surrounding file** — camelCase in TS, snake_case in SQL.

## 5. Route and shell placement

- [ ] **A drill-down page belongs under the section the reader came from.**
      `src/app/(portal)/portal/results/*` renders in the bare portal shell — top
      nav only, no sidebar. Student, coordinator and admin each get their own route rendering
      one shared component; the route picks the shell, the RPC decides access.
- [ ] **Every detail page has a way back.** No sidebar and no back link is a
      dead end.

## 6. Before declaring done

- [ ] `npx tsc --noEmit` clean. (Stale `.next/types` errors about a deleted route
      clear after one `npm run build`.)
- [ ] `npm test` — new-vs-pre-existing reds separated and reported.
- [ ] `npm run check:normalizers` if anything near school naming moved.
- [ ] `npm run build` compiles, and new routes appear in its route list.
- [ ] **Unrun migrations called out explicitly, per environment.**
- [ ] **Risky changes stay uncommitted until the owner has tested them.**
- [ ] A verification path someone else can follow — the page to open, or the
      read-only SQL to run.
- [ ] Commits: short, descriptive, **no `Co-Authored-By` trailer**, and scanned
      for real names and secrets first — this is a public repo.

---

## Environment hazards

- **There are three databases.** `.env` points at the dev Supabase project,
  `.env.prod` at production, and the Supabase CLI keychain token reaches a
  *different* personal project. **Read `.env` before running anything** — do not
  assume which project a script, a migration or an RPC call will hit.
- **Prod is reachable read-only from this machine** via `psql "$SUPABASE_DB_URL"`
  with `.env.prod`. Use it to verify; never to write.
- **Migrations are the owner's to run.** `npm run db:push` (dev) and
  `npm run db:push:prod`. Write the file, say it needs pushing, and stop.
- `psql -F'\t'` writes a literal backslash-t. Use
  `copy (…) to stdout with (format csv)` for machine-readable output.
