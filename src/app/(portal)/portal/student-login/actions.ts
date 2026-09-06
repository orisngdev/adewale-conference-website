"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";

// Students sign in with just their access code: look up the synthetic email
// (service role), then sign in with email + the code as password.
export async function studentLogin(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return "Enter your access code.";

  const admin = createAdminClient();
  if (!admin) return "Student sign-in isn't configured on the server.";

  const { data: student } = await admin
    .from("students")
    .select("auth_email")
    .eq("access_code", code)
    .maybeSingle();
  if (!student) {
    console.warn(`studentLogin: no students row for code ${code}`);
    return "Invalid code.";
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: student.auth_email,
    password: code,
  });
  if (error) {
    // Real code, account rejected it — usually the password drifted off the
    // access code, or the row has no auth user. Same message either way, so
    // separate them in the logs.
    console.warn(
      `studentLogin: code ${code} exists but sign-in failed for ${student.auth_email}: ${error.message}`,
    );
    return "Invalid code.";
  }

  redirect("/portal/student");
}
