"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { canManageModule, getSessionUser } from "@/supabase/auth";
import { createAdminClient } from "@/supabase/admin";
import {
  provisionStudent,
  deactivateStudent,
} from "@/lib/provision-student";
import {
  getParticipantsTableId,
  isAirtableConfigured,
  updateAirtableRecord,
} from "@/lib/airtable";
import type { Rep, StudentReplacementRow } from "@/supabase/types";

// Approve a student replacement: deactivate the outgoing student, provision the
// incoming one, update the registration, and write the swap back to Airtable so
// the one-way sync doesn't revert it. Service-role work, so admin is verified
// explicitly (createAdminClient bypasses RLS).
export async function approveReplacement(id: string) {
  if (!(await canManageModule("participants"))) return;
  const reviewer = await getSessionUser();
  const admin = createAdminClient();
  if (!admin) return;

  const { data: rRow } = await admin
    .from("student_replacements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const r = rRow as StudentReplacementRow | null;
  if (!r || r.status !== "pending") return;

  const { data: reg } = await admin
    .from("registrations")
    .select("id, school_id, edition_year, reps, details, airtable_id")
    .eq("id", r.registration_id)
    .maybeSingle();
  if (!reg?.school_id) return;
  const schoolId = reg.school_id as string;
  const editionYear = (reg.edition_year as number | null) ?? null;

  // 1. Retire the outgoing student (re-resolve in case they were provisioned
  //    after the request was filed).
  let oldStudentId = r.old_student_id;
  if (!oldStudentId) {
    const { data: found } = await admin
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .ilike("name", r.old_name)
      .is("deactivated_at", null)
      .limit(1);
    oldStudentId = (found?.[0]?.id as string | undefined) ?? null;
  }
  if (oldStudentId) {
    const res = await deactivateStudent(admin, oldStudentId);
    if (!res.ok) {
      console.error("approveReplacement: deactivate failed:", res.error);
      return;
    }
  }

  // 2. Provision the incoming student (new name → new access code).
  const provision = await provisionStudent(admin, {
    schoolId,
    editionYear: editionYear ?? (Number(process.env.ASC_EDITION_YEAR) || 2026),
    name: r.new_name,
    level: r.new_level,
  });
  if (provision.error) {
    console.error("approveReplacement: provision failed:", provision.error);
    return;
  }

  // 3. Swap the rep in registrations.reps (match by name, fall back to slot).
  const reps = Array.isArray(reg.reps) ? [...(reg.reps as Rep[])] : [];
  let idx = reps.findIndex(
    (rep) => rep.name.trim().toLowerCase() === r.old_name.toLowerCase(),
  );
  if (idx < 0 && r.rep_slot) idx = r.rep_slot - 1;
  const newRep: Rep = r.new_level
    ? { name: r.new_name, level: r.new_level }
    : { name: r.new_name };
  if (idx >= 0 && idx < reps.length) reps[idx] = newRep;
  else reps.push(newRep);

  // 4. Patch registrations.details "Student Rep N …" fields so the mirror stays
  //    internally consistent (and matches what we push to Airtable).
  const details = { ...((reg.details ?? {}) as Record<string, string>) };
  const slotFields = repSlotFields(r);
  Object.assign(details, slotFields);

  await admin
    .from("registrations")
    .update({ reps, details })
    .eq("id", reg.id);

  // 5. Write the swap back to Airtable (source of truth) so the next sync keeps
  //    it. Best-effort — a failure here leaves the portal correct; the admin can
  //    re-run the sync after fixing Airtable.
  if (reg.airtable_id && r.rep_slot && isAirtableConfigured()) {
    try {
      await updateAirtableRecord(
        getParticipantsTableId(),
        reg.airtable_id as string,
        slotFields,
      );
    } catch (error) {
      console.error(
        "approveReplacement: Airtable write-back failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // 6. Mark approved.
  await admin
    .from("student_replacements")
    .update({
      status: "approved",
      reviewed_by: reviewer?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // 7. Notify the coordinator who requested it.
  if (r.requested_by) {
    await admin.from("notifications").insert({
      profile_id: r.requested_by,
      title: "Student replacement approved",
      body: `${r.new_name} now replaces ${r.old_name}. Their new access code is on the Students page.`,
      link: "/portal/school/students",
    });
  }

  revalidatePath("/portal/admin/replacements");
  revalidatePath("/portal/school/students");
  revalidatePath("/portal/school");
}

export async function declineReplacement(id: string, formData: FormData) {
  if (!(await canManageModule("participants"))) return;
  const reviewer = await getSessionUser();
  const supabase = await createClient();

  const note = String(formData.get("note") ?? "").trim() || null;

  // RLS (sr_admin_update) restricts this to admins; no student changes.
  const { data: r } = await supabase
    .from("student_replacements")
    .update({
      status: "declined",
      admin_note: note,
      reviewed_by: reviewer?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("requested_by, old_name, new_name")
    .maybeSingle();

  if (r?.requested_by) {
    await supabase.from("notifications").insert({
      profile_id: r.requested_by as string,
      title: "Student replacement declined",
      body: `Your request to replace ${r.old_name} with ${r.new_name} was declined.${note ? ` Note: ${note}` : ""}`,
      link: "/portal/school/students",
    });
  }

  revalidatePath("/portal/admin/replacements");
}

// Map the incoming rep's details onto the Airtable "Student Rep N …" field keys
// for the resolved slot (same field names the registration form pushes).
function repSlotFields(r: StudentReplacementRow): Record<string, string> {
  const n = r.rep_slot;
  if (!n) return {};
  const d = r.new_details ?? {};
  const fields: Record<string, string> = {
    [`Student Rep ${n} Full Name`]: r.new_name,
  };
  if (r.new_level) fields[`Student Rep ${n} Class`] = r.new_level;
  if (d.dob) fields[`Student Rep ${n} DOB`] = d.dob;
  if (d.gender) fields[`Student Rep ${n} Gender`] = d.gender;
  if (d.guardianName) fields[`Student Rep ${n} Guardian Name`] = d.guardianName;
  if (d.guardianNumber)
    fields[`Student Rep ${n} Guardian Number`] = d.guardianNumber;
  return fields;
}
