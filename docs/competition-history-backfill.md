# Competition History Backfill

This backfill imports historical competition data from the ASC PMO Google Sheet
into the portal. The spreadsheet is treated as read-only.

## Source Tabs

Registration sources:

- `2022 Registration`
- `2023 Registration`
- `2024 Registration`
- `2025 Registration`

Qualification sources:

- `2022 Zonal Finals result`
- `2023 ZF Ranking`
- `2024 - ZF Result`
- `ADEWALE 2025 Results`

Group-stage sources:

- `2023 Group Table Live`
- `2024 Group Table Live`

## Imported Data

The first backfill slice imports:

- schools
- verified historical registrations
- registration reps as students
- `Qualifications` results
- `Grand Finale Group Stage` groups
- group assignments, ranks, scores, and top-two advancement results

Knockout matches, face-offs, and individual awards are intentionally excluded
from the first slice unless a later review confirms explicit team, score, and
winner data.

## Idempotency

Historical registrations are keyed with deterministic external IDs in
`registrations.airtable_id`:

```txt
sheet:asc-history:<year>:<source-tab>:row:<source-row>
```

The script is safe to re-run. It defaults to dry-run and writes only when passed
`--apply`.

## The script is gone

`scripts/backfill-competition-history.mjs` and its four
`backfill:competition:*` npm scripts were deleted once the backfill had run —
it was a one-time import, and a one-time importer left lying around is a loaded
gun pointed at prod. The idempotency key above is the durable part: it records
how a re-import would recognise rows it had already written, so this document
is enough to rebuild the script if the sheet ever needs replaying.
