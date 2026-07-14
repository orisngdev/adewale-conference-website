import { NextResponse } from "next/server";
import { LGA_OPTIONS, SCHOOL_CATEGORY_OPTIONS } from "@/lib/forms";
import { buildWaitlistEmail, sendEmailSafely } from "@/lib/email";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/supabase/admin";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public waitlist signup — only meaningful while registration is CLOSED (the
// homepage shows the form then; if an edition is open we point the caller at
// the real registration instead).
export async function POST(request: Request) {
  try {
    if (!rateLimit(`waitlist:${requestIp(request.headers)}`, { limit: 5, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many attempts — please wait a minute and try again." },
        { status: 429 },
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const str = (v: unknown, max = 200) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";

    const schoolName = str(body?.schoolName).replace(/\s+/g, " ");
    const lga = str(body?.lga);
    const category = str(body?.category);
    const contactName = str(body?.contactName);
    const contactEmail = str(body?.contactEmail, 320).toLowerCase();
    const phone = str(body?.phone, 30);

    if (!schoolName) return NextResponse.json({ error: "School name is required." }, { status: 400 });
    if (!contactName) return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
    if (!EMAIL_REGEX.test(contactEmail)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (lga && !LGA_OPTIONS.includes(lga as (typeof LGA_OPTIONS)[number])) {
      return NextResponse.json({ error: "School LGA is invalid." }, { status: 400 });
    }
    if (category && !SCHOOL_CATEGORY_OPTIONS.includes(category as (typeof SCHOOL_CATEGORY_OPTIONS)[number])) {
      return NextResponse.json({ error: "School category is invalid." }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Waitlist is not available right now." }, { status: 503 });
    }

    // Registration open? Don't waitlist — register.
    const { data: openEdition } = await supabase
      .from("editions")
      .select("year")
      .eq("registration_open", true)
      .limit(1)
      .maybeSingle();
    if (openEdition) {
      return NextResponse.json(
        { error: "Registration is open — register your school directly instead.", code: "open" },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("waitlist").insert({
      school_name: schoolName,
      lga: lga || null,
      category: category || null,
      contact_name: contactName,
      contact_email: contactEmail,
      phone: phone || null,
    });
    // 23505 = already on the list (unique school+contact index) — that's a
    // success from the submitter's point of view, and we skip the re-email.
    const alreadyListed = error?.code === "23505";
    if (error && !alreadyListed) {
      console.error("waitlist insert failed:", error.message);
      return NextResponse.json({ error: "Unable to join the waitlist right now." }, { status: 500 });
    }

    if (!alreadyListed) {
      await sendEmailSafely(
        buildWaitlistEmail({ email: contactEmail, name: contactName, schoolName }),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Waitlist submission failed:", error);
    return NextResponse.json({ error: "Unable to join the waitlist right now." }, { status: 500 });
  }
}
