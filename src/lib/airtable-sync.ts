import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";
import { makeAccessCode } from "@/lib/provision-student";
import { studentAuthEmail } from "@/lib/student-accounts";
import {
  type AirtableRecord,
  type SchoolRecordFields,
  getParticipantsTableId,
  getSchoolDatabaseTableId,
  listAirtableRecords,
} from "@/lib/airtable";
import { airtableCreatedAt } from "@/lib/airtable-created-at";
// Shared with public.school_norm_name and the canonical scripts. This local copy
// used to omit the "&" rule, which now disagrees with schools_norm_name_key.
import { normalizeSchoolName } from "@/lib/school-identity";

// One-way sync: Airtable → Supabase portal mirror.
//
// Airtable is NO LONGER the source of truth for school identity. The reconciled
// 2022-2026 workbooks are: they assign every school a canonical ASC- code, held in
// schools.school_code, and migration 20260822090100 enforces one row per normalized
// name. So this sync must never rewrite the name, LGA or category of a school that
// carries a school_code — it fills gaps and links airtable_id, nothing more. Before
// that rule existed, one run would have reverted all 534 canonical names to whatever
// spelling Airtable happened to hold.
// Idempotent — keyed by airtable_id on both schools and registrations, so it
// doubles as the historical backfill and the ongoing refresh. Never sends
// email and never touches admin-owned registration state (status, owner,
// claim/verify tokens) on rows that already exist. Airtable registration
// creation time is mirrored into registrations.created_at so analytics reflect
// submission time rather than sync/import time.
//
// All database work is BATCHED (a steady-state run is ~a dozen round-trips,
// not one per row) so the sync also completes within a serverless function's
// timeout — the admin button and /api/sync-airtable run on Netlify functions.

type ParticipantFields = Record<string, string>;

export interface AirtableSyncSummary {
  schoolsCreated: number;
  schoolsLinked: number;
  registrationsCreated: number;
  registrationsUpdated: number;
  registrationsAdopted: number;
  duplicatesSkipped: number;
  studentsProvisioned: number;
  errors: string[];
}

interface DbSchool {
  id: string;
  name: string | null;
  lga: string | null;
  category: string | null;
  airtable_id: string | null;
  school_code: string | null;
}

interface DbRegistration {
  id: string;
  airtable_id: string | null;
  school_id: string | null;
  edition_year: number;
  contact_email: string | null;
}

function makeClaimCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await fn(items[index]);
      }
    }),
  );
}

