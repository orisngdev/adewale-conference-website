# 0006 — Portal-native Resources on S3 with per-Resource access tiers and audience (supersedes 0005)

The programme now publishes **competition materials that must be gated** — the official guidelines are for **Accepted** schools, and later material is staged to **Qualified** and **Finalist** schools as they progress. ADR-0005's premise ("all study content is free and public, so gating buys nothing") no longer holds, which is exactly the condition 0005 named for revisiting it. Two forces also pushed authoring out of Sanity Studio: admins wanted to manage Resources **inside the portal** (upload, tier, publish, delete) without a second tool, and each Resource needs a per-item **Access tier** and **Audience** that Sanity's public CDN URLs can't enforce.

Resources therefore move to a portal-native library: metadata in a Supabase `resources` table, files in **object storage behind a provider-agnostic seam** (S3 today, swappable), served through **short-lived signed download links** minted only after a server-side tier check. Each Resource carries an **Access tier** (public → accepted → qualified → finalist, mirroring the Registration status) and an **Audience** (student / coordinator / both). Study Packs stay free and public — they are simply the public-tier, student-audience Resources — so nothing is lost for the material that never needed gating; the `resource_downloads` log still powers Progress and analytics.

## Considered options
- **Portal-native Resources on S3, per-item tier + audience (chosen).** One in-portal admin surface; genuinely access-controlled competition material; the storage backend sits behind a seam so a later move (Supabase Storage, R2) is a one-file change.
- **Stay on the Sanity CDN (ADR-0005).** Zero infrastructure, but public URLs can't gate the guidelines, and authoring stays in a separate tool.
- **Supabase Storage instead of S3.** Same model, but the free-tier egress ceiling is a real risk for a library many schools download from, and the org already runs AWS.

## Notes
- Env: `RESOURCE_S3_*` (Netlify reserves the bare `AWS_*` names; the old names remain a local-dev fallback).
- **Migration still pending:** the public `/resources` marketing pages and the Learning-Plan material picker still read Sanity; `scripts/import-sanity-resources.mjs` backfills the existing Sanity Resources into the new store, after which the Sanity `resource` type is retired.
