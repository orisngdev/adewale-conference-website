// Delete every Sanity document of a given type. DESTRUCTIVE — run deliberately.
//
//   node --env-file=.env scripts/clear-sanity-docs.mjs sponsor
//   node --env-file=.env scripts/clear-sanity-docs.mjs result
//   node --env-file=.env scripts/clear-sanity-docs.mjs sponsor --dry-run
//
// Deleting is a mutation, so it needs a Sanity token with WRITE (Editor) access
// to THIS project — create one at sanity.io/manage → API → Tokens and set it as
// SANITY_WRITE_TOKEN. (SANITY_PROD_AUTH_TOKEN is tried as a fallback, but it may
// belong to a different project and 401.)
import { createClient } from "@sanity/client";

const type = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!type || type.startsWith("-")) {
  console.error("Usage: node --env-file=.env scripts/clear-sanity-docs.mjs <type> [--dry-run]");
  process.exit(1);
}

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env ${k}.`);
    process.exit(1);
  }
  return v;
};

const token = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_PROD_AUTH_TOKEN;
if (!token) {
  console.error("Need a Sanity WRITE token in SANITY_WRITE_TOKEN (Editor access to the project).");
  process.exit(1);
}

const client = createClient({
  projectId: need("NEXT_PUBLIC_SANITY_PROJECT_ID"),
  dataset: need("NEXT_PUBLIC_SANITY_DATASET"),
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  token,
  useCdn: false,
});

// Include drafts (drafts.<id>) as well as published docs.
const ids = await client.fetch(`*[_type == $type]._id`, { type });
console.log(`Found ${ids.length} "${type}" document(s)${ids.length ? ":" : "."}`);
for (const id of ids) console.log(`  - ${id}`);
if (!ids.length) process.exit(0);

if (dryRun) {
  console.log("\nDry run — nothing deleted. Re-run without --dry-run to delete.");
  process.exit(0);
}

let tx = client.transaction();
for (const id of ids) tx = tx.delete(id);
try {
  await tx.commit();
  console.log(`\n✅ Deleted ${ids.length} "${type}" document(s).`);
} catch (e) {
  console.error(`\n❌ Delete failed: ${e.message}`);
  console.error("If this is a reference error, delete the referring documents first.");
  process.exit(1);
}