export async function syncAirtableToPortal(): Promise<AirtableSyncSummary> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured (SUPABASE_SECRET_KEY).");
  }

  const summary: AirtableSyncSummary = {
    schoolsCreated: 0,
    schoolsLinked: 0,
    registrationsCreated: 0,
    registrationsUpdated: 0,
    registrationsAdopted: 0,
    duplicatesSkipped: 0,
    studentsProvisioned: 0,
    errors: [],
  };

  // ── Load everything up front (4 concurrent reads) ───────────────────────────
  const [schoolsRead, regsRead, airtableSchools, participants] = await Promise.all([
    supabase.from("schools").select("id, name, lga, category, airtable_id, school_code"),
    supabase
      .from("registrations")
      .select("id, airtable_id, school_id, edition_year, contact_email"),
    listAirtableRecords<SchoolRecordFields>(getSchoolDatabaseTableId()),
    listAirtableRecords<ParticipantFields>(getParticipantsTableId()),
  ]);
  if (schoolsRead.error) throw new Error(`schools read failed: ${schoolsRead.error.message}`);
  if (regsRead.error) throw new Error(`registrations read failed: ${regsRead.error.message}`);

  const schoolsByAirtableId = new Map<string, DbSchool>();
  // Keyed by normalized name only — the same expression as schools_norm_name_key.
  // Including LGA here is what used to let one school through as several rows.
  const schoolsByName = new Map<string, DbSchool>();
  for (const s of (schoolsRead.data ?? []) as DbSchool[]) {
    if (s.airtable_id) schoolsByAirtableId.set(s.airtable_id, s);
    schoolsByName.set(normalizeSchoolName(s.name), s);
  }

  const regsByAirtableId = new Map<string, DbRegistration>();
  const unlinkedRegs: DbRegistration[] = [];
  for (const r of (regsRead.data ?? []) as DbRegistration[]) {
    if (r.airtable_id) regsByAirtableId.set(r.airtable_id, r);
    else unlinkedRegs.push(r);
  }

  // ── Phase A: Airtable Schools table → batched upsert ────────────────────────
  // Matched rows refresh in ONE upsert (Airtable is source of truth); new rows
  // insert in one batch. Dedupe updates by id — two punctuation-variant
  // Airtable records can match the same portal school, and ON CONFLICT can't
  // touch a row twice in one statement.
  const schoolUpdates = new Map<string, Record<string, unknown>>();
  const schoolInserts = new Map<string, Record<string, unknown>>();
  for (const rec of airtableSchools) {
    const name = rec.fields["School Name"]?.trim();
    if (!name) continue;
    const lga = rec.fields["School Local Government Area"] ?? null;
    const category = rec.fields["School Category"] ?? null;
    const address = rec.fields["School Address"] ?? null;
    const email = rec.fields["School Email"]?.toLowerCase() ?? null;
    const key = normalizeSchoolName(name);

    const matched = schoolsByAirtableId.get(rec.id) ?? schoolsByName.get(key);
    if (matched) {
      // A canonical school's name, LGA and category are decided by the workbook, not
      // by Airtable. Only ever fill blanks and attach the airtable_id.
      const canonical = Boolean(matched.school_code);
      schoolUpdates.set(matched.id, {
        id: matched.id,
        ...(canonical
          ? {}
          : { name, lga, category }),
        ...(address && !canonical ? { address } : {}),
        ...(email && !canonical ? { email } : {}),
        airtable_id: rec.id,
      });
      if (!matched.airtable_id) summary.schoolsLinked += 1;
      matched.airtable_id = rec.id;
      schoolsByAirtableId.set(rec.id, matched);
    } else if (!schoolInserts.has(key)) {
      schoolInserts.set(key, { name, lga, category, address, email, airtable_id: rec.id });
    }
  }

  for (const batch of chunk([...schoolUpdates.values()], 200)) {
    const { error } = await supabase.from("schools").upsert(batch, { onConflict: "id" });
    if (error) summary.errors.push(`school refresh batch: ${error.message}`);
  }
  if (schoolInserts.size > 0) {
    const { data: created, error } = await supabase
      .from("schools")
      .insert([...schoolInserts.values()])
      .select("id, name, lga, category, airtable_id, school_code");
    if (error) {
      summary.errors.push(`school insert batch: ${error.message}`);
    } else {
      for (const row of (created ?? []) as DbSchool[]) {
        summary.schoolsCreated += 1;
        if (row.airtable_id) schoolsByAirtableId.set(row.airtable_id, row);
        schoolsByName.set(normalizeSchoolName(row.name), row);
      }
    }
  }

  // ── Phase B: participants → registrations ───────────────────────────────────
  // The Airtable table holds duplicate submissions from some schools — the
  // portal keeps ONE registration per school+edition. Within each duplicate
  // group, a record already linked to a portal row wins (stable across runs);
  // otherwise the newest submission wins (re-submissions usually correct
  // earlier mistakes).
  const groups = new Map<string, AirtableRecord<ParticipantFields>[]>();
  for (const rec of participants) {
    const f = rec.fields;
    const name = f["School Full Name"]?.trim();
    if (!name) continue;
    const groupKey = `${normalizeSchoolName(name)}#${new Date(airtableCreatedAt(rec)).getFullYear()}`;
    const group = groups.get(groupKey);
    if (group) group.push(rec);
    else groups.set(groupKey, [rec]);
  }
  const chosen: AirtableRecord<ParticipantFields>[] = [];
  for (const group of groups.values()) {
    const winner =
      group.find((r) => regsByAirtableId.has(r.id)) ??
      group.reduce((a, b) => (a.createdTime > b.createdTime ? a : b));
    summary.duplicatesSkipped += group.length - 1;
    chosen.push(winner);
  }

  // Participant rows embed their school (no link to the Schools table) — batch
  // create any that Phase A didn't produce.
  const missingSchools = new Map<string, Record<string, unknown>>();
  for (const rec of chosen) {
    const f = rec.fields;
    const key = normalizeSchoolName(f["School Full Name"]);
    if (!schoolsByName.has(key) && !missingSchools.has(key)) {
      missingSchools.set(key, {
        name: f["School Full Name"]?.trim(),
        lga: f["School LGA"] ?? null,
        category: f["School Category"] ?? null,
        address: f["School Address"] ?? null,
        email: f["School Email Address"]?.toLowerCase() || null,
      });
    }
  }
  if (missingSchools.size > 0) {
    const { data: created, error } = await supabase
      .from("schools")
      .insert([...missingSchools.values()])
      .select("id, name, lga, category, airtable_id");
    if (error) {
      summary.errors.push(`participant school insert batch: ${error.message}`);
    } else {
      for (const row of (created ?? []) as DbSchool[]) {
        summary.schoolsCreated += 1;
        schoolsByName.set(normalizeSchoolName(row.name), row);
      }
    }
  }

  // Classify every chosen record, then execute per class in batches.
  interface RepTarget {
    schoolId: string;
    editionYear: number;
    schoolName: string;
    reps: { name: string; level: string }[];
  }
  const regUpdates: Record<string, unknown>[] = [];
  const regInserts: Record<string, unknown>[] = [];
  const memberRows: Record<string, unknown>[] = [];
  const repTargets: RepTarget[] = [];
  const adoptions: { row: DbRegistration; payload: Record<string, unknown> }[] = [];

  for (const rec of chosen) {
    const f = rec.fields;
    const schoolName = f["School Full Name"]?.trim();
    if (!schoolName) continue;
    const school = schoolsByName.get(normalizeSchoolName(schoolName));
    if (!school) {
      summary.errors.push(`registration ${rec.id} ("${schoolName}"): school missing`);
      continue;
    }

    const createdAt = airtableCreatedAt(rec);
    const editionYear = new Date(createdAt).getFullYear();
    const teacherEmail = f["Teacher Email Address"]?.toLowerCase() || null;
    const principalEmail = f["Principal Email Address"]?.toLowerCase() || null;
    const contactEmail = teacherEmail ?? principalEmail;
    const contactName = f["Teacher Full Name"] || null;
    const reps = [1, 2, 3]
      .map((n) => ({
        name: f[`Student Rep ${n} Full Name`]?.trim() ?? "",
        level: f[`Student Rep ${n} Class`] ?? "",
      }))
      .filter((r) => r.name);
    repTargets.push({ schoolId: school.id, editionYear, schoolName, reps });

    const mirrored = {
      school_id: school.id,
      reps,
      details: f,
      contact_email: contactEmail,
      contact_name: contactName,
      created_at: createdAt,
    };

    const existing = regsByAirtableId.get(rec.id);
    if (existing) {
      // Refresh mirrored data only — the upsert payload deliberately excludes
      // status/owner/tokens, so ON CONFLICT leaves them untouched.
      regUpdates.push({ airtable_id: rec.id, ...mirrored });
      summary.registrationsUpdated += 1;
      continue;
    }

    // Adopt a row the live mirror created without an airtable_id (same
    // school + edition; prefer a contact-email match, else a lone candidate).
    const candidates = unlinkedRegs.filter(
      (r) => r.school_id === school.id && r.edition_year === editionYear,
    );
    const adopted =
      candidates.find((r) => r.contact_email && r.contact_email === contactEmail) ??
      (candidates.length === 1 ? candidates[0] : null);
    if (adopted) {
      adoptions.push({ row: adopted, payload: { airtable_id: rec.id, ...mirrored } });
      adopted.airtable_id = rec.id;
      unlinkedRegs.splice(unlinkedRegs.indexOf(adopted), 1);
      regsByAirtableId.set(rec.id, adopted);
      continue;
    }

    // Brand-new import. Mint onboarding credentials so the admin resend flow
    // works, but send nothing — activation stays admin-triggered.
    regInserts.push({
      owner_id: null,
      edition_year: editionYear,
      status: "submitted",
      claim_code: makeClaimCode(),
      verify_token: randomBytes(32).toString("hex"),
      verify_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      airtable_id: rec.id,
      ...mirrored,
    });
    summary.registrationsCreated += 1;

    // Stage memberships for the teacher + principal. Registration contacts
    // are trusted by definition (they submitted the entry), so they're
    // approved outright — the manual review queue is only for outsiders
    // requesting to join a school they didn't register.
    if (teacherEmail) {
      memberRows.push({ school_id: school.id, email: teacherEmail, full_name: contactName, status: "approved" });
    }
    if (principalEmail && principalEmail !== teacherEmail) {
      memberRows.push({
        school_id: school.id,
        email: principalEmail,
        full_name: f["Principal Full Name"] || null,
        status: "approved",
      });
    }
  }

  // Partial update via RPC — an upsert would have to carry admin-owned NOT
  // NULL columns (edition_year, status) just to satisfy the candidate row.
  for (const batch of chunk(regUpdates, 500)) {
    const { error } = await supabase.rpc("sync_refresh_registrations", { p_rows: batch });
    if (error) summary.errors.push(`registration refresh batch: ${error.message}`);
  }
  for (const { row, payload } of adoptions) {
    const { error } = await supabase.from("registrations").update(payload).eq("id", row.id);
    if (error) summary.errors.push(`registration adopt ${payload.airtable_id}: ${error.message}`);
    else summary.registrationsAdopted += 1;
  }
  for (const batch of chunk(regInserts, 200)) {
    const { error } = await supabase.from("registrations").insert(batch);
    if (error) summary.errors.push(`registration insert batch: ${error.message}`);
  }
  if (memberRows.length > 0) {
    const { error } = await supabase
      .from("school_members")
      .upsert(memberRows, { onConflict: "school_id,email", ignoreDuplicates: true });
    if (error) summary.errors.push(`membership staging: ${error.message}`);
  }

  // ── Phase C: student reps → accounts + access codes ─────────────────────────
  // Same reuse rule as coordinator provisioning: a returning name in the
  // school keeps its code (re-tagged to the current edition); a new name gets
  // an auth user + code. Existing students load in a few chunked reads; only
  // genuinely new reps pay the per-account auth call.
  interface DbStudent {
    id: string;
    school_id: string;
    name: string;
    level: string | null;
    edition_year: number | null;
  }
  const targetSchoolIds = [...new Set(repTargets.map((t) => t.schoolId))];
  const studentsByKey = new Map<string, DbStudent>();
  for (const ids of chunk(targetSchoolIds, 150)) {
    const { data, error } = await supabase
      .from("students")
      .select("id, school_id, name, level, edition_year")
      .in("school_id", ids);
    if (error) {
      summary.errors.push(`students read: ${error.message}`);
      continue;
    }
    for (const s of (data ?? []) as DbStudent[]) {
      studentsByKey.set(`${s.school_id}|${normalizeSchoolName(s.name)}`, s);
    }
  }

  const retags = new Map<string, Record<string, unknown>>();
  const creations = new Map<
    string,
    { schoolId: string; editionYear: number; schoolName: string; name: string; level: string | null }
  >();
  for (const target of repTargets) {
    for (const rep of target.reps) {
      const key = `${target.schoolId}|${normalizeSchoolName(rep.name)}`;
      const existing = studentsByKey.get(key);
      if (existing) {
        if (existing.edition_year !== target.editionYear || (rep.level || null) !== existing.level) {
          retags.set(existing.id, {
            id: existing.id,
            edition_year: target.editionYear,
            level: rep.level || null,
          });
        }
      } else if (!creations.has(key)) {
        creations.set(key, {
          schoolId: target.schoolId,
          editionYear: target.editionYear,
          schoolName: target.schoolName,
          name: rep.name,
          level: rep.level || null,
        });
      }
    }
  }

  for (const batch of chunk([...retags.values()], 500)) {
    const { error } = await supabase.rpc("sync_retag_students", { p_rows: batch });
    if (error) summary.errors.push(`student retag batch: ${error.message}`);
  }

  // Auth users can't be created in bulk — cap concurrency to stay friendly to
  // the auth API. Steady-state runs have zero of these.
  await mapLimit([...creations.values()], 5, async (student) => {
    const code = makeAccessCode();
    const authEmail = studentAuthEmail(code);
    const { data: created, error: userError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password: code,
      email_confirm: true,
      user_metadata: { full_name: student.name },
    });
    if (userError || !created.user) {
      summary.errors.push(
        `student "${student.name}" (${student.schoolName}): ${userError?.message ?? "auth user creation failed"}`,
      );
      return;
    }
    const { error: insertError } = await supabase.from("students").insert({
      school_id: student.schoolId,
      name: student.name,
      level: student.level,
      access_code: code,
      auth_email: authEmail,
      auth_user_id: created.user.id,
      edition_year: student.editionYear,
    });
    if (insertError) {
      summary.errors.push(`student "${student.name}" (${student.schoolName}): ${insertError.message}`);
      return;
    }
    summary.studentsProvisioned += 1;
  });

  return summary;
}

export function describeSyncSummary(s: AirtableSyncSummary) {
  const parts = [
    `${s.registrationsCreated} new`,
    `${s.registrationsUpdated} refreshed`,
    ...(s.registrationsAdopted ? [`${s.registrationsAdopted} linked to existing rows`] : []),
    ...(s.schoolsCreated ? [`${s.schoolsCreated} schools added`] : []),
    ...(s.duplicatesSkipped ? [`${s.duplicatesSkipped} duplicate Airtable rows skipped`] : []),
    ...(s.studentsProvisioned ? [`${s.studentsProvisioned} student codes created`] : []),
  ];
  const base = `Registrations: ${parts.join(", ")}.`;
  return s.errors.length ? `${base} ${s.errors.length} row(s) failed.` : base;
}
