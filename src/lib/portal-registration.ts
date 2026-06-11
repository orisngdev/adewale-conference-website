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
  }

  const reps = [
    { name: input.studentRep1FullName, level: input.studentRep1Class },
    { name: input.studentRep2FullName, level: input.studentRep2Class },
    { name: input.studentRep3FullName, level: input.studentRep3Class },
  ].filter((r) => r.name);

  const claimCode = makeClaimCode();
  await supabase.from("registrations").insert({
    school_id: schoolId,
    owner_id: null,
    edition_year: EDITION_YEAR,
    status: "submitted",
    reps,
    // The coordinating teacher is the intended portal user — match on them first
    // so they auto-become a coordinator when they sign up with this email.
    contact_email:
      input.teacherEmail || input.principalEmail || input.schoolEmail || null,
    claim_code: claimCode,
  });

  return claimCode;
}
