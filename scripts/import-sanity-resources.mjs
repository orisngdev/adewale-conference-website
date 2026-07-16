// One-off: import existing Sanity "resource" documents into the portal-native
// resources table + object storage (S3). Idempotent by Sanity _id (stored in
// slug suffix) — safe to re-run; it skips resources already imported.
//
// Run AFTER `npm run db:push` (creates the resources table) and after the AWS
// env vars are set:
//   node --env-file=.env scripts/import-sanity-resources.mjs
//
// Needs: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
// NEXT_PUBLIC_SANITY_API_VERSION, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.

import { createClient as createSanity } from "@sanity/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env ${k}. Run with: node --env-file=.env scripts/import-sanity-resources.mjs`);
    process.exit(1);
  }
  return v;
};

// Prefer the RESOURCE_S3_* names (Netlify reserves the bare AWS_* names); fall
// back to AWS_* for local dev.
const needS3 = (suffix) => {
  const v = process.env[`RESOURCE_S3_${suffix}`] || process.env[`AWS_${suffix}`];
  if (!v) {
    console.error(`Missing env RESOURCE_S3_${suffix} (or AWS_${suffix}).`);
    process.exit(1);
  }
  return v;
};

const sanity = createSanity({
  projectId: need("NEXT_PUBLIC_SANITY_PROJECT_ID"),
  dataset: need("NEXT_PUBLIC_SANITY_DATASET"),
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  useCdn: true,
  // Only send a token if it matches this project host; a public (published)
  // dataset reads fine anonymously, and a mismatched token 401s.
  ...(process.env.SANITY_IMPORT_TOKEN ? { token: process.env.SANITY_IMPORT_TOKEN } : {}),
});

// Talk to Supabase over PostgREST directly (avoids supabase-js needing a
// WebSocket global on Node < 22).
const SB_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const SB_KEY = need("SUPABASE_SECRET_KEY");
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const supabase = {
  async selectSlugs() {
    const r = await fetch(`${SB_URL}/rest/v1/resources?select=slug`, { headers: sbHeaders });
    return r.ok ? { data: await r.json() } : { data: [], error: `${r.status} ${await r.text()}` };
  },
  async insert(row) {
    const r = await fetch(`${SB_URL}/rest/v1/resources`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    return r.ok ? {} : { error: `${r.status} ${await r.text()}` };
  },
};

const bucket = process.env.RESOURCE_S3_BUCKET || process.env.AWS_S3_BUCKET;
if (!bucket) {
  console.error("Missing env RESOURCE_S3_BUCKET (or AWS_S3_BUCKET).");
  process.exit(1);
}
const s3 = new S3Client({
  region: needS3("REGION"),
  credentials: {
    accessKeyId: needS3("ACCESS_KEY_ID"),
    secretAccessKey: needS3("SECRET_ACCESS_KEY"),
  },
});

const slugify = (title, suffix) =>
  `${(title || "resource").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "resource"}-${suffix}`;

async function main() {
  const docs = await sanity.fetch(`*[_type == "resource"]{
    _id, title, "slug": slug.current, type, subject, level, access, body, externalUrl,
    "fileUrl": file.asset->url, "fileName": file.asset->originalFilename,
    "mimeType": file.asset->mimeType, "editionYear": edition->year
  }`);
  console.log(`Found ${docs.length} Sanity resource(s).`);

  // Skip ones already imported (slug suffix carries the Sanity _id tail).
  const { data: existing } = await supabase.selectSlugs();
  const importedTails = new Set((existing ?? []).map((r) => (r.slug || "").split("-").pop()));

  let created = 0;
  let skipped = 0;
  for (const d of docs) {
    if (!d.title) continue;
    const tail = String(d._id).slice(-6);
    if (importedTails.has(tail)) {
      skipped++;
      continue;
    }

    let storageKey = null;
    let fileName = d.fileName ?? null;
    let contentType = d.mimeType ?? null;
    if (d.fileUrl) {
      try {
        const res = await fetch(d.fileUrl);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        const safe = (fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
        storageKey = `${randomUUID()}/${safe}`;
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: bytes,
          ...(contentType ? { ContentType: contentType } : {}),
        }));
      } catch (e) {
        console.warn(`  ! file for "${d.title}" failed (${e.message}) — importing metadata only`);
        storageKey = null;
      }
    }

    const { error } = await supabase.insert({
      title: d.title,
      slug: slugify(d.title, tail),
      type: d.type ?? null,
      subject: d.subject ?? null,
      level: d.level ?? null,
      edition_year: d.editionYear ?? null,
      access: d.access ?? "public",
      storage_key: storageKey,
      file_name: fileName,
      content_type: contentType,
      external_url: d.externalUrl ?? null,
      body: typeof d.body === "string" ? d.body : null,
      published: true,
    });
    if (error) {
      console.error(`  x insert "${d.title}": ${error.message}`);
      continue;
    }
    created++;
    console.log(`  ✓ ${d.title}${storageKey ? " (file)" : d.externalUrl ? " (link)" : ""}`);
  }

  console.log(`Done. ${created} imported, ${skipped} already present.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
