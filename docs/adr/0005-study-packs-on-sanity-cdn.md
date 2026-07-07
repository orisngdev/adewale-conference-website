# 0005 — Study-pack files on the Sanity CDN, not Supabase Storage or S3

The programme's study content is free and public (no paywall; the guide puts a download banner on the public homepage), so gating the file bytes buys nothing. Study packs therefore live on the existing Sanity `resource` documents' CDN — stable URLs, cheap bandwidth, already integrated, and cache-friendly for offline (no signed-URL expiry). Supabase holds only a `resource_downloads` log for a student's progress and admin analytics; admins upload via Sanity Studio (`/studio`).

## Considered options
- **Sanity CDN (chosen).** Zero new infrastructure, cheap egress, stable cacheable URLs.
- **Supabase Storage.** Limited free-tier egress and needless signed-URL machinery for public files.
- **AWS S3.** Real gating + scale, but a new vendor to stand up for content that doesn't need gating. Revisit only if specific materials must be truly access-controlled or scale demands it.
