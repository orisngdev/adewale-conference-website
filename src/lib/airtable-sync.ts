import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";
import { provisionStudent } from "@/lib/provision-student";
import {
  type AirtableRecord,
  type SchoolRecordFields,
  getParticipantsTableId,
  getSchoolDatabaseTableId,
  listAirtableRecords,
} from "@/lib/airtable";

// One-way sync: Airtable (source of truth) → Supabase portal mirror.
// Idempotent — keyed by airtable_id on both schools and registrations, so it
// doubles as the historical backfill and the ongoing refresh. Never sends
// email and never touches admin-owned registration state (status, owner,
// claim/verify tokens) on rows that already exist.

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
}

interface DbRegistration {
  id: string;
  airtable_id: string | null;
  school_id: string | null;
  edition_year: number;
  contact_email: string | null;
}

// Punctuation-insensitive: Airtable holds the same school as "ST. MARY'S,
// OTA" and "ST MARYS OTA" — both must map to one portal school.
function norm(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function schoolKey(name?: string | null, lga?: string | null, category?: string | null) {
  return `${norm(name)}|${norm(lga)}|${norm(category)}`;
}

function makeClaimCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
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

  // Every rep on a synced registration gets a student account + access code
  // (same reuse rule as coordinator provisioning: a returning name in the
  // school keeps its code and is re-tagged to the edition).
  const ensureRepStudents = async (
    schoolId: string,
    editionYear: number,
    schoolName: string,
    reps: { name: string; level: string }[],
  ) => {
    for (const rep of reps) {
      const result = await provisionStudent(supabase, {
        schoolId,
        editionYear,
        name: rep.name,
        level: rep.level || null,
      });
      if (result.error) {
        summary.errors.push(`student "${rep.name}" (${schoolName}): ${result.error}`);
      } else if (result.created) {
        summary.studentsProvisioned += 1;
      }
    }
  };

  // ── Portal schools, indexed two ways ────────────────────────────────────────
  const { data: dbSchoolRows, error: schoolsError } = await supabase
    .from("schools")
    .select("id, name, lga, category, airtable_id");
  if (schoolsError) throw new Error(`schools read failed: ${schoolsError.message}`);

  const schoolsByAirtableId = new Map<string, DbSchool>();
  const schoolsByKey = new Map<string, DbSchool>();
  for (const s of (dbSchoolRows ?? []) as DbSchool[]) {
    if (s.airtable_id) schoolsByAirtableId.set(s.airtable_id, s);
    schoolsByKey.set(schoolKey(s.name, s.lga, s.category), s);
  }

  // ── Airtable Schools table → upsert ─────────────────────────────────────────
  const airtableSchools = await listAirtableRecords<SchoolRecordFields>(
    getSchoolDatabaseTableId(),
  );
  for (const rec of airtableSchools) {
    const name = rec.fields["School Name"]?.trim();
    if (!name) continue;
    const lga = rec.fields["School Local Government Area"] ?? null;
    const category = rec.fields["School Category"] ?? null;
    const address = rec.fields["School Address"] ?? null;
    const email = rec.fields["School Email"]?.toLowerCase() ?? null;

    try {
      const matched = schoolsByAirtableId.get(rec.id) ?? schoolsByKey.get(schoolKey(name, lga, category));
      if (matched) {
        // Airtable is source of truth — refresh mirrored fields and link back.
        const { error } = await supabase
          .from("schools")
          .update({ name, lga, category, address, email, airtable_id: rec.id })
          .eq("id", matched.id);
        if (error) throw new Error(error.message);
        if (!matched.airtable_id) summary.schoolsLinked += 1;
        matched.airtable_id = rec.id;
        schoolsByAirtableId.set(rec.id, matched);
      } else {
        const { data: created, error } = await supabase
          .from("schools")
          .insert({ name, lga, category, address, email, airtable_id: rec.id })
          .select("id, name, lga, category, airtable_id")
          .single();
        if (error) throw new Error(error.message);
        summary.schoolsCreated += 1;
        const row = created as DbSchool;
        schoolsByAirtableId.set(rec.id, row);
        schoolsByKey.set(schoolKey(name, lga, category), row);
      }
    } catch (error) {
      summary.errors.push(`school "${name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Existing registrations, indexed for match/adopt ─────────────────────────
  const { data: dbRegRows, error: regsError } = await supabase
    .from("registrations")
    .select("id, airtable_id, school_id, edition_year, contact_email");
  if (regsError) throw new Error(`registrations read failed: ${regsError.message}`);

  const regs = (dbRegRows ?? []) as DbRegistration[];
  const regsByAirtableId = new Map<string, DbRegistration>();
  const unlinkedRegs: DbRegistration[] = [];
  for (const r of regs) {
    if (r.airtable_id) regsByAirtableId.set(r.airtable_id, r);
    else unlinkedRegs.push(r);
  }

  // ── Airtable Participants table → upsert registrations ─────────────────────
  const participants = await listAirtableRecords<ParticipantFields>(
    getParticipantsTableId(),
  );

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
    const groupKey = `${schoolKey(name, f["School LGA"], f["School Category"])}#${new Date(rec.createdTime).getFullYear()}`;
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

  for (const rec of chosen) {
    const f = rec.fields;
    const schoolName = f["School Full Name"]?.trim();
    if (!schoolName) continue;

    try {
      // Find-or-create the school by natural key (participant rows embed the
      // school; they don't link to the Schools table).
      const key = schoolKey(schoolName, f["School LGA"], f["School Category"]);
      let school = schoolsByKey.get(key) ?? null;
      if (!school) {
        const { data: created, error } = await supabase
          .from("schools")
          .insert({
            name: schoolName,
            lga: f["School LGA"] ?? null,
            category: f["School Category"] ?? null,
            address: f["School Address"] ?? null,
            email: f["School Email Address"]?.toLowerCase() || null,
          })
          .select("id, name, lga, category, airtable_id")
          .single();
        if (error) throw new Error(error.message);
        school = created as DbSchool;
        schoolsByKey.set(key, school);
        summary.schoolsCreated += 1;
      }

      const editionYear = new Date(rec.createdTime).getFullYear();
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

      const existing = regsByAirtableId.get(rec.id);
      if (existing) {
        // Refresh mirrored data only — status/owner/tokens stay admin-owned.
        const { error } = await supabase
          .from("registrations")
          .update({
            school_id: school.id,
            reps,
            details: f,
            contact_email: contactEmail,
            contact_name: contactName,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        summary.registrationsUpdated += 1;
        await ensureRepStudents(school.id, editionYear, schoolName, reps);
        continue;
      }

      // Adopt a row the live mirror created without an airtable_id (same
      // school + edition; prefer a contact-email match, else a lone candidate).
      const candidates = unlinkedRegs.filter(
        (r) => r.school_id === school!.id && r.edition_year === editionYear,
      );
      const adopted =
        candidates.find((r) => r.contact_email && r.contact_email === contactEmail) ??
        (candidates.length === 1 ? candidates[0] : null);
      if (adopted) {
        const { error } = await supabase
          .from("registrations")
          .update({
            airtable_id: rec.id,
            reps,
            details: f,
            contact_email: contactEmail,
            contact_name: contactName,
          })
          .eq("id", adopted.id);
        if (error) throw new Error(error.message);
        adopted.airtable_id = rec.id;
        unlinkedRegs.splice(unlinkedRegs.indexOf(adopted), 1);
        regsByAirtableId.set(rec.id, adopted);
        summary.registrationsAdopted += 1;
        await ensureRepStudents(school.id, editionYear, schoolName, reps);
        continue;
      }

      // Brand-new import. Mint onboarding credentials so the admin resend flow
      // works, but send nothing — activation stays admin-triggered.
      const verifyExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: inserted, error } = await supabase
        .from("registrations")
        .insert({
          school_id: school.id,
          owner_id: null,
          edition_year: editionYear,
          status: "submitted",
          reps,
          details: f,
          contact_email: contactEmail,
          contact_name: contactName,
          claim_code: makeClaimCode(),
          verify_token: randomBytes(32).toString("hex"),
          verify_token_expires_at: verifyExpires,
          airtable_id: rec.id,
        })
        .select("id, airtable_id, school_id, edition_year, contact_email")
        .single();
      if (error) throw new Error(error.message);
      regsByAirtableId.set(rec.id, inserted as DbRegistration);
      summary.registrationsCreated += 1;
      await ensureRepStudents(school.id, editionYear, schoolName, reps);

      // Stage memberships for the teacher + principal. Registration contacts
      // are trusted by definition (they submitted the entry), so they're
      // approved outright — the manual review queue is only for outsiders
      // requesting to join a school they didn't register.
      const members = [
        teacherEmail ? { email: teacherEmail, full_name: contactName } : null,
        principalEmail && principalEmail !== teacherEmail
          ? { email: principalEmail, full_name: f["Principal Full Name"] || null }
          : null,
      ].filter((m): m is { email: string; full_name: string | null } => !!m);
      if (members.length > 0) {
        const { error: memberError } = await supabase.from("school_members").upsert(
          members.map((m) => ({
            school_id: school!.id,
            email: m.email,
            full_name: m.full_name,
            status: "approved",
          })),
          { onConflict: "school_id,email", ignoreDuplicates: true },
        );
        if (memberError) {
          summary.errors.push(`members for "${schoolName}": ${memberError.message}`);
        }
      }
    } catch (error) {
      summary.errors.push(
        `registration ${rec.id} ("${schoolName}"): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

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
