# Adewale Website

Marketing and registration website for `ASC 2026` built with `Next.js 15`, `React 19`, `TypeScript`, and Airtable-backed form submissions.

This repository contains:

- the public landing page
- the sponsorship enquiry form
- the school registration flow
- server routes that validate form submissions and write records to Airtable

## Stack

- `Next.js 15` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `sonner` for toast notifications
- `Airtable REST API` for persistence

## What The Site Does

The site is a single-page public experience composed of branded content sections:

- Hero
- About
- Impact
- Programme
- Dates
- Why Partner
- Sponsorship
- Founder
- Registration
- FAQ
- Footer

Two interactive flows submit data to Airtable:

1. `Sponsorship` form
2. `Register Your School` form

The registration flow also includes a school lookup endpoint that filters school names by LGA and school category.

## Project Structure

```text
src/
  app/
    api/
      registration/route.ts
      schools/route.ts
      sponsorship/route.ts
    globals.css
    layout.tsx
    page.tsx
    providers.tsx
  components/
    layout/
    sections/
    ui/
    ErrorBoundary.tsx
  contexts/
    ThemeContext.tsx
  lib/
    airtable.ts
    forms.ts
    utils.ts
public/
  assets/
docs/
  register-school-airtable-prd.md
  codebase-documentation.md
```

## Key Files

- [src/app/page.tsx](/src/app/page.tsx)
  Assembles the full landing page from section components.
- [src/app/layout.tsx](/src/app/layout.tsx)
  Root layout and metadata entrypoint.
- [src/app/providers.tsx](/src/app/providers.tsx)
  Wraps the app with the error boundary, theme provider, tooltip provider, and toaster.
- [src/components/sections/registration-modal.tsx](/src/components/sections/registration-modal.tsx)
  Main registration UI and client-side school lookup flow.
- [src/components/sections/sponsorship-section.tsx](/src/components/sections/sponsorship-section.tsx)
  Sponsorship enquiry form UI.
- [src/app/api/registration/route.ts](/src/app/api/registration/route.ts)
  Validates registration payloads and writes to Airtable.
- [src/app/api/schools/route.ts](/src/app/api/schools/route.ts)
  Returns school names filtered by LGA and category.
- [src/app/api/sponsorship/route.ts](/src/app/api/sponsorship/route.ts)
  Validates sponsorship submissions and writes to Airtable.
- [src/lib/airtable.ts](/src/lib/airtable.ts)
  Shared Airtable API helper.
- [src/lib/forms.ts](/src/lib/forms.ts)
  Shared form options, defaults, and TypeScript form shapes.

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

The app supports both server-only Airtable variables and the older `NEXT_PUBLIC_*` names. Server-only names are preferred.

Required:

```env
AIRTABLE_API_TOKEN=
AIRTABLE_BASE_ID=
AIRTABLE_PARTICIPANTS_TABLE_ID=
AIRTABLE_SPONSORSHIP_TABLE_ID=
AIRTABLE_SCHOOLS_TABLE_ID=
```

Legacy fallback names:

```env
NEXT_PUBLIC_AIRTABLE_API_TOKEN=
NEXT_PUBLIC_AIRTABLE_BASE_ID=
NEXT_PUBLIC_AIRTABLE_PARTICIPANTS_TABLE_ID=
NEXT_PUBLIC_AIRTABLE_SPONSORSHIP_TABLE_ID=
NEXT_PUBLIC_AIRTABLE_SCHOOLS_TABLE_ID=
```

See [.env.example](/.env.example).

## Airtable Tables

This codebase currently expects three Airtable tables:

- participants table
- sponsorship table
- school database table

The school database table is used by the new lookup flow and should contain:

- `School Name`
- `School Category`
- `School Local Government Area`

## API Routes

### `POST /api/registration`

Accepts the school registration payload, validates every field, and writes the participant record to Airtable.

If `schoolSource = "new"`, the route also checks the school database table and inserts the new school if no matching school already exists for the same name, category, and LGA.

### `GET /api/schools`

Query params:

- `lga`
- `category`

Returns matching schools from the school database Airtable table for dropdown rendering in the registration modal.

### `POST /api/sponsorship`

Accepts sponsorship enquiry data, validates it, and writes a sponsorship record to Airtable.

## Validation And Data Flow

- Client components submit JSON to App Router API routes.
- API routes sanitize and validate request payloads.
- Airtable writes are done server-side through `src/lib/airtable.ts`.
- Registration uses controlled inputs and a dependent school lookup flow:
  - select `School LGA`
  - select `School Category`
  - fetch matching schools
  - choose an existing school or enter a new one

## Scripts

- `npm run dev` starts local development
- `npm run build` builds the production app
- `npm run start` serves the production build
- `npm run lint` runs Next lint

## Current Known Issues

- `npm run build` currently fails because of existing ESLint issues in unrelated section components, mostly `react/no-unescaped-entities` and `<img>` warnings treated during the Next build.
- Registration submission currently logs an Airtable schema mismatch for the field name `Zonal Finals Location`. The participants table does not currently accept that exact field name, so the field mapping in [src/app/api/registration/route.ts](/src/app/api/registration/route.ts) needs to be aligned with the actual Airtable schema.
- Some display text in `src/lib/forms.ts` still contains encoding artifacts in sponsorship tier labels.

## Documentation

Additional documentation lives in:

- [AGENTS.md](/AGENTS.md) — how to work in this repo (`CLAUDE.md` points here)
- [docs/review-checklist.md](/docs/review-checklist.md) — what to check before
  declaring a change done
- [docs/adr/](/docs/adr/) — architectural decisions and their rejected
  alternatives
- [docs/codebase-documentation.md](/docs/codebase-documentation.md)
- [docs/register-school-airtable-prd.md](/docs/register-school-airtable-prd.md)

## Recommended Next Steps

1. Fix the Airtable field mapping mismatch in the registration route.
2. Clean up the existing lint errors blocking `next build`.
3. Normalize any remaining text encoding issues in UI copy.
4. Add automated tests for API route validation and Airtable mapping.
