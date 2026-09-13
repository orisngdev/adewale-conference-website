# Contributing

## Overview

This repository contains the public `ASC 2026` website, including the landing page, sponsorship enquiry flow, and Airtable-backed school registration flow.

Contributions should preserve three things:

- visual consistency with the existing brand
- safe server-side handling of Airtable writes
- predictable, typed form behavior

## Before You Start

Make sure you can run the project locally:

```bash
npm install
npm run dev
```

Read these files first:

- [README.md](/README.md)
- [docs/codebase-documentation.md](/docs/codebase-documentation.md)
- [docs/register-school-airtable-prd.md](/docs/register-school-airtable-prd.md)

## Environment Setup

Create a local env file from the example:

```bash
cp .env.example .env.local
```

Required Airtable variables:

```env
AIRTABLE_API_TOKEN=
AIRTABLE_BASE_ID=
AIRTABLE_PARTICIPANTS_TABLE_ID=
AIRTABLE_SPONSORSHIP_TABLE_ID=
AIRTABLE_SCHOOLS_TABLE_ID=
```

Legacy `NEXT_PUBLIC_AIRTABLE_*` variables are still supported by the helper, but new work should prefer server-side `AIRTABLE_*` names.

## Branching

Use a short, descriptive branch name:

```text
feat/school-lookup
fix/registration-airtable-mapping
docs/codebase-readme
```

## Project Conventions

## Tech conventions

- Use `TypeScript`.
- Keep imports using the `@/` alias where appropriate.
- Prefer small local helpers over repeating validation logic inline.
- Keep Airtable access inside `src/lib/airtable.ts` and route handlers.

## UI conventions

- Match the current visual language before introducing new patterns.
- Keep form state controlled and explicit.
- Preserve responsive behavior on mobile and desktop.
- Avoid changing section ordering or navigation anchors unless the task requires it.

## API conventions

- Validate all incoming request data server-side.
- Never trust client-submitted enums without checking them against allowed options.
- Return clear `400` messages for validation failures.
- Keep Airtable tokens server-side.

## File Placement

Use these guidelines when adding code:

- `src/components/sections`
  Homepage sections and major page-level UI blocks
- `src/components/layout`
  Navbar, layout shell, mobile menu
- `src/components/ui`
  Small reusable UI primitives
- `src/app/api`
  Server endpoints
- `src/lib`
  Shared helpers, constants, form shapes, Airtable helpers
- `docs`
  Product and technical documentation

## Working On Forms

When changing registration or sponsorship flows:

1. Update shared defaults and options in `src/lib/forms.ts` if needed.
2. Update the client component state and UI.
3. Update the related API route.
4. Verify Airtable field mappings against the real table schema.
5. Test both success and failure paths.

For registration specifically:

- `schoolLGA` and `schoolCategory` drive school lookup
- `schoolSource` distinguishes existing vs newly entered schools
- new schools may create records in the Airtable school database table

## Airtable Safety

Be careful when changing Airtable mappings.

- Airtable field names must match the real table schema exactly.
- A mismatched field name will fail the whole request.
- If you change a field mapping in code, update the docs.
- Prefer checking the actual table schema before renaming or adding mapped fields.

## Documentation Expectations

If your change affects behavior, update the relevant docs in the same PR.

Examples:

- new env vars
- new API routes
- changed Airtable table requirements
- changed form flow
- known limitations or blockers

At minimum, consider whether you need to update:

- `README.md`
- `docs/codebase-documentation.md`
- feature-specific PRDs in `docs/`

## Testing And Verification

Work through [docs/review-checklist.md](/docs/review-checklist.md) before
opening a PR — it covers RLS scope, migrations, the Supabase gotchas, and how to
establish a test baseline so you can tell your own failures from pre-existing
ones. [AGENTS.md](/AGENTS.md) is the short version.

Minimum checks before opening a PR:

```bash
npx tsc --noEmit
npm test
```

If your change affects runtime behavior, also test it manually in the browser.

Useful commands:

```bash
npm run dev
npx tsc --noEmit
npm run build
```

Note:

- `npm run build` may currently fail because of pre-existing lint issues unrelated to your change.
- If your work is correct but blocked by existing repo issues, call that out clearly in the PR.

## Pull Request Guidance

A good PR should include:

- what changed
- why it changed
- any Airtable schema assumptions
- how it was tested
- any follow-up work still needed

If the change affects forms or Airtable writes, include:

- request/response behavior
- field mapping changes
- screenshots if UI changed

## Commit Guidance

Prefer small, scoped commits with clear messages:

```text
feat: add Airtable school lookup endpoint
fix: align registration payload with Airtable schema
docs: add codebase documentation
```

## Known Repo Caveats

- Some section components currently fail lint because of unescaped entities.
- Some UI text contains encoding artifacts.
- Registration currently has a known Airtable field mismatch around `Zonal Finals Location` until the mapping is aligned with the participants table.

Do not hide these issues in a PR. Document them if they affect your work.

## Questions To Resolve Before Merging

Pause and clarify before merging if your change introduces uncertainty around:

- Airtable schema compatibility
- production env requirements
- section navigation changes
- new copy that changes product meaning
- data retention or validation behavior
