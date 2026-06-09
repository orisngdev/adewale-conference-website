import { NextResponse } from "next/server";
import {
  buildRegistrationEmail,
  buildSponsorshipEmail,
  sendEmail,
} from "@/lib/email";

export const runtime = "nodejs";

// Dev-only: preview or test-send the confirmation emails.
//   Preview in browser:  /api/email-preview?type=registration
//   Real test send:      /api/email-preview?type=registration&send=you@example.com
// The test send goes straight through SendGrid, independent of Airtable.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "registration";
  const sendTo = params.get("send");

  const email =
    type === "sponsorship"
      ? buildSponsorshipEmail({
          org: "Bluewave Industries Ltd",
          contact: "Adaeze Okafor",
          email: "adaeze@example.com",
          tier: "Gold - ₦5M",
        })
      : buildRegistrationEmail({
          schoolFullName: "Mayflower Secondary School",
          schoolLGA: "Ikenne",
          zonalFinalsLocation: "Sagamu",
          principalFullName: "Mrs. Folake Adeyemi",
          principalEmail: "principal@example.com",
          teacherFullName: "Mr. Tunde Bello",
          teacherEmail: "teacher@example.com",
        });

  if (sendTo) {
    try {
      const accepted = await sendEmail({
        to: [{ email: sendTo }],
        subject: email.subject,
        html: email.html,
      });
      return NextResponse.json({ sentTo: sendTo, accepted });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Send failed." },
        { status: 500 },
      );
    }
  }

  return new NextResponse(email.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
