"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import {
  CENTRE_LEAD_COOKIE,
  readSession,
  sessionExpiry,
  signSession,
} from "@/lib/centre-lead-session";
import {
  activeLeadById,
  candidateCentre,
  findActiveLead,
  loadSitting,
  markAttendance,
  markMany,
  openAttendanceExam,
  stampSignIn,
  type LeadWithCentre,
  type OpenExam,
} from "@/lib/attendance-data";
import type { AttendanceStatus } from "@/supabase/types";

export type SignInResult = { ok: true } | { ok: false; error: string };
export type MarkResult = { ok: true } | { ok: false; error: string };

// Reuses the Fellows sheet secret rather than adding a variable to set on a
// deadline. Consequence worth knowing: rotating it signs every centre lead out.
function secret() {
  return process.env.FELLOWS_SHEET_SECRET ?? "";
}

/**
 * The signed-in lead, re-derived from the cookie on every single use.
 *
 * Deliberately re-reads the row rather than trusting the cookie's contents: the
 * cookie proves which lead id was issued, not that the lead is still active or
 * that attendance is still open. Deactivating a lead ends their session here.
 */
export async function currentLead(): Promise<{ lead: LeadWithCentre; exam: OpenExam } | null> {
  const store = await cookies();
  const leadId = readSession(store.get(CENTRE_LEAD_COOKIE)?.value, secret());
  if (!leadId) return null;

  const [lead, exam] = await Promise.all([activeLeadById(leadId), openAttendanceExam()]);
  if (!lead || !exam) return null;
  if (lead.edition_year !== exam.edition_year) return null;
  return { lead, exam };
}

export async function signIn(_prev: SignInResult | null, formData: FormData): Promise<SignInResult> {
  const ip = requestIp(await headers());
  if (!rateLimit(`centre-lead:${ip}`, { limit: 10, windowMs: 60_000 })) {
    return { ok: false, error: "Too many attempts from this device. Wait a minute and try again." };
  }

  if (!secret()) {
    return { ok: false, error: "Attendance is not configured on this server. Tell the exam desk." };
  }

  const centreId = String(formData.get("centre_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!centreId || !email) {
    return { ok: false, error: "Choose your centre and enter your email." };
  }

  const exam = await openAttendanceExam();
  if (!exam) return { ok: false, error: "Attendance is not open yet." };

  const lead = await findActiveLead(centreId, email, exam.edition_year);
  // One message for "wrong email", "wrong centre" and "not on the list". Naming
  // which was wrong would confirm who is staffing where to anyone guessing.
  if (!lead) {
    return {
      ok: false,
      error: "We could not find you at that centre. Check the email the exam desk registered for you.",
    };
  }

  await stampSignIn(lead.id);
  const store = await cookies();
  const expiry = sessionExpiry();
  store.set(CENTRE_LEAD_COOKIE, signSession(lead.id, expiry, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiry),
  });
  redirect("/attendance/roster");
}

export async function signOut() {
  const store = await cookies();
  store.delete(CENTRE_LEAD_COOKIE);
  redirect("/attendance");
}

export async function mark(_prev: MarkResult | null, formData: FormData): Promise<MarkResult> {
  const session = await currentLead();
  if (!session) return { ok: false, error: "Your session ended. Sign in again." };

  const studentId = String(formData.get("student_id") ?? "").trim();
  const status = String(formData.get("status") ?? "") as AttendanceStatus;
  if (!studentId || (status !== "present" && status !== "absent")) {
    return { ok: false, error: "That mark did not make sense. Try again." };
  }

  // The posted student id is not a scope. Re-derive which centre they belong to
  // and refuse anyone allocated to a hall that is not this one — a lead may mark
  // their own candidates, and walk-ins nobody allocated, and nothing else.
  const allocation = await candidateCentre(session.exam, studentId);
  if (!allocation) return { ok: false, error: "That candidate is not in this sitting." };
  if (allocation.centreId && allocation.centreId !== session.lead.centre_id) {
    return { ok: false, error: "That candidate is allocated to another centre." };
  }

  await markAttendance({
    examId: session.exam.id,
    studentId,
    centreId: session.lead.centre_id,
    status,
    by: { leadId: session.lead.id },
  });

  revalidatePath("/attendance/roster");
  return { ok: true };
}

/** End of day: everyone still unaccounted for at this centre is absent. */
export async function markRemainingAbsent(
  _prev: MarkResult | null,
  _formData: FormData,
): Promise<MarkResult> {
  const session = await currentLead();
  if (!session) return { ok: false, error: "Your session ended. Sign in again." };

  const { entries } = await loadSitting(session.exam);
  const remaining = entries.filter(
    (e) => e.centreId === session.lead.centre_id && e.state === "unmarked",
  );
  if (remaining.length === 0) {
    return { ok: false, error: "Every candidate at this centre is already marked." };
  }

  await markMany({
    examId: session.exam.id,
    studentIds: remaining.map((e) => e.studentId),
    centreId: session.lead.centre_id,
    status: "absent",
    by: { leadId: session.lead.id },
  });

  revalidatePath("/attendance/roster");
  return { ok: true };
}
