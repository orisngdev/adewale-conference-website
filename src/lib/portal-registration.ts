import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";

const EDITION_YEAR =
  Number(process.env.ASC_EDITION_YEAR) || new Date().getFullYear();

export interface MirrorRegistrationInput {
  schoolFullName: string;
  schoolLGA: string;
  schoolCategory: string;
  schoolEmail?: string;
  principalEmail: string;
  teacherEmail: string;
  studentRep1FullName: string;
  studentRep1Class: string;
  studentRep2FullName: string;
  studentRep2Class: string;
  studentRep3FullName: string;
  studentRep3Class: string;
}

function makeClaimCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
}

// Mirrors a public registration into Supabase (thin copy; Airtable stays the
// source of truth). Returns the claim code, or null when the bridge is off.
export async function mirrorRegistrationToSupabase(
  input: MirrorRegistrationInput,
  airtableSchoolId?: string | null,
): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  // Find-or-create the school by natural key (name + lga + category).
  let schoolId: string | null = null;
  const { data: existing } = await supabase
    .from("schools")
    .select("id")
    .eq("name", input.schoolFullName)
    .eq("lga", input.schoolLGA)
    .eq("category", input.schoolCategory)
    .maybeSingle();

  let newSchool = false;
  if (existing) {
    schoolId = existing.id;
    if (airtableSchoolId) {
      await supabase
        .from("schools")
        .update({ airtable_id: airtableSchoolId })
        .eq("id", schoolId)
        .is("airtable_id", null);
    }
  } else {
    const { data: created } = await supabase
      .from("schools")
      .insert({
        name: input.schoolFullName,
        lga: input.schoolLGA,
        category: input.schoolCategory,
        airtable_id: airtableSchoolId ?? null,
      })
      .select("id")
      .single();
    schoolId = created?.id ?? null;
    newSchool = true;
  }

  const reps = [
    { name: input.studentRep1FullName, level: input.studentRep1Class },
    { name: input.studentRep2FullName, level: input.studentRep2Class },
    { name: input.studentRep3FullName, level: input.studentRep3Class },
  ].filter((r) => r.name);

  // The coordinating teacher is the intended portal user.
  const contactEmail =
    input.teacherEmail || input.principalEmail || input.schoolEmail || null;

  const claimCode = makeClaimCode();
  const { error: regError } = await supabase.from("registrations").insert({
    school_id: schoolId,
    owner_id: null,
    edition_year: EDITION_YEAR,
    status: "submitted",
    reps,
    contact_email: contactEmail,
    claim_code: claimCode,
  });
  // Fail loudly — a silent failure here is what produced orphaned claim codes.
  if (regError) {
    throw new Error(`registration mirror insert failed: ${regError.message}`);
  }

  // Stage a school membership by email: approved if this is a brand-new school
  // (the founding coordinator), otherwise pending an admin's approval. Access
  // activates when this email signs in (linked via my_school_ids by email).
  if (schoolId && contactEmail) {
    const { error: memberError } = await supabase.from("school_members").upsert(
      {
        school_id: schoolId,
        email: contactEmail.toLowerCase(),
        status: newSchool ? "approved" : "pending",
      },
      { onConflict: "school_id,email", ignoreDuplicates: true },
    );
    if (memberError) {
      console.error("school_members upsert failed:", memberError.message);
    }
  }

  return claimCode;
}
