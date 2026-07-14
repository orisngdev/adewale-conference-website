"use server";

import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";

export type RequestAccessResult =
  | { status: "pending" | "approved" }
  | { error: string };

// No-claim-code path: the signed-in educator picks their school and the RPC
// stages a pending membership for the admin queue (or reports that this email
// is already a member).
export async function requestSchoolAccess(schoolId: string): Promise<RequestAccessResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first." };
  if (!schoolId) return { error: "Pick your school first." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_school_access", {
    p_school_id: schoolId,
  });
  if (error) {
    console.error("request_school_access failed:", error.message);
    return { error: "Could not send the request — try again." };
  }
  return { status: data === "approved" ? "approved" : "pending" };
}
