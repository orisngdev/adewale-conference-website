// Run the Airtable → portal sync directly against a Supabase project — no
// serverless timeout, works even if the site is down. Used by the scheduled
// GitHub Action; handy manually too:
//
//   npx tsx --experimental-websocket --env-file=.env --tsconfig tsconfig.json scripts/sync-airtable.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// AIRTABLE_API_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_PARTICIPANTS_TABLE_ID,
// AIRTABLE_SCHOOLS_TABLE_ID.
import { describeSyncSummary, syncAirtableToPortal } from "@/lib/airtable-sync";

async function main() {
  const summary = await syncAirtableToPortal();
  console.log(JSON.stringify(summary, null, 2));
  console.log(describeSyncSummary(summary));
  if (summary.errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
