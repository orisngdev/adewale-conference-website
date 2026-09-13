// One-off repair: retire the duplicate 2026 roster rows, and decline the one
// duplicate 2026 registration.
//
//   npx tsx --experimental-websocket --env-file=.env --tsconfig tsconfig.json \
//     scripts/cleanup-2026-roster-duplicates.ts [--apply]
//
// Background. registrations.reps is capped at 3 by the form, but nothing caps
// the students roster it provisions. Every write path (ensureRoster →
// provisionStudent, airtable-sync phase C, replacement approval, the
// coordinator's Students page) looks a rep up by exact lowercased name and
// INSERTS on a miss — and none of them retires a rep that dropped off the
// registration. So a re-spelled, re-ordered or re-registered name adds a row
// beside the old one instead of replacing it. Four 2026 schools drifted past 3.
//
// The rule applied here is the one the rest of the portal already assumes:
// a school's active roster for an edition is exactly its registration's reps.
// Every row below is a rep that is NOT in its registration's reps.
//
// Safety: nothing is deleted. deactivateStudent bans the auth user and stamps
// deactivated_at, keeping the row for audit — reversible by unbanning and
// clearing the stamp. Each target is re-read and matched on school + name +
// still-active before it is touched, so a stale id cannot retire the wrong
// student. Verified beforehand: none of these rows carries a single attempt,
// plan assignment, stage result, certificate or paper.
import { createAdminClient } from "@/supabase/admin";
import { deactivateStudent } from "@/lib/provision-student";

const APPLY = process.argv.includes("--apply");

/** A roster row to retire, with everything needed to prove it is the right one. */
interface Target {
  id: string;
  name: string;
  schoolCode: string;
  why: string;
}

const STUDENTS: Target[] = [
  {
    id: "99b5bd88-6f5a-4b46-aa9e-afd39c10395d",
    name: "IBRAHIM FAIZAH",
    schoolCode: "ASC-2FD147",
    why: "Duplicate of Ibrahim Faizah Olajumoke (14 Jul) — second registration asc-reg:2026:153",
  },
  {
    id: "93b793f2-50f8-47c6-b0b1-29e7dadf4baa",
    name: "GARUBA LATEEFAH ABIKE",
    schoolCode: "ASC-2FD147",
    why: "Duplicate of Garuba Lateefat Abike (14 Jul) — second registration asc-reg:2026:153",
  },
  {
    id: "a71214b8-e5a8-4df1-a34d-7eedeb493c17",
    name: "Taiwo Ewaoluwa",
    schoolCode: "ASC-53DF5C",
    why: "Not in reps; the sync added her 28 Jul beside Ewaoluwa Grace without retiring her",
  },
  {
    id: "c0f1137e-4732-4d34-a886-3ca281c874f2",
    name: "Ismael Mustapha",
    schoolCode: "ASC-74ECB5",
    why: "Re-provisioned 5 Aug 13:50 after the approved replacement retired him at 09:39",
  },
  {
    id: "65dda04c-0d8c-4fb1-aa2f-93a1dc8fe1c5",
    name: "Amoda AbdulMuiz Olasunkanmi",
    schoolCode: "ASC-FBDDEF",
    why: "Misspelt twin of Amuda AbdulMuiz Olasunkanmi, which the approved replacement created",
  },
];

// Same school, same coordinator, same three students — registered twice.
// Declined rather than deleted: the participants workspace filters on
// status='verified', and the airtable_id link must survive so the next sync
// updates this row instead of inserting a third. The sync's upsert payload
// deliberately excludes status, so the decline sticks.
const DUPLICATE_REGISTRATION = {
  id: "7833dcca-c6ca-4de2-ad28-3d16f17111ff",
  sourceKey: "asc-reg:2026:153",
  keep: "asc-reg:2026:75",
  schoolCode: "ASC-2FD147",
};

async function main() {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set.");

  console.log(APPLY ? "APPLYING changes.\n" : "DRY RUN — pass --apply to commit.\n");
  let retired = 0;
  let blocked = 0;

  for (const target of STUDENTS) {
    const { data, error } = await admin
      .from("students")
      .select("id, name, edition_year, deactivated_at, schools(school_code, name)")
      .eq("id", target.id)
      .maybeSingle();
    if (error) throw new Error(`read ${target.id}: ${error.message}`);

    const school = (data?.schools ?? null) as { school_code: string; name: string } | null;
    const mismatch =
      !data ? "row is gone"
      : data.name !== target.name ? `name is now "${data.name}"`
      : school?.school_code !== target.schoolCode ? `school is ${school?.school_code}`
      : data.edition_year !== 2026 ? `edition is ${data.edition_year}`
      : data.deactivated_at ? "already retired"
      : null;
    if (mismatch) {
      console.log(`SKIP  ${target.name} (${target.schoolCode}) — ${mismatch}`);
      blocked++;
      continue;
    }

    console.log(`RETIRE ${target.name} — ${school?.name}\n       ${target.why}`);
    if (APPLY) {
      const res = await deactivateStudent(admin, target.id);
      if (!res.ok) throw new Error(`retire ${target.name}: ${res.error}`);
    }
    retired++;
  }

  const { data: reg, error: regErr } = await admin
    .from("registrations")
    .select("id, source_key, status, edition_year, schools(school_code)")
    .eq("id", DUPLICATE_REGISTRATION.id)
    .maybeSingle();
  if (regErr) throw new Error(`read registration: ${regErr.message}`);

  const regSchool = (reg?.schools ?? null) as { school_code: string } | null;
  if (
    reg &&
    reg.source_key === DUPLICATE_REGISTRATION.sourceKey &&
    regSchool?.school_code === DUPLICATE_REGISTRATION.schoolCode &&
    reg.status === "verified"
  ) {
    console.log(
      `\nDECLINE registration ${reg.source_key} — duplicate of ${DUPLICATE_REGISTRATION.keep}`,
    );
    if (APPLY) {
      const { error } = await admin
        .from("registrations")
        .update({
          status: "declined",
          decline_reason: `Duplicate registration — this school is participating under ${DUPLICATE_REGISTRATION.keep}.`,
        })
        .eq("id", DUPLICATE_REGISTRATION.id);
      if (error) throw new Error(`decline registration: ${error.message}`);
    }
  } else {
    console.log(`\nSKIP  registration ${DUPLICATE_REGISTRATION.sourceKey} — no longer matches`);
    blocked++;
  }

  console.log(`\n${APPLY ? "Retired" : "Would retire"} ${retired} roster rows; ${blocked} skipped.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
